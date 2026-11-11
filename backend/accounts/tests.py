import re
import smtplib
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from game.models import Pilot

from .models import Account
from .services import email_verification_token

PASSWORD = 'violet-relay-signal-42'


def link_params(message):
    """Parse the SPA link in an email. Tokens must be in the fragment, never the query."""
    link = re.search(r'https?://\S+', message.body).group(0)
    parts = urlsplit(link)
    assert parts.query == '', link
    return parts, {key: values[0] for key, values in parse_qs(parts.fragment).items()}


CAPTCHA_PATHS = {'/api/account/signup/', '/api/account/login/', '/api/account/password-reset/'}


@override_settings(CACHES={'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}}, PUBLIC_SITE_URL='', ACCOUNT_CAPTCHA_TEST_MODE=True)
class AccountTestCase(TestCase):
    """Shared browser helpers. Run with docker compose exec api python manage.py test accounts."""

    def setUp(self):
        cache.clear()
        self.client = self.browser()

    def browser(self):
        client = APIClient(enforce_csrf_checks=True)
        client.credentials(HTTP_X_CSRFTOKEN=client.get('/api/session/').json()['csrf'])
        return client

    def captcha(self, client=None):
        """A real single-use challenge, answered with the test-mode answer."""
        return {'captcha_id': (client or self.client).get('/api/account/captcha/').json()['captcha_id'], 'captcha_answer': 'PASSED'}

    def post(self, path, data=None, client=None):
        client = client or self.client
        if path in CAPTCHA_PATHS and isinstance(data, dict) and 'captcha_id' not in data:
            data = {**data, **self.captcha(client)}
        elif path in CAPTCHA_PATHS and data is None:
            data = self.captcha(client)
        response = client.post(path, data or {}, format='json')
        # login() rotates the CSRF token; keep the browser's token current like the SPA does.
        if response.headers.get('Content-Type', '').startswith('application/json') and 'csrf' in response.json():
            client.credentials(HTTP_X_CSRFTOKEN=response.json()['csrf'])
        return response

    def signup(self, email='Pilot@Example.com', password=PASSWORD, client=None):
        return self.post('/api/account/signup/', {'email': email, 'password': password}, client)


class SessionCookieTests(AccountTestCase):
    def test_poll_sent_before_sign_in_finished_keeps_the_new_session(self):
        self.post('/api/session/', {'name': 'Racer'})
        old_cookie = self.client.cookies['sessionid'].value
        self.signup()
        self.assertNotEqual(self.client.cookies['sessionid'].value, old_cookie)
        late = self.browser()
        late.cookies['sessionid'] = old_cookie
        response = late.get('/api/music/tracks/')
        self.assertEqual(response.status_code, 200)
        self.assertNotIn('sessionid', response.cookies)

    def test_signing_out_still_clears_the_cookie(self):
        self.signup()
        self.assertEqual(self.post('/api/account/logout/').cookies['sessionid'].value, '')

    def test_session_ended_elsewhere_still_clears_the_cookie(self):
        self.signup()
        Account.objects.update(session_epoch=1)
        self.assertEqual(self.client.get('/api/music/tracks/').cookies['sessionid'].value, '')


class AccountTests(AccountTestCase):
    def test_signup_signs_in_and_sends_verification_link(self):
        response = self.signup()
        self.assertEqual(response.status_code, 201, response.content)
        body = response.json()
        self.assertEqual(body['account']['email'], 'Pilot@example.com')  # Domain normalized.
        self.assertFalse(body['account']['email_verified'])
        self.assertTrue(body['verification_sent'])
        user = get_user_model().objects.get(account__email='Pilot@example.com')
        self.assertFalse(user.is_staff)
        self.assertNotEqual(user.password, PASSWORD)
        self.assertTrue(user.check_password(PASSWORD))
        self.assertEqual(self.client.get('/api/account/').json()['account']['email'], 'Pilot@example.com')
        self.assertEqual(self.client.get('/api/session/').json()['account']['email'], 'Pilot@example.com')
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ['Pilot@example.com'])
        parts, params = link_params(mail.outbox[0])
        self.assertEqual((parts.scheme, parts.netloc, parts.path), ('http', 'testserver', '/'))
        self.assertEqual(params['account'], 'verify-email')

        response = self.post('/api/account/verify-email/', {'token': params['token']})
        self.assertEqual(response.status_code, 200, response.content)
        self.assertTrue(response.json()['account']['email_verified'])
        # Reusing a verification link is harmless.
        self.assertEqual(self.post('/api/account/verify-email/', {'token': params['token']}).status_code, 200)

    def test_verification_link_works_in_a_signed_out_browser(self):
        self.signup()
        _, params = link_params(mail.outbox[0])
        other = self.browser()
        response = self.post('/api/account/verify-email/', {'token': params['token']}, other)
        self.assertEqual(response.status_code, 200, response.content)
        self.assertIsNone(response.json()['account'])
        self.assertEqual(response.json()['verified_email'], 'Pilot@example.com')
        self.assertTrue(Account.objects.get().email_verified)

    def test_bad_and_expired_verification_tokens_rejected(self):
        self.signup()
        account = Account.objects.get()
        token = email_verification_token(account)
        for bad in ['', 'nonsense', token[:-2] + 'xx', None, 7, 'x' * 600]:
            self.assertEqual(self.post('/api/account/verify-email/', {'token': bad}).status_code, 400, bad)
        with override_settings(ACCOUNT_EMAIL_VERIFICATION_MAX_AGE=-1):
            self.assertEqual(self.post('/api/account/verify-email/', {'token': token}).status_code, 400)
        # A link issued for a previous address cannot verify a changed one.
        Account.objects.filter(pk=account.pk).update(email='changed@example.com')
        self.assertEqual(self.post('/api/account/verify-email/', {'token': token}).status_code, 400)
        self.assertFalse(Account.objects.get().email_verified)

    def test_signup_validation(self):
        for email in ['', 'not-an-email', 'a@b', None, ['x@example.com'], 'x' * 250 + '@example.com']:
            self.assertEqual(self.signup(email=email).status_code, 400, email)
        for password, reason in [('', 'Enter a password'), ('short1', 'too short'), ('password123', 'too common'), ('8274619305', 'entirely numeric'), ('pilot@example.com', 'too similar'), ('x' * 129, 'at most 128')]:
            response = self.signup(email='pilot@example.com', password=password)
            self.assertEqual(response.status_code, 400, password)
            self.assertIn(reason, ' '.join(response.json()), password)
        self.assertFalse(Account.objects.exists())
        self.assertFalse(get_user_model().objects.exists())
        self.assertEqual(len(mail.outbox), 0)

    def test_email_is_unique_case_insensitively(self):
        self.assertEqual(self.signup('pilot@example.com').status_code, 201)
        response = self.signup('PILOT@EXAMPLE.COM', client=self.browser())
        self.assertEqual(response.status_code, 400)
        self.assertIn('already exists', response.json()[0])
        self.assertEqual(Account.objects.count(), 1)

    def test_staff_email_does_not_block_or_become_player_login(self):
        get_user_model().objects.create_user('editor', 'editor@example.com', PASSWORD, is_staff=True)
        self.assertEqual(self.post('/api/account/login/', {'email': 'editor@example.com', 'password': PASSWORD}).status_code, 400)
        self.assertEqual(self.signup('editor@example.com', 'another-long-passphrase').status_code, 201)

    def test_login_logout_and_generic_errors(self):
        self.signup()
        self.post('/api/account/logout/')
        self.assertIsNone(self.client.get('/api/account/').json()['account'])
        wrong = self.post('/api/account/login/', {'email': 'pilot@example.com', 'password': 'wrong-password'})
        unknown = self.post('/api/account/login/', {'email': 'nobody@example.com', 'password': PASSWORD})
        self.assertEqual((wrong.status_code, unknown.status_code), (400, 400))
        self.assertEqual(wrong.json(), unknown.json())  # Do not reveal which emails exist.
        for bad in [{}, {'email': 'pilot@example.com'}, {'email': 5, 'password': PASSWORD}]:
            self.assertEqual(self.post('/api/account/login/', bad).status_code, 400)
        response = self.post('/api/account/login/', {'email': ' PILOT@example.COM ', 'password': PASSWORD})
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()['account']['email'], 'Pilot@example.com')
        self.assertEqual(self.client.get('/api/account/').json()['account']['email'], 'Pilot@example.com')

    def test_inactive_accounts_cannot_sign_in(self):
        self.signup()
        get_user_model().objects.update(is_active=False)
        self.assertEqual(self.post('/api/account/login/', {'email': 'pilot@example.com', 'password': PASSWORD}, self.browser()).status_code, 400)

    def test_csrf_required_for_account_changes(self):
        self.signup()
        bare = APIClient(enforce_csrf_checks=True)
        bare.get('/api/session/')  # Has the CSRF cookie, but sends no token header.
        for path, data in [('/api/account/signup/', {'email': 'new@example.com', 'password': PASSWORD}),
                           ('/api/account/login/', {'email': 'pilot@example.com', 'password': PASSWORD}),
                           ('/api/account/logout/', {}), ('/api/account/password-reset/', {'email': 'pilot@example.com'})]:
            self.assertEqual(bare.post(path, data, format='json').status_code, 403, path)
        self.assertEqual(Account.objects.count(), 1)

    def test_guest_pilot_and_squad_session_survive_sign_in(self):
        pilot_id = self.post('/api/session/', {'name': 'Guest ace'}).json()['pilot']['id']
        self.signup()
        session = self.client.get('/api/session/').json()
        self.assertEqual(session['pilot']['id'], pilot_id)
        account = Account.objects.get()
        self.assertEqual(Pilot.objects.get(id=pilot_id).account, account)
        # Signing out ends the session, including the pilot bound to the account.
        self.post('/api/account/logout/')
        self.assertIsNone(self.client.get('/api/session/').json()['pilot'])
        # A new guest pilot is not attributed to the signed-out account...
        guest_id = self.post('/api/session/', {'name': 'Guest two'}).json()['pilot']['id']
        self.assertIsNone(Pilot.objects.get(id=guest_id).account)
        # ...until that player signs in again, and pilots created while signed in are linked.
        self.post('/api/account/login/', {'email': 'pilot@example.com', 'password': PASSWORD})
        self.assertEqual(Pilot.objects.get(id=guest_id).account, account)
        self.assertEqual(account.pilots.count(), 2)

    def test_deleting_a_user_keeps_pilots_unlinked(self):
        pilot_id = self.post('/api/session/', {'name': 'Guest ace'}).json()['pilot']['id']
        self.signup()
        get_user_model().objects.all().delete()
        self.assertFalse(Account.objects.exists())
        self.assertIsNone(Pilot.objects.get(id=pilot_id).account)

    def test_pilot_owned_by_another_account_is_not_reassigned(self):
        self.signup('first@example.com')
        first = Account.objects.get()
        self.post('/api/session/', {'name': 'First'})
        self.signup('second@example.com', client=self.browser())
        pilot = Pilot.objects.get(account=first)
        # Simulate a stale session that still holds the first account's pilot.
        other = self.browser()
        session = other.session
        session['pilot_id'] = str(pilot.id)
        session.save()
        self.post('/api/account/login/', {'email': 'second@example.com', 'password': PASSWORD}, other)
        self.assertEqual(Pilot.objects.get(id=pilot.id).account, first)
        self.assertIsNone(other.get('/api/session/').json()['pilot'])

    def test_password_reset_flow(self):
        self.signup()
        self.post('/api/account/logout/')
        mail.outbox.clear()
        unknown = self.post('/api/account/password-reset/', {'email': 'nobody@example.com'})
        known = self.post('/api/account/password-reset/', {'email': 'PILOT@example.com'})
        self.assertEqual((unknown.status_code, known.status_code), (200, 200))
        self.assertEqual(unknown.json()['detail'], known.json()['detail'])
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('Reset', mail.outbox[0].subject)
        _, params = link_params(mail.outbox[0])
        self.assertEqual(params['account'], 'reset-password')

        weak = self.post('/api/account/password-reset/confirm/', {'uid': params['uid'], 'token': params['token'], 'password': 'short'})
        self.assertEqual(weak.status_code, 400)
        response = self.post('/api/account/password-reset/confirm/', {'uid': params['uid'], 'token': params['token'], 'password': 'brand-new-passphrase'})
        self.assertEqual(response.status_code, 200, response.content)
        # Resetting signs in and proves control of the address.
        self.assertEqual(response.json()['account']['email'], 'Pilot@example.com')
        self.assertTrue(response.json()['account']['email_verified'])
        self.assertTrue(get_user_model().objects.get().check_password('brand-new-passphrase'))
        # Links are single use.
        again = self.post('/api/account/password-reset/confirm/', {'uid': params['uid'], 'token': params['token'], 'password': 'another-new-passphrase'})
        self.assertEqual(again.status_code, 400)
        self.post('/api/account/logout/')
        self.assertEqual(self.post('/api/account/login/', {'email': 'pilot@example.com', 'password': PASSWORD}).status_code, 400)
        self.assertEqual(self.post('/api/account/login/', {'email': 'pilot@example.com', 'password': 'brand-new-passphrase'}).status_code, 200)

    def test_password_reset_signs_out_other_sessions(self):
        self.signup()
        other = self.browser()
        self.post('/api/account/login/', {'email': 'pilot@example.com', 'password': PASSWORD}, other)
        self.assertIsNotNone(other.get('/api/account/').json()['account'])
        mail.outbox.clear()
        self.post('/api/account/password-reset/', {'email': 'pilot@example.com'})
        _, params = link_params(mail.outbox[0])
        self.post('/api/account/password-reset/confirm/', {'uid': params['uid'], 'token': params['token'], 'password': 'brand-new-passphrase'})
        self.assertIsNone(other.get('/api/account/').json()['account'])

    def test_bad_reset_links_rejected(self):
        self.signup()
        staff = get_user_model().objects.create_user('editor', 'editor@example.com', PASSWORD, is_staff=True)
        from django.contrib.auth.tokens import default_token_generator
        from django.utils.encoding import force_bytes
        from django.utils.http import urlsafe_base64_encode
        staff_uid = urlsafe_base64_encode(force_bytes(staff.pk))
        for uid, token in [('', ''), ('bad', 'bad'), ('MQ', 'abc-def'), (None, None), (5, 5), ('x' * 100, 'y'),
                           (staff_uid, default_token_generator.make_token(staff))]:  # Staff passwords are not reset here.
            response = self.post('/api/account/password-reset/confirm/', {'uid': uid, 'token': token, 'password': 'brand-new-passphrase'})
            self.assertEqual(response.status_code, 400, (uid, token))
        self.assertTrue(get_user_model().objects.get(pk=staff.pk).check_password(PASSWORD))
        with override_settings(PASSWORD_RESET_TIMEOUT=-1):
            mail.outbox.clear()
            self.post('/api/account/password-reset/', {'email': 'pilot@example.com'})
            _, params = link_params(mail.outbox[0])
            response = self.post('/api/account/password-reset/confirm/', {'uid': params['uid'], 'token': params['token'], 'password': 'brand-new-passphrase'})
            self.assertEqual(response.status_code, 400)

    def test_reset_emails_are_limited_per_address(self):
        self.signup()
        mail.outbox.clear()
        for _ in range(6):
            self.assertEqual(self.post('/api/account/password-reset/', {'email': 'pilot@example.com'}).status_code, 200)
        self.assertEqual(len(mail.outbox), 3)

    @override_settings(ACCOUNT_SIGNUPS_PER_IP_HOUR=2)
    def test_new_accounts_are_limited_per_network_but_typos_are_not(self):
        for attempt in range(5):
            self.assertEqual(self.signup(f'weak{attempt}@example.com', 'short', self.browser()).status_code, 400)
        self.assertEqual(self.signup('one@example.com', client=self.browser()).status_code, 201)
        self.assertEqual(self.signup('two@example.com', client=self.browser()).status_code, 201)
        blocked = self.signup('three@example.com', client=self.browser())
        self.assertEqual(blocked.status_code, 429)
        self.assertIn('Too many new accounts', blocked.json()['detail'])
        self.assertEqual(Account.objects.count(), 2)

    def test_login_failures_are_limited_per_email(self):
        self.signup()
        self.post('/api/account/logout/')
        for _ in range(10):
            self.assertEqual(self.post('/api/account/login/', {'email': 'pilot@example.com', 'password': 'wrong-password'}).status_code, 400)
        blocked = self.post('/api/account/login/', {'email': 'pilot@example.com', 'password': PASSWORD})
        self.assertEqual(blocked.status_code, 429)
        self.assertIn('Retry-After', blocked.headers)
        # A password reset clears the lockout.
        self.post('/api/account/password-reset/', {'email': 'pilot@example.com'})
        _, params = link_params(mail.outbox[-1])
        self.post('/api/account/password-reset/confirm/', {'uid': params['uid'], 'token': params['token'], 'password': 'brand-new-passphrase'})
        self.post('/api/account/logout/')
        self.assertEqual(self.post('/api/account/login/', {'email': 'pilot@example.com', 'password': 'brand-new-passphrase'}).status_code, 200)

    def test_resend_verification(self):
        self.assertEqual(self.post('/api/account/verify-email/resend/').status_code, 403)
        self.signup()  # Sends the first email.
        self.assertEqual(self.post('/api/account/verify-email/resend/').json()['verification_sent'], True)
        self.assertEqual(self.post('/api/account/verify-email/resend/').status_code, 200)
        self.assertEqual(self.post('/api/account/verify-email/resend/').status_code, 429)
        self.assertEqual(len(mail.outbox), 3)
        _, params = link_params(mail.outbox[-1])
        self.post('/api/account/verify-email/', {'token': params['token']})
        cache.clear()
        response = self.post('/api/account/verify-email/resend/')
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()['verification_sent'])
        self.assertEqual(len(mail.outbox), 3)

    def test_email_delivery_failures(self):
        with patch('accounts.services.send_mail', side_effect=smtplib.SMTPException('down')), self.assertLogs('accounts.services', 'ERROR'):
            response = self.signup()
            self.assertEqual(response.status_code, 201)  # The account still works.
            self.assertFalse(response.json()['verification_sent'])
            self.assertEqual(self.post('/api/account/verify-email/resend/').status_code, 503)
            self.post('/api/account/logout/')
            self.assertEqual(self.post('/api/account/password-reset/', {'email': 'pilot@example.com'}).status_code, 200)

    @override_settings(PUBLIC_SITE_URL='https://relay.example.com')
    def test_links_use_public_site_url(self):
        self.client.post('/api/account/signup/', {'email': 'pilot@example.com', 'password': PASSWORD, **self.captcha()}, format='json', HTTP_HOST='localhost')
        parts, _ = link_params(mail.outbox[0])
        self.assertEqual(f'{parts.scheme}://{parts.netloc}', 'https://relay.example.com')

    def test_player_accounts_have_no_backend_access(self):
        self.signup()
        self.assertEqual(self.client.get(reverse('admin:index')).status_code, 302)
        self.assertEqual(self.client.post('/api/music/tracks/', {'title': 'Nope'}, format='json').status_code, 403)
