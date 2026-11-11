"""Self-service data export: what RELAY stores about a signed-in player, as one JSON document.

It covers the personal data that deletion erases (deletion.py): the account's email,
its pilots and callsigns, the squads they flew in, the squads' ORA journal, and the
player's own ORA prompts. Credentials are never included (no password hash, recovery
keys, the secret they are derived from, or session data). Other players' callsigns and
prompts are left out, because they are someone else's data.
"""
from django.db.models import Q
from django.utils import timezone

from .services import RECOVERY_KEY_COUNT

FORMAT = 'relay-account-data'
VERSION = 1
NOTES = [
    'Times are UTC (ISO 8601). Positions are fictional world meters from the last saved state of each squad.',
    'Your password and recovery keys are credentials, so they are not included.',
    'Squad names and ORA replies appear as every squad member saw them. Other players\' callsigns and ORA prompts are not included.',
]


def _time(value):
    return value.isoformat() if value else None


def export_filename(now):
    return f'relay-account-data-{now:%Y-%m-%d}.json'


def _asked_by(entry, pilot_ids, members):
    """The ID of this account's pilot that asked ORA for a journal entry, or None.

    Entries record the pilot's ID. Older ones only recorded the callsign, so they count
    only when exactly one member of that squad flies under that callsign and it is one of
    this account's pilots. Guessing wrong would hand someone else's prompt to this player.
    """
    data = entry.data if isinstance(entry.data, dict) else {}
    if data.get('pilot_id'):
        return data['pilot_id'] if data['pilot_id'] in pilot_ids else None
    name = data.get('pilot')
    if not isinstance(name, str):
        return None
    flew = [pilot_id for pilot_id, callsign in members.get(entry.room_id, []) if callsign == name.lower()]
    return flew[0] if len(flew) == 1 and flew[0] in pilot_ids else None


def _position(point):
    return {'x': round(point.x, 2), 'z': round(point.y, 2)} if point else None


def export_account(account, now=None):
    from game.models import Membership, MissionEvent, Room  # game.views imports this app.
    now = now or timezone.now()
    pilots = list(account.pilots.order_by('created_at', 'id'))
    pilot_ids = {str(pilot.id) for pilot in pilots}
    rooms = list(Room.objects.filter(Q(members__pilot__in=pilots) | Q(owner__in=pilots)).distinct().order_by('created_at', 'code'))
    codes = {room.pk: room.code for room in rooms}

    members, yours = {}, {}
    for membership in Membership.objects.filter(room__in=rooms).select_related('pilot').order_by('joined_at', 'id'):
        pilot_id = str(membership.pilot_id)
        members.setdefault(membership.room_id, []).append((pilot_id, membership.pilot.name.lower()))
        if pilot_id in pilot_ids:
            yours.setdefault(membership.room_id, []).append(
                {'pilot_id': pilot_id, 'joined_at': _time(membership.joined_at), 'last_saved_position': _position(membership.position)})

    mission_events, prompts = [], []
    for entry in MissionEvent.objects.filter(room__in=rooms).order_by('created_at', 'id'):
        asker = _asked_by(entry, pilot_ids, members)
        squad = codes[entry.room_id]
        mission_events.append({'squad': squad, 'kind': entry.kind, 'message': entry.message, 'created_at': _time(entry.created_at), 'asked_by_you': asker is not None})
        if asker is not None:
            data = entry.data
            prompts.append({'squad': squad, 'pilot_id': asker, 'callsign': data.get('pilot'), 'prompt': data.get('prompt'),
                            'ora_reply': entry.message, 'source': data.get('source'), 'created_at': _time(entry.created_at)})

    return {
        'format': FORMAT, 'version': VERSION, 'exported_at': _time(now), 'notes': NOTES,
        'account': {
            'email': account.email,
            'email_verified_at': _time(account.email_verified_at),
            # Kept after an email change so a recovery key can still find the account.
            'previous_email': account.previous_email or None,
            'created_at': _time(account.created_at),
            'last_sign_in': _time(account.user.last_login),
            'recovery_keys': {'created_at': _time(account.recovery_created_at), 'unused': RECOVERY_KEY_COUNT - len(account.recovery_used)}
            if account.recovery_nonce else None,
        },
        'pilots': [{'id': str(pilot.id), 'callsign': pilot.name, 'created_at': _time(pilot.created_at)} for pilot in pilots],
        'squads': [{
            'code': room.code, 'name': room.name,
            'destination': room.snapshot.get('level', 'verdant') if isinstance(room.snapshot, dict) else None,
            'invite_only': room.private, 'status': room.status, 'score': room.score,
            'created_at': _time(room.created_at), 'finished_at': _time(room.finished_at),
            'created_by_you': str(room.owner_id) in pilot_ids,
            'your_pilots': yours.get(room.pk, []),
        } for room in rooms],
        'mission_events': mission_events,
        'ora_prompts': prompts,
    }
