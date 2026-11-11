import base64
import io
from unittest.mock import patch

from django.core import mail
from django.core.cache import cache
from django.test import SimpleTestCase, override_settings
from PIL import Image
from rest_framework.test import APIClient

from . import captcha
from .models import Account
from .tests import PASSWORD, AccountTestCase


@override_settings(ACCOUNT_CAPTCHA_TEST_MODE=False)
class CaptchaTests(AccountTestCase):
    """The real CAPTCHA, without the end-to-end test answer."""

    def challenge(self, text='K7M4P', client=None):
        with patch('accounts.captcha.random_text', return_value=text):
            response = (client or self.client).get('/api/account/captcha/')
        self.assertEqual(response.status_code, 200, response.content)
        return response

    def login(self, answer, captcha_id=None, password=PASSWORD):
        captcha_id = captcha_id or self.challenge().json()['captcha_id']
        return self.post('/api/account/login/', {'email': 'pilot@example.com', 'password': password, 'captcha_id': captcha_id, 'captcha_answer': answer})

    def setUp(self):
        super().setUp()
        self.post('/api/account/signup/', {'email': 'pilot@example.com', 'password': PASSWORD, 'captcha_id': self.challenge('AB3CD').json()['captcha_id'], 'captcha_answer': 'AB3CD'})
        self.post('/api/account/logout/')
        mail.outbox.clear()

    def test_challenge_is_a_fresh_uncached_png(self):
        first, second = self.challenge(), self.challenge()
        self.assertEqual(first['Cache-Control'], 'no-store')
        self.assertNotEqual(first.json()['captcha_id'], second.json()['captcha_id'])
        self.assertNotEqual(first.json()['image'], second.json()['image'])  # Random distortion, even for the same text.
        self.assertEqual(first.json()['expires_in'], 600)
        prefix, encoded = first.json()['image'].split(',', 1)
        self.assertEqual(prefix, 'data:image/png;base64')
        image = Image.open(io.BytesIO(base64.b64decode(encoded)))
        self.assertEqual((image.format, image.size), ('PNG', (240, 80)))
        # Only a keyed hash of the answer is stored.
        stored = cache.get(f"accounts:captcha:{first.json()['captcha_id']}")
        self.assertNotIn('K7M4P', stored)
        self.assertRegex(stored, r'^[0-9a-f]{64}$')

    def test_correct_answer_ignores_case_and_spaces(self):
        response = self.login(' k7 m4p ')
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()['account']['email'], 'pilot@example.com')

    def test_each_challenge_works_once_even_after_a_wrong_answer(self):
        captcha_id = self.challenge().json()['captcha_id']
        wrong = self.login('WRONG', captcha_id)
        self.assertEqual(wrong.status_code, 400)
        self.assertIn('did not match', wrong.json()[0])
        self.assertEqual(self.login('K7M4P', captcha_id).status_code, 400)  # Spent: a new image is needed.
        captcha_id = self.challenge().json()['captcha_id']
        self.assertEqual(self.login('K7M4P', captcha_id).status_code, 200)
        self.post('/api/account/logout/')
        self.assertEqual(self.login('K7M4P', captcha_id).status_code, 400)  # Spent by success too.

    def test_missing_unknown_and_expired_challenges_are_rejected(self):
        for data in [{}, {'captcha_id': 'made-up', 'captcha_answer': 'K7M4P'}, {'captcha_answer': 'K7M4P'}, {'captcha_id': 5, 'captcha_answer': 'K7M4P'},
                     {'captcha_id': 'x' * 100, 'captcha_answer': 'K7M4P'}, {'captcha_id': self.challenge().json()['captcha_id'], 'captcha_answer': 'K' * 40}]:
            response = self.post('/api/account/login/', {'email': 'pilot@example.com', 'password': PASSWORD, **data})
            self.assertEqual(response.status_code, 400, data)
        blank = self.challenge().json()['captcha_id']
        self.assertIn('Type the characters', self.login('  ', blank).json()[0])
        self.assertEqual(self.login('K7M4P', blank).status_code, 400)  # A blank answer still spends it.
        expired = self.challenge().json()['captcha_id']
        cache.delete(f'accounts:captcha:{expired}')  # What the cache does after ten minutes.
        self.assertEqual(self.login('K7M4P', expired).status_code, 400)

    def test_test_answer_only_works_in_test_mode(self):
        self.assertEqual(self.login('PASSED').status_code, 400)
        with override_settings(ACCOUNT_CAPTCHA_TEST_MODE=True):
            self.assertEqual(self.login('PASSED').status_code, 200)

    def test_checked_before_any_other_work(self):
        # No account created, no email sent, no password hashed or counted.
        response = self.post('/api/account/signup/', {'email': 'bot@example.com', 'password': PASSWORD, 'captcha_id': self.challenge().json()['captcha_id'], 'captcha_answer': 'NOPE1'})
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Account.objects.filter(email='bot@example.com').exists())
        self.post('/api/account/password-reset/', {'email': 'pilot@example.com', 'captcha_id': self.challenge().json()['captcha_id'], 'captcha_answer': 'NOPE1'})
        self.assertEqual(len(mail.outbox), 0)
        with patch('django.contrib.auth.hashers.PBKDF2PasswordHasher.encode') as hashing:
            for _ in range(12):
                self.assertEqual(self.login('NOPE1', password='wrong-password').status_code, 400)
            hashing.assert_not_called()
        # Twelve bot attempts did not lock the real player out (the limit is ten wrong passwords).
        self.assertEqual(self.login('K7M4P').status_code, 200)

    def test_protects_sign_up_sign_in_and_reset_requests(self):
        for path, data in [('/api/account/signup/', {'email': 'new@example.com', 'password': PASSWORD}),
                           ('/api/account/login/', {'email': 'pilot@example.com', 'password': PASSWORD}),
                           ('/api/account/password-reset/', {'email': 'pilot@example.com'})]:
            self.assertEqual(self.client.post(path, data, format='json').status_code, 400, path)
            self.assertEqual(self.post(path, {**data, 'captcha_id': self.challenge().json()['captcha_id'], 'captcha_answer': 'K7M4P'}).status_code, 200 if 'signup' not in path else 201, path)
            if 'reset' not in path:
                self.post('/api/account/logout/')

    @override_settings(ACCOUNT_CAPTCHAS_PER_IP=3)
    def test_new_images_are_limited_per_network(self):
        cache.clear()  # setUp already requested one for the sign-up.
        for _ in range(3):
            self.challenge()
        response = APIClient().get('/api/account/captcha/')
        self.assertEqual(response.status_code, 429)


class CaptchaImageTests(SimpleTestCase):
    def test_alphabet_avoids_lookalikes(self):
        self.assertFalse(set('0O1ILQ') & set(captcha.ALPHABET))
        for _ in range(50):
            text = captcha.random_text()
            self.assertEqual(len(text), 5)
            self.assertTrue(set(text) <= set(captcha.ALPHABET))

    def test_render_draws_every_time(self):
        images = {captcha.render('AB3CD') for _ in range(3)}
        self.assertEqual(len(images), 3)
