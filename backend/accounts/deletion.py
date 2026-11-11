"""Self-service account deletion: erase personal data, keep anonymous gameplay history.

The Account row, its user row, pilots, rooms, memberships, positions, scores and
mission events stay linked for gameplay analytics. Everything that identifies the
person is replaced with random text or removed:

- Account/user: email, previous email, username, names and password; recovery keys.
- Every callsign the account flew, wherever it appears: pilot rows, room snapshots,
  live Redis room state, generated event text, ORA replies and other players' prompts.
- Squad names the account created, and the ORA prompts it wrote.
"""
import logging
import re
import secrets

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from .models import USER_SELF_DELETION
from .services import end_all_sessions

logger = logging.getLogger(__name__)
PROMPT_REMOVED = '[removed: user-self-deletion]'


def _garbage(length):
    return secrets.token_hex(length // 2)


class Scrubber:
    """Replaces the deleted pilots' callsigns with their new random names in free text."""

    def __init__(self, pilots):
        # pilot id -> (old callsign, new random callsign)
        self.names = {str(pilot.id): (pilot.name, _garbage(24)) for pilot in pilots}
        self.by_old = {}
        for old, new in self.names.values():
            self.by_old.setdefault(old.lower(), new)
        # Whole-word and case-insensitive. Callsigns may contain any characters, so escape them
        # and use lookarounds rather than \b. Longest first, so "Ace Two" wins over "Ace".
        alternatives = '|'.join(re.escape(old) for old in sorted(self.by_old, key=len, reverse=True))
        self.pattern = re.compile(rf'(?<!\w)(?:{alternatives})(?!\w)', re.IGNORECASE) if alternatives else None

    def text(self, value):
        if not isinstance(value, str) or self.pattern is None:
            return value
        return self.pattern.sub(lambda match: self.by_old[match.group(0).lower()], value)

    def new_name(self, data):
        if data.get('pilot_id') in self.names:
            return self.names[data['pilot_id']][1]
        return self.by_old[data['pilot'].lower()]

    def owns(self, data):
        """Whether a journal entry was written by a deleted pilot. Older entries only recorded the callsign."""
        if data.get('pilot_id'):
            return data['pilot_id'] in self.names
        return isinstance(data.get('pilot'), str) and data['pilot'].lower() in self.by_old

    def state(self, state):
        """Scrub a room state dict in place: the live Redis state and the stored snapshot share a shape."""
        if not isinstance(state, dict):
            return state
        for pilot_id, player in (state.get('players') or {}).items():
            if pilot_id in self.names and isinstance(player, dict):
                player['name'] = self.names[pilot_id][1]
        for entry in state.get('events') or []:
            if isinstance(entry, dict):
                entry['message'] = self.text(entry.get('message'))
        if isinstance(state.get('ai'), dict):
            state['ai']['message'] = self.text(state['ai'].get('message'))
        return state


def _scrub_live_rooms(codes, scrubber, strict):
    """Scrub live room state under each room's lock, which the simulation also holds while persisting."""
    from game import state as live  # Imported late so tests can swap the Redis client.
    for code in codes:
        try:
            if live.store.exists(f'room:{code}'):
                with live.locked_room(code) as state:
                    scrubber.state(state)
        except Exception:
            if strict:
                raise
            logger.exception('Could not scrub live state for room %s after an account deletion.', code)


def _scrub_snapshots(rooms, scrubber):
    from game.models import Room
    for room in Room.objects.select_for_update().filter(pk__in=[room.pk for room in rooms]):
        room.snapshot = scrubber.state(room.snapshot)
        room.save(update_fields=['snapshot'])


def delete_account(account):
    """Soft-delete an account for its owner. Raises (changing nothing) if live game state is unreachable."""
    from game.models import MissionEvent, Pilot, Room
    pilots = list(account.pilots.all())
    scrubber = Scrubber(pilots)
    rooms = list(Room.objects.filter(Q(members__pilot__in=pilots) | Q(owner__in=pilots)).distinct())
    codes = [room.code for room in rooms]

    # 1. Live state first, before any database row is locked, so the simulation (which
    #    persists while holding the room lock) cannot deadlock with this transaction.
    #    If Redis is unavailable, nothing has changed yet and the player can retry.
    _scrub_live_rooms(codes, scrubber, strict=True)

    with transaction.atomic():
        for pilot in pilots:
            pilot.name = scrubber.names[str(pilot.id)][1]
        Pilot.objects.bulk_update(pilots, ['name'])
        owned = {pilot.id for pilot in pilots}
        for room in Room.objects.select_for_update().filter(pk__in=[room.pk for room in rooms]):
            # A random name can be longer than the callsign it replaces, so keep to the column size.
            room.name = _garbage(48) if room.owner_id in owned else scrubber.text(room.name)[:Room._meta.get_field('name').max_length]
            room.snapshot = scrubber.state(room.snapshot)
            room.save(update_fields=['name', 'snapshot'])
        events = list(MissionEvent.objects.filter(room__in=rooms))
        for entry in events:
            entry.message = scrubber.text(entry.message)[:MissionEvent._meta.get_field('message').max_length]
            data = dict(entry.data or {})
            if scrubber.owns(data):
                # Free text the deleted player wrote is removed, not just renamed.
                data['pilot'], data['prompt'] = scrubber.new_name(data), PROMPT_REMOVED
            else:
                # Other players' prompts stay, minus any mention of the deleted callsigns.
                data.update({key: scrubber.text(data[key]) for key in ('pilot', 'prompt') if key in data})
            entry.data = data
        MissionEvent.objects.bulk_update(events, ['message', 'data'])

        user = account.user
        garbage_email = f'{_garbage(64)}@deleted.invalid'  # RFC 2606: .invalid can never receive mail.
        user.username = f'deleted-{_garbage(32)}'
        user.email, user.first_name, user.last_name = garbage_email, '', ''
        user.set_unusable_password()
        user.is_active = False
        user.save()
        account.email, account.previous_email, account.previous_email_verified_at = garbage_email, '', None
        account.activation_required = False
        account.recovery_nonce, account.recovery_used, account.recovery_created_at = '', [], None
        account.deleted_at, account.deletion_reason = timezone.now(), USER_SELF_DELETION
        end_all_sessions(account)
        account.save()

    # 2. A room reloaded from the database before the commit could have reintroduced an
    #    old callsign into Redis and then into its snapshot. Callsigns are gone from the
    #    database now, so one more pass over both closes that window for good.
    _scrub_live_rooms(codes, scrubber, strict=False)
    with transaction.atomic():
        _scrub_snapshots(rooms, scrubber)
    logger.info('Account %s was deleted by its owner (%s).', account.pk, USER_SELF_DELETION)
