import re

from django.contrib.auth import get_user_model
from django.core import mail

from game.models import Pilot

from .models import Account
from .tests import PASSWORD, AccountTestCase, link_params

NEW_PASSWORD = 'amber-beacon-signal-77'


class AccountChangeTests(AccountTestCase):
    """Email/password changes, recovery keys and account recovery."""

    def setUp(self):
        super().setUp()
        self.signup('pilot@example.com')
        mail.outbox.clear()

    def login(self, email='pilot@example.com', password=PASSWORD, client=None):
        return self.post('/api/account/login/', {'email': email, 'password': password}, client)

    def keys(self, regenerate=False, client=None):
        response = self.post('/api/account/recovery-keys/', {'password': PASSWORD, 'regenerate': regenerate}, client)
        self.assertEqual(response.status_code, 200, response.content)
        return response.json()

    def change(self, client=None, **data):
        return self.post('/api/account/change/', {'current_password': PASSWORD, **data}, client)

    def change_email(self, new_email='new@example.com', **extra):
        keys = self.keys()
        response = self.change(new_email=new_email, recovery_set=keys['recovery_set'], keys_confirmed=True, **extra)
        self.assertEqual(response.status_code, 200, response.content)
        return keys, response.json()

    def signed_in(self, client=None):
        return (client or self.client).get('/api/account/').json()['account'] is not None

    def test_recovery_keys_are_stable_until_regenerated(self):
        first = self.keys()
        self.assertEqual(len(first['keys']), 8)
        for item in first['keys']:
            self.assertRegex(item['key'], r'^\d{4}-\d{4}-\d{4}$')
            self.assertFalse(item['used'])
        self.assertEqual(len({item['key'] for item in first['keys']}), 8)
        # An abandoned email change shows the same keys next time.
        again = self.keys()
        self.assertEqual((again['keys'], again['recovery_set']), (first['keys'], first['recovery_set']))
        self.assertEqual(self.client.get('/api/account/').json()['account']['recovery_keys_remaining'], 8)
        # Keys are derived, never stored.
        account = Account.objects.get()
        for item in first['keys']:
            self.assertNotIn(item['key'].replace('-', ''), str(account.__dict__))
        regenerated = self.keys(regenerate=True)
        self.assertNotEqual(regenerated['recovery_set'], first['recovery_set'])
        self.assertFalse({k['key'] for k in regenerated['keys']} & {k['key'] for k in first['keys']})

    def test_recovery_keys_require_a_signed_in_password_check(self):
        self.assertEqual(self.post('/api/account/recovery-keys/', {'password': 'wrong-password'}).status_code, 400)
        self.assertEqual(self.post('/api/account/recovery-keys/', {}).status_code, 400)
        self.assertEqual(self.post('/api/account/recovery-keys/', {'password': PASSWORD}, self.browser()).status_code, 403)
        self.assertEqual(Account.objects.get().recovery_nonce, '')

    def test_validate_only_changes_nothing(self):
        keys = self.keys()
        for data in [{'new_email': 'new@example.com'}, {'new_password': NEW_PASSWORD},
                     {'new_email': 'new@example.com', 'new_password': NEW_PASSWORD, 'recovery_set': keys['recovery_set'], 'keys_confirmed': True}]:
            response = self.change(validate_only=True, **data)
            self.assertEqual(response.status_code, 200, response.content)
            self.assertTrue(response.json()['valid'])
        self.assertTrue(self.signed_in())
        account = Account.objects.select_related('user').get()
        self.assertEqual(account.email, 'pilot@example.com')
        self.assertTrue(account.user.check_password(PASSWORD))
        self.assertEqual(len(mail.outbox), 0)

    def test_change_validation(self):
        other = self.browser()
        self.signup('taken@example.com', client=other)
        for data, reason in [({}, 'new email, a new password'), ({'new_email': 'not-an-email'}, 'valid email'),
                             ({'new_email': 'PILOT@example.com'}, 'already your email'), ({'new_email': 'Taken@Example.com'}, 'Another account'),
                             ({'new_password': 'short'}, 'too short'), ({'new_password': 'password123'}, 'too common'),
                             ({'new_email': 'new@example.com'}, 'recovery keys')]:
            response = self.change(**data)
            self.assertEqual(response.status_code, 400, data)
            self.assertIn(reason, ' '.join(response.json()), data)
        self.assertEqual(self.post('/api/account/change/', {'current_password': 'wrong-password', 'new_password': NEW_PASSWORD}).json(), ['Your current password is incorrect.'])
        self.assertEqual(self.post('/api/account/change/', {'new_password': NEW_PASSWORD}, self.browser()).status_code, 403)
        self.assertEqual(Account.objects.get(email='pilot@example.com').session_epoch, 0)

    def test_email_change_requires_confirming_the_keys_that_were_shown(self):
        shown = self.keys()
        self.keys(regenerate=True)  # For example, regenerated in another tab.
        for extra in [{}, {'keys_confirmed': False, 'recovery_set': shown['recovery_set']}, {'keys_confirmed': True, 'recovery_set': shown['recovery_set']}]:
            self.assertEqual(self.change(new_email='new@example.com', **extra).status_code, 400)
        self.assertEqual(Account.objects.get().email, 'pilot@example.com')
        self.assertTrue(self.signed_in())

    def test_password_change_signs_out_everywhere(self):
        phone = self.browser()
        self.login(client=phone)
        pilot = self.post('/api/session/', {'name': 'Phone pilot'}, phone).json()['pilot']['id']
        response = self.change(new_password=NEW_PASSWORD)
        self.assertEqual(response.status_code, 200, response.content)
        self.assertIsNone(response.json()['account'])
        self.assertTrue(response.json()['password_changed'])
        self.assertFalse(response.json()['email_changed'])
        self.assertFalse(self.signed_in())
        self.assertFalse(self.signed_in(phone))
        self.assertIsNone(phone.get('/api/session/').json()['pilot'])
        self.assertEqual(Pilot.objects.get(id=pilot).account, Account.objects.get())  # Play history stays.
        self.assertEqual(self.login().status_code, 400)
        self.assertEqual(self.login(password=NEW_PASSWORD).status_code, 200)
        self.assertEqual(len(mail.outbox), 0)

    def test_email_change_deactivates_until_the_new_address_is_confirmed(self):
        phone = self.browser()
        self.login(client=phone)
        _, body = self.change_email('New@Example.com')
        self.assertTrue(body['email_changed'])
        self.assertTrue(body['activation_sent'])
        self.assertEqual(body['email'], 'New@example.com')
        self.assertFalse(self.signed_in())
        self.assertFalse(self.signed_in(phone))
        account = Account.objects.select_related('user').get()
        self.assertEqual((account.email, account.user.email, account.previous_email), ('New@example.com', 'New@example.com', 'pilot@example.com'))
        self.assertFalse(account.user.is_active)
        self.assertTrue(account.activation_required)
        self.assertFalse(account.email_verified)
        self.assertTrue(account.user.check_password(PASSWORD))  # Unchanged.
        activation, notice = mail.outbox
        self.assertEqual(activation.to, ['New@example.com'])
        self.assertIn('reactivate', activation.body)
        self.assertEqual(notice.to, ['pilot@example.com'])
        self.assertIn('recovery key', notice.body)

        # Deactivated: the old email no longer signs in; the new one explains how to reactivate.
        self.assertEqual(self.login().json(), ['Email or password is incorrect.'])
        self.assertEqual(self.login('new@example.com', 'wrong-password').json(), ['Email or password is incorrect.'])
        pending = self.login('new@example.com')
        self.assertEqual(pending.status_code, 403)
        self.assertTrue(pending.json()['activation_required'])
        self.assertFalse(self.signed_in())
        # Password resets for the old address go nowhere; the old address is held meanwhile.
        self.post('/api/account/password-reset/', {'email': 'pilot@example.com'})
        self.assertEqual(len(mail.outbox), 2)
        self.assertEqual(self.signup('pilot@example.com', client=self.browser()).status_code, 400)

        # The CAPTCHA-protected sign-in issued a token to request a new link without signing in.
        # Passwords are not accepted there, so it cannot be used to guess them around the CAPTCHA.
        self.assertEqual(self.post('/api/account/verify-email/resend/', {'email': 'new@example.com', 'password': PASSWORD}).status_code, 403)
        self.assertEqual(self.post('/api/account/verify-email/resend/', {'resend_token': pending.json()['resend_token'][:-2] + 'xx'}).status_code, 400)
        resent = self.post('/api/account/verify-email/resend/', {'resend_token': pending.json()['resend_token']})
        self.assertEqual(resent.status_code, 200, resent.content)
        self.assertTrue(resent.json()['verification_sent'])
        _, params = link_params(mail.outbox[-1])
        verified = self.post('/api/account/verify-email/', {'token': params['token']}, self.browser())
        self.assertEqual(verified.status_code, 200, verified.content)
        self.assertTrue(verified.json()['reactivated'])
        account.refresh_from_db()
        account.user.refresh_from_db()
        self.assertTrue(account.user.is_active)
        self.assertTrue(account.email_verified)
        self.assertFalse(account.activation_required)

        # Reactivation does not revive earlier sessions; signing in again is required.
        self.assertFalse(self.signed_in(phone))
        self.assertEqual(self.login('new@example.com').status_code, 200)
        self.assertTrue(self.signed_in())
        self.assertEqual(self.signup('pilot@example.com', client=self.browser()).status_code, 201)  # Released.

    def test_email_and_password_change_together(self):
        _, body = self.change_email('new@example.com', new_password=NEW_PASSWORD)
        self.assertTrue(body['email_changed'] and body['password_changed'])
        _, params = link_params(mail.outbox[0])
        self.post('/api/account/verify-email/', {'token': params['token']})
        self.assertEqual(self.login('new@example.com').status_code, 400)
        self.assertEqual(self.login('new@example.com', NEW_PASSWORD).status_code, 200)

    def test_old_verification_links_cannot_activate_a_changed_email(self):
        self.post('/api/account/verify-email/resend/')
        _, old_link = link_params(mail.outbox[-1])
        self.change_email()
        self.assertEqual(self.post('/api/account/verify-email/', {'token': old_link['token']}).status_code, 400)
        self.assertFalse(get_user_model().objects.get().is_active)

    def test_password_reset_reactivates_from_the_new_address(self):
        self.change_email()
        mail.outbox.clear()
        self.post('/api/account/password-reset/', {'email': 'new@example.com'})
        self.assertEqual(mail.outbox[0].to, ['new@example.com'])
        _, params = link_params(mail.outbox[0])
        response = self.post('/api/account/password-reset/confirm/', {'uid': params['uid'], 'token': params['token'], 'password': NEW_PASSWORD})
        self.assertEqual(response.status_code, 200, response.content)
        self.assertTrue(response.json()['account']['email_verified'])
        self.assertTrue(get_user_model().objects.get().is_active)
        self.assertFalse(Account.objects.get().activation_required)

    def test_recovery_key_restores_an_unconfirmed_email_change(self):
        keys, _ = self.change_email('typo@exampel.com')
        key = keys['keys'][2]['key']
        other = self.browser()
        self.assertEqual(self.post('/api/account/recover/', {'email': 'pilot@example.com', 'key': '0000-0000-0000', 'password': NEW_PASSWORD}, other).status_code, 400)
        response = self.post('/api/account/recover/', {'email': 'pilot@example.com', 'key': key.replace('-', ' '), 'password': NEW_PASSWORD}, other)
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()['account']['email'], 'pilot@example.com')
        self.assertFalse(response.json()['account']['email_verified'])  # As it was before the change.
        self.assertEqual(response.json()['account']['recovery_keys_remaining'], 7)
        self.assertTrue(self.signed_in(other))
        account = Account.objects.select_related('user').get()
        self.assertEqual((account.user.email, account.previous_email, account.activation_required), ('pilot@example.com', '', False))
        self.assertTrue(account.user.is_active)
        self.assertTrue(account.user.check_password(NEW_PASSWORD))
        # The activation link for the abandoned address no longer works.
        _, params = link_params(mail.outbox[0])
        self.assertEqual(self.post('/api/account/verify-email/', {'token': params['token']}).status_code, 400)
        # Used keys cannot be used again, and are marked used.
        again = self.post('/api/account/recover/', {'email': 'pilot@example.com', 'key': key, 'password': 'another-new-passphrase'}, self.browser())
        self.assertEqual(again.status_code, 400)
        listed = self.post('/api/account/recovery-keys/', {'password': NEW_PASSWORD}, other).json()
        self.assertEqual([item['used'] for item in listed['keys']], [False, False, True, False, False, False, False, False])
        self.assertEqual(listed['recovery_set'], keys['recovery_set'])

    def test_recovery_after_a_confirmed_change_accepts_the_previous_email(self):
        keys, _ = self.change_email()
        _, params = link_params(mail.outbox[0])
        self.post('/api/account/verify-email/', {'token': params['token']})
        phone = self.browser()
        self.login('new@example.com', client=phone)
        response = self.post('/api/account/recover/', {'email': 'pilot@example.com', 'key': keys['keys'][0]['key'], 'password': NEW_PASSWORD})
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()['account']['email'], 'new@example.com')  # Confirmed changes stay.
        self.assertFalse(self.signed_in(phone))  # Recovery signs out everywhere else.

    def test_recovery_rejects_regenerated_keys_and_staff_deactivation(self):
        old = self.keys()
        new = self.keys(regenerate=True)
        self.post('/api/account/logout/')
        self.assertEqual(self.post('/api/account/recover/', {'email': 'pilot@example.com', 'key': old['keys'][0]['key'], 'password': NEW_PASSWORD}).status_code, 400)
        get_user_model().objects.update(is_active=False)
        self.assertEqual(self.post('/api/account/recover/', {'email': 'pilot@example.com', 'key': new['keys'][0]['key'], 'password': NEW_PASSWORD}).status_code, 400)
        for data in [{}, {'email': 'pilot@example.com'}, {'email': 'pilot@example.com', 'key': new['keys'][1]['key']}]:
            self.assertEqual(self.post('/api/account/recover/', data).status_code, 400)
        self.assertFalse(get_user_model().objects.get().is_active)

    def test_recovery_attempts_are_limited(self):
        self.keys()
        for _ in range(10):
            self.post('/api/account/recover/', {'email': 'pilot@example.com', 'key': '1234-5678-9012', 'password': NEW_PASSWORD})
        self.assertEqual(self.post('/api/account/recover/', {'email': 'pilot@example.com', 'key': '1234-5678-9012', 'password': NEW_PASSWORD}).status_code, 429)

    def test_wrong_current_passwords_count_toward_the_lockout(self):
        for _ in range(10):
            self.post('/api/account/change/', {'current_password': 'wrong-password', 'new_password': NEW_PASSWORD})
        self.assertEqual(self.change(new_password=NEW_PASSWORD).status_code, 429)

    def test_staff_deactivation_is_not_undone_by_verification(self):
        self.post('/api/account/verify-email/resend/')
        _, params = link_params(mail.outbox[-1])
        get_user_model().objects.update(is_active=False)
        self.assertEqual(self.post('/api/account/verify-email/', {'token': params['token']}).status_code, 200)
        self.assertFalse(get_user_model().objects.get().is_active)
        self.assertFalse(self.signed_in())

    def test_email_text_contains_no_keys(self):
        keys, _ = self.change_email()
        digits = {item['key'] for item in keys['keys']}
        for message in mail.outbox:
            self.assertFalse(digits & set(re.findall(r'\d{4}-\d{4}-\d{4}', message.body)))
