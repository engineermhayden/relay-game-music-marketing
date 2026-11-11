import io
from types import SimpleNamespace
from unittest.mock import patch

import redis
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core import mail
from django.core.management import call_command
from django.test import SimpleTestCase, override_settings

from game.models import Membership, MissionEvent, Pilot, Room
from game.simulation import event
from game.state import locked_room, persist

from .deletion import PROMPT_REMOVED, Scrubber
from .models import USER_SELF_DELETION, Account
from .tests import PASSWORD, AccountTestCase

CALLSIGN = 'Zephyrine Quill'
EMAIL = 'zephyrine.quill@example.com'
SECRET_PROMPT = 'I live at 12 Elm Street, send a storm'


@override_settings(ANTHROPIC_API_KEY='')
class AccountDeletionTests(AccountTestCase):
    """Self-service deletion against real PostGIS and Redis (database 15)."""

    def setUp(self):
        self.redis = redis.Redis.from_url(settings.REDIS_URL.rsplit('/', 1)[0] + '/15', decode_responses=True)
        for target in ['game.state.store', 'game.views.store', 'game.ai.store']:
            replacement = patch(target, self.redis)
            replacement.start()
            self.addCleanup(replacement.stop)
        super().setUp()
        # The account's pilot creates a squad, writes to ORA, and plays.
        self.post('/api/session/', {'name': CALLSIGN})
        self.signup(EMAIL)
        self.code = self.post('/api/rooms/', {}).json()['room']['code']
        self.assertEqual(self.post(f'/api/rooms/{self.code}/ai/', {'prompt': SECRET_PROMPT}).status_code, 200)
        # A guest squadmate mentions them by name.
        self.friend = self.browser()
        self.post('/api/session/', {'name': 'Other Ace'}, self.friend)
        self.post('/api/rooms/join/', {'code': self.code}, self.friend)
        self.redis.delete(f'ai:room:{self.code}')
        self.assertEqual(self.post(f'/api/rooms/{self.code}/ai/', {'prompt': 'Follow zephyrine quill to the relay'}, self.friend).status_code, 200)
        with locked_room(self.code) as state:
            pilot_id = str(Pilot.objects.get(name=CALLSIGN).id)
            event(state, 'scan', f"{state['players'][pilot_id]['name']} released a survey pulse.")
            state['score'] = 350
            persist(self.code, state)
        mail.outbox.clear()

    def tearDown(self):
        for room in Room.objects.all():
            self.redis.delete(f'room:{room.code}', f'lock:{room.code}', f'ai:room:{room.code}')
            self.redis.srem('active_rooms', room.code)
        for pilot in Pilot.objects.all():
            self.redis.delete(f'create:{pilot.id}', f'ai:cooldown:{pilot.id}')

    def delete(self, client=None, **data):
        return self.post('/api/account/delete/', {'password': PASSWORD, 'confirm': True, **data}, client)

    def everything(self):
        """The whole database plus live room state, as one lowercase string."""
        dump = io.StringIO()
        call_command('dumpdata', stdout=dump)
        return (dump.getvalue() + self.redis.get(f'room:{self.code}')).lower()

    def test_deletion_erases_personal_data_everywhere(self):
        self.assertIn(CALLSIGN.lower(), self.everything())
        response = self.delete()
        self.assertEqual(response.status_code, 200, response.content)
        self.assertTrue(response.json()['deleted'])
        self.assertIsNone(response.json()['account'])
        stored = self.everything()
        for personal in [EMAIL, CALLSIGN, 'zephyrine', '12 elm street', "quill's expedition"]:
            self.assertNotIn(personal.lower(), stored, personal)
        # Only the deleted player's data is touched.
        self.assertIn('other ace', stored)
        self.assertIn('follow ', stored)

    def test_deletion_keeps_anonymous_gameplay_history(self):
        account = Account.objects.get()
        pilot = Pilot.objects.get(name=CALLSIGN)
        before = {'events': MissionEvent.objects.count(), 'members': Membership.objects.count(), 'room': Room.objects.values('seed', 'score', 'status', 'created_at').get()}
        self.delete()
        account.refresh_from_db()
        self.assertEqual(account.deletion_reason, USER_SELF_DELETION)
        self.assertIsNotNone(account.deleted_at)
        self.assertRegex(account.email, r'^[0-9a-f]{64}@deleted\.invalid$')
        self.assertEqual((account.previous_email, account.recovery_nonce, account.recovery_used), ('', '', []))
        self.assertIsNotNone(account.created_at)
        user = account.user
        self.assertEqual(user.email, account.email)
        self.assertRegex(user.username, r'^deleted-[0-9a-f]{32}$')
        self.assertFalse(user.is_active)
        self.assertFalse(user.has_usable_password())
        pilot.refresh_from_db()
        self.assertRegex(pilot.name, r'^[0-9a-f]{24}$')
        self.assertEqual(pilot.account, account)  # Still linked for analytics.
        room = Room.objects.get()
        self.assertRegex(room.name, r'^[0-9a-f]{48}$')  # Squad names are free text the owner wrote.
        self.assertEqual(room.owner, pilot)
        self.assertEqual(Room.objects.values('seed', 'score', 'status', 'created_at').get(), before['room'])
        self.assertEqual(room.snapshot['players'][str(pilot.id)]['name'], pilot.name)
        self.assertTrue(any(pilot.name in e['message'] for e in room.snapshot['events']))
        self.assertEqual((MissionEvent.objects.count(), Membership.objects.count()), (before['events'], before['members']))
        own = MissionEvent.objects.get(data__pilot_id=str(pilot.id))
        self.assertEqual((own.data['prompt'], own.data['pilot'], own.data['source']), (PROMPT_REMOVED, pilot.name, 'local'))
        theirs = MissionEvent.objects.exclude(pk=own.pk).get()
        self.assertEqual(theirs.data['prompt'], f'Follow {pilot.name} to the relay')
        self.assertEqual(theirs.data['pilot'], 'Other Ace')

    def test_deletion_signs_out_everywhere_and_frees_the_email(self):
        phone = self.browser()
        self.post('/api/account/login/', {'email': EMAIL, 'password': PASSWORD}, phone)
        keys = self.post('/api/account/recovery-keys/', {'password': PASSWORD}).json()['keys']
        self.delete()
        self.assertIsNone(self.client.get('/api/session/').json()['pilot'])  # This browser leaves the squad.
        self.assertIsNone(phone.get('/api/account/').json()['account'])
        self.assertEqual(self.post('/api/account/login/', {'email': EMAIL, 'password': PASSWORD}).status_code, 400)
        self.assertEqual(self.post('/api/account/recover/', {'email': EMAIL, 'key': keys[0]['key'], 'password': 'brand-new-passphrase'}).status_code, 400)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, [EMAIL])
        self.assertIn('deleted', mail.outbox[0].subject)
        self.post('/api/account/password-reset/', {'email': EMAIL})
        self.assertEqual(len(mail.outbox), 1)  # Nothing left to send to.
        # The person can start over; the new account shares nothing with the old one.
        self.assertEqual(self.signup(EMAIL, client=self.browser()).status_code, 201)
        self.assertEqual(Account.objects.filter(deletion_reason='').get().pilots.count(), 0)
        # The squadmate keeps playing.
        self.assertEqual(self.friend.get(f'/api/rooms/{self.code}/').status_code, 200)

    def test_deletion_requires_password_and_confirmation(self):
        for data in [{'password': 'wrong-password'}, {'confirm': False}, {'confirm': 'yes'}]:
            self.assertEqual(self.delete(**data).status_code, 400, data)
        self.assertEqual(self.post('/api/account/delete/', {'password': PASSWORD, 'confirm': True}, self.browser()).status_code, 403)
        self.assertEqual(Account.objects.get().deletion_reason, '')
        self.assertIn(CALLSIGN.lower(), self.everything())

    def test_full_length_squad_name_mentioning_the_callsign(self):
        # The random replacement is longer than the callsign, and squad names can fill their column.
        name = (CALLSIGN + ' and friends ' + 'z' * 48)[:48]
        code = self.post('/api/rooms/', {'name': name}, self.friend).json()['room']['code']
        self.assertEqual(self.post('/api/rooms/join/', {'code': code}).status_code, 200)
        self.assertEqual(self.delete().status_code, 200)
        self.assertNotIn(CALLSIGN.lower(), Room.objects.get(code=code).name.lower())

    def test_redis_outage_changes_nothing(self):
        with patch.object(self.redis, 'exists', side_effect=redis.exceptions.ConnectionError('down')):
            response = self.delete()
        self.assertEqual(response.status_code, 503)
        self.assertIn('Nothing was changed', response.json()['detail'])
        self.assertEqual(Account.objects.get().email, EMAIL)
        self.assertTrue(Pilot.objects.filter(name=CALLSIGN).exists())
        self.assertIsNotNone(self.client.get('/api/account/').json()['account'])
        self.assertEqual(len(mail.outbox), 0)


class ScrubberTests(SimpleTestCase):
    def test_whole_words_any_case_and_special_characters(self):
        scrubber = Scrubber([SimpleNamespace(id='a', name='Ace'), SimpleNamespace(id='b', name='A.C.E (1)'), SimpleNamespace(id='c', name='Ace Two')])
        ace, dotted, two = (scrubber.names[key][1] for key in 'abc')
        self.assertEqual(scrubber.text('ACE, Acer and ace-two met Ace Two and A.C.E (1).'), f'{ace}, Acer and {ace}-two met {two} and {dotted}.')
        self.assertEqual(scrubber.text('AxCxE (1)'), 'AxCxE (1)')  # Dots are literal.
        self.assertIsNone(scrubber.text(None))
        self.assertTrue(scrubber.owns({'pilot': 'ace'}))
        self.assertFalse(scrubber.owns({'pilot': 'Ace', 'pilot_id': 'other'}))  # The ID decides when present.
