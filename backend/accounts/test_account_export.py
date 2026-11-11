import json
from unittest.mock import patch

import redis
from django.conf import settings
from django.test import override_settings

from game.models import MissionEvent, Pilot, Room

from .models import Account
from .tests import PASSWORD, AccountTestCase

CALLSIGN = 'Zephyrine Quill'
EMAIL = 'zephyrine.quill@example.com'
PROMPT = 'Plot a course past the north relay'
FRIEND = 'Other Ace'
FRIEND_PROMPT = 'Keep my hideout at 12 Elm Street secret'


@override_settings(ANTHROPIC_API_KEY='')
class AccountExportTests(AccountTestCase):
    """The self-service data export against real PostGIS and Redis (database 15)."""

    def setUp(self):
        self.redis = redis.Redis.from_url(settings.REDIS_URL.rsplit('/', 1)[0] + '/15', decode_responses=True)
        for target in ['game.state.store', 'game.views.store', 'game.ai.store']:
            replacement = patch(target, self.redis)
            replacement.start()
            self.addCleanup(replacement.stop)
        super().setUp()
        # The account's pilot launches an invite-only squad and asks ORA something.
        self.post('/api/session/', {'name': CALLSIGN})
        self.signup(EMAIL)
        self.code = self.post('/api/rooms/', {'name': 'Quill survey', 'private': True}).json()['room']['code']
        self.assertEqual(self.post(f'/api/rooms/{self.code}/ai/', {'prompt': PROMPT}).status_code, 200)
        # A guest squadmate asks ORA too, then launches a squad of their own that the account joins.
        self.friend = self.browser()
        self.post('/api/session/', {'name': FRIEND}, self.friend)
        self.post('/api/rooms/join/', {'code': self.code}, self.friend)
        self.redis.delete(f'ai:room:{self.code}')
        self.assertEqual(self.post(f'/api/rooms/{self.code}/ai/', {'prompt': FRIEND_PROMPT}, self.friend).status_code, 200)
        self.joined = self.post('/api/rooms/', {'name': 'Borrowed beacon'}, self.friend).json()['room']['code']
        self.assertEqual(self.post('/api/rooms/join/', {'code': self.joined}).status_code, 200)
        # A squad this account never flew in.
        stranger = self.browser()
        self.post('/api/session/', {'name': 'Stranger'}, stranger)
        self.unrelated = self.post('/api/rooms/', {'name': 'Unrelated outpost'}, stranger).json()['room']['code']

    def tearDown(self):
        for room in Room.objects.all():
            self.redis.delete(f'room:{room.code}', f'lock:{room.code}', f'ai:room:{room.code}')
            self.redis.srem('active_rooms', room.code)
        for pilot in Pilot.objects.all():
            self.redis.delete(f'create:{pilot.id}', f'ai:cooldown:{pilot.id}')

    def export(self, password=PASSWORD, client=None):
        return self.post('/api/account/export/', {'password': password}, client)

    def test_export_is_a_json_file_of_the_players_data(self):
        response = self.export()
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response['Content-Type'], 'application/json')
        self.assertRegex(response['Content-Disposition'], r'^attachment; filename="relay-account-data-\d{4}-\d{2}-\d{2}\.json"$')
        self.assertEqual(response['Cache-Control'], 'no-store')
        data = json.loads(response.content)
        self.assertEqual((data['format'], data['version']), ('relay-account-data', 1))

        account = Account.objects.get()
        self.assertEqual(data['account'], {
            'email': EMAIL, 'email_verified_at': None, 'previous_email': None, 'created_at': account.created_at.isoformat(),
            'last_sign_in': account.user.last_login.isoformat(), 'recovery_keys': None,
        })
        pilot = Pilot.objects.get(name=CALLSIGN)
        self.assertEqual(data['pilots'], [{'id': str(pilot.id), 'callsign': CALLSIGN, 'created_at': pilot.created_at.isoformat()}])

        squads = {squad['code']: squad for squad in data['squads']}
        self.assertEqual(set(squads), {self.code, self.joined})
        own, joined = squads[self.code], squads[self.joined]
        self.assertEqual((own['name'], own['destination'], own['invite_only'], own['status'], own['created_by_you']), ('Quill survey', 'verdant', True, 'active', True))
        self.assertEqual((joined['name'], joined['invite_only'], joined['created_by_you']), ('Borrowed beacon', False, False))
        for squad in (own, joined):
            self.assertEqual(len(squad['your_pilots']), 1)
            self.assertEqual(squad['your_pilots'][0]['pilot_id'], str(pilot.id))
            self.assertEqual(squad['your_pilots'][0]['last_saved_position'], {'x': 0, 'z': 0})

        mine = MissionEvent.objects.get(data__pilot_id=str(pilot.id))
        self.assertEqual(data['ora_prompts'], [{
            'squad': self.code, 'pilot_id': str(pilot.id), 'callsign': CALLSIGN, 'prompt': PROMPT,
            'ora_reply': mine.message, 'source': 'local', 'created_at': mine.created_at.isoformat(),
        }])
        # The squad's whole ORA journal, marked by who asked, without the squadmate's prompt.
        self.assertEqual([(e['squad'], e['kind'], e['asked_by_you']) for e in data['mission_events']], [(self.code, 'ai', True), (self.code, 'ai', False)])
        self.assertTrue(all(e['message'] for e in data['mission_events']))

    def test_export_leaves_out_credentials_and_other_players_data(self):
        keys = [k['key'] for k in self.post('/api/account/recovery-keys/', {'password': PASSWORD}).json()['keys']]
        account = Account.objects.select_related('user').get()
        response = self.export()
        text = response.content.decode()
        data = json.loads(text)
        self.assertEqual(data['account']['recovery_keys'], {'created_at': account.recovery_created_at.isoformat(), 'unused': 8})
        secrets = [*keys, *(key.replace('-', '') for key in keys), account.user.password, account.recovery_nonce, PASSWORD, 'pbkdf2',
                   self.client.cookies['sessionid'].value]
        for secret in secrets:
            self.assertNotIn(secret, text)
        for other in [FRIEND, FRIEND_PROMPT, '12 Elm Street', 'Stranger', 'Unrelated outpost']:
            self.assertNotIn(other.lower(), text.lower(), other)
        self.assertNotIn(self.unrelated, [squad['code'] for squad in data['squads']])

    def test_export_requires_sign_in_csrf_and_the_current_password(self):
        self.assertEqual(self.export(client=self.browser()).status_code, 403)  # Signed out.
        for body in [{'password': 'wrong-password'}, {'password': ''}, {}]:
            response = self.post('/api/account/export/', body)
            self.assertEqual(response.status_code, 400, body)
            self.assertFalse(response.has_header('Content-Disposition'))
        self.client.credentials()  # No CSRF token.
        self.assertEqual(self.client.post('/api/account/export/', {'password': PASSWORD}, format='json').status_code, 403)

    @override_settings(ACCOUNT_LOGIN_FAILURES_PER_EMAIL=2)
    def test_wrong_passwords_count_toward_the_sign_in_lockout(self):
        for _ in range(2):
            self.assertEqual(self.export('wrong-password').status_code, 400)
        self.assertEqual(self.export().status_code, 429)

    def test_older_journal_entries_count_only_when_the_callsign_is_unambiguous(self):
        # Before pilot IDs were recorded, journal entries named only the callsign.
        room = Room.objects.get(code=self.code)
        MissionEvent.objects.create(room=room, kind='ai', message='Legacy reply', data={'prompt': 'An old question', 'source': 'local', 'pilot': CALLSIGN.upper()})
        prompts = json.loads(self.export().content)['ora_prompts']
        self.assertEqual([p['prompt'] for p in prompts], [PROMPT, 'An old question'])
        self.assertEqual(prompts[1]['pilot_id'], str(Pilot.objects.get(name=CALLSIGN).id))
        # Once another member of that squad flies under the same callsign, the entry could be theirs.
        namesake = self.browser()
        self.post('/api/session/', {'name': CALLSIGN.lower()}, namesake)
        self.assertEqual(self.post('/api/rooms/join/', {'code': self.code}, namesake).status_code, 200)
        data = json.loads(self.export().content)
        self.assertEqual([p['prompt'] for p in data['ora_prompts']], [PROMPT])
        self.assertFalse(next(e for e in data['mission_events'] if e['message'] == 'Legacy reply')['asked_by_you'])

    def test_an_account_without_pilots_exports_empty_lists(self):
        fresh = self.browser()
        self.signup('fresh@example.com', client=fresh)
        data = json.loads(self.export(client=fresh).content)
        self.assertEqual(data['account']['email'], 'fresh@example.com')
        self.assertEqual((data['pilots'], data['squads'], data['mission_events'], data['ora_prompts']), ([], [], [], []))
