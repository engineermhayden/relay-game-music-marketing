"""Feedback tests, against real PostGIS (and a local-memory cache).

Grouped by the definition of done:
1. Guests and signed-in players submit bug reports, ideas and music comments, with an optional
   screenshot and Engine lab snapshot, kept only when the player opts in and passes the CAPTCHA.
2. Submissions reach the admin review queue as New; staff set Planned, Done or Declined.
3. Only accepted items (Planned or Done, of any type) appear on the public board. Voting needs
   the CAPTCHA, once per session or account per item.
4. Rate limits and the spam filter reject rapid repeats and junk.
"""
import base64
import io
import itertools
import json
import os
import smtplib
import time
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from django.core.exceptions import ImproperlyConfigured
from django.core.management import call_command
from django.test import Client, SimpleTestCase, override_settings
from django.utils import timezone
from PIL import Image, PngImagePlugin

from accounts.models import Account
from accounts.tests import PASSWORD, AccountTestCase
from config.env import env_emails, env_int, env_list

from rest_framework.exceptions import ValidationError

from .attachments import SNAPSHOT_MAX_MESSAGES, clean_diagnostics
from .models import Feedback, FeedbackVote, set_status

BOARD = '/api/feedback/'
_titles = itertools.count(1)


def vote_path(item):
    return f'/api/feedback/{item.pk}/vote/'


def image_data_url(size=(320, 180), fmt='PNG', color=(40, 120, 90), text_chunk=None):
    image = Image.new('RGB', size, color)
    output, options = io.BytesIO(), {}
    if text_chunk:
        info = PngImagePlugin.PngInfo()
        info.add_text('Comment', text_chunk)
        options['pnginfo'] = info
    image.save(output, fmt, **options)
    return f'data:image/{fmt.lower()};base64,' + base64.b64encode(output.getvalue()).decode()


def engine_snapshot(**overrides):
    return {
        'captured_at': '2026-11-11T20:00:00Z',
        'browser': {'user_agent': 'Mozilla/5.0 (Windows NT 10.0) Edg/141', 'language': 'en-GB', 'platform': 'Win32', 'viewport': '1440×1100', 'pixel_ratio': 1.5},
        'renderer': {'backend': 'webgl2', 'bloom': 'Rendered', 'fog': 'Enabled', 'shadow_map': 'Sampled', 'grounding': 'Blob footprints',
                     'particles': 'Rendered', 'instanced_submissions': 1200, 'animated_assets': 1},
        'performance': {'fps': 58, 'frame_ms': 17, 'resolution_scale': 0.85, 'draws': 140, 'triangles': 250000},
        'settings': {'quality': 'auto', 'camera': 'overview', 'material': 'ceramic', 'bloom': True, 'fog': True, 'particles': True, 'shadows': True, 'lab': False},
        'scene': {'destination': 'ember', 'mode': 'squad'},
        'errors': [], 'warnings': ['Postprocess pass unavailable: ssao'], 'limitations': [],
        **overrides,
    }


@override_settings(FEEDBACK_SUBMISSION_COOLDOWN_SECONDS=0, STAFF_EMAILS=[])
class FeedbackTestCase(AccountTestCase):
    """CAPTCHA_TEST_MODE is on (the answer PASSED). The cooldown is off except where a test turns it on."""

    def submit(self, client=None, captcha=True, **data):
        # Titles differ so the duplicate filter never interferes with unrelated tests.
        body = {'title': f'Add a night-time destination {next(_titles)}', 'body': 'Glowing fungi and quieter sentinels.', 'category': 'idea', **data}
        if captcha:
            body.update(self.captcha(client))
        return self.post(BOARD, body, client)

    def board(self, client=None, **params):
        response = (client or self.client).get(BOARD, params)
        self.assertEqual(response.status_code, 200, response.content)
        return response.json()

    def accepted(self, title='Accepted idea', status=Feedback.Status.PLANNED, category=Feedback.Category.IDEA, **fields):
        return Feedback.objects.create(title=title, status=status, category=category, submitter='guest:seed', **fields)

    def vote(self, item, client=None, **data):
        return self.post(vote_path(item), {'vote': True, **data}, client)

    def verified_vote(self, item, client=None):
        """A vote from a session that solves the voting CAPTCHA first if it needs to."""
        response = self.vote(item, client)
        if response.status_code == 403 and response.json().get('captcha_required'):
            response = self.vote(item, client, **self.captcha(client))
        return response


# 1. Submitting, with optional attachments ----------------------------------------------------------

class SubmissionTests(FeedbackTestCase):
    def test_a_guest_bug_report_waits_as_new_and_only_its_submitter_sees_it(self):
        response = self.submit(category='bug', title='Sentinel clips through the Ember relay')
        self.assertEqual(response.status_code, 201, response.content)
        item = Feedback.objects.get()
        self.assertEqual((item.status, item.category, item.account, item.published_at), ('new', 'bug', None, None))
        self.assertRegex(item.submitter, r'^guest:[0-9a-f]{48}$')
        self.assertEqual((item.screenshot, item.diagnostics), (None, None))  # Nothing attached unless chosen.
        self.assertEqual(response.json()['item']['attachments'], {'screenshot': False, 'engine_lab_snapshot': False})
        mine = self.board()
        self.assertEqual(mine['items'], [])
        self.assertEqual([(i['title'], i['status'], i['mine']) for i in mine['mine']], [('Sentinel clips through the Ember relay', 'new', True)])
        stranger = self.board(self.browser())
        self.assertEqual((stranger['items'], stranger['mine']), ([], []))

    def test_signed_in_players_submit_too(self):
        self.signup()
        self.assertEqual(self.submit(category='music').status_code, 201)
        item = Feedback.objects.get()
        self.assertEqual((item.account, item.submitter, item.category), (Account.objects.get(), f'account:{Account.objects.get().pk}', 'music'))

    def test_the_three_types(self):
        self.assertEqual([c['id'] for c in self.board()['categories']], ['bug', 'idea', 'music'])
        for category in ['bug', 'idea', 'music']:
            self.assertEqual(self.submit(category=category).status_code, 201, category)
        response = self.submit(category='other')
        self.assertEqual(response.status_code, 400)
        self.assertIn('bug report, an idea, or a music comment', response.json()[0])

    def test_every_submission_needs_a_fresh_captcha(self):
        self.assertEqual(self.submit(captcha=False).status_code, 400)
        challenge = self.captcha()
        with override_settings(ACCOUNT_CAPTCHA_TEST_MODE=False):
            wrong = self.submit(captcha=False, captcha_id=challenge['captcha_id'], captcha_answer='WRONG')
        self.assertEqual(wrong.status_code, 400)
        self.assertIn('did not match', wrong.json()[0])
        self.assertEqual(self.submit(captcha=False, **challenge).status_code, 400)  # The wrong answer spent it.
        ok = self.captcha()
        self.assertEqual(self.submit(captcha=False, **ok).status_code, 201)
        self.assertEqual(self.submit(captcha=False, **ok).status_code, 400)  # Spent by success too.
        self.assertEqual(Feedback.objects.count(), 1)

    def test_csrf_is_required(self):
        client = self.browser()
        client.credentials()
        self.assertEqual(client.post(BOARD, {'title': 'No token here', **self.captcha(client)}, format='json').status_code, 403)
        self.assertFalse(Feedback.objects.exists())

    def test_validation_and_cleanup(self):
        for data, message in [({'title': 'Hi'}, 'at least 4'), ({'title': 'x' * 121}, 'at most 120'), ({'body': 'x' * 2001}, 'at most 2000'),
                              ({'title': ['list']}, 'must be text'), ({'title': '   \n  '}, 'at least 4')]:
            response = self.submit(**data)
            self.assertEqual(response.status_code, 400, data)
            self.assertIn(message, response.json()[0], data)
        self.assertFalse(Feedback.objects.exists())
        response = self.submit(title='  Spaced \n  out\ttitle \u202e ', body='\r\nLine one\r\n\r\n\r\n\r\nLine two\x00\x07\n', category='bug')
        self.assertEqual(response.status_code, 201, response.content)
        item = Feedback.objects.get()
        self.assertEqual((item.title, item.body, item.category), ('Spaced out title', 'Line one\n\nLine two', 'bug'))
        self.assertEqual(self.submit(body=None).status_code, 201)  # Details are optional.

    def test_signing_out_ends_a_guests_link_to_their_feedback(self):
        self.submit()
        self.assertEqual(len(self.board()['mine']), 1)
        self.post('/api/account/logout/')  # Flushes the session like any sign-out.
        self.assertEqual(self.board()['mine'], [])


class AttachmentTests(FeedbackTestCase):
    def test_a_bug_report_with_a_screenshot_and_engine_lab_snapshot(self):
        response = self.submit(category='bug', screenshot=image_data_url(text_chunk='secret metadata'), diagnostics=engine_snapshot())
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.json()['item']['attachments'], {'screenshot': True, 'engine_lab_snapshot': True})
        item = Feedback.objects.get()
        # Re-encoded by the server as JPEG, without the upload's metadata.
        stored = Image.open(io.BytesIO(bytes(item.screenshot)))
        self.assertEqual((stored.format, stored.size), ('JPEG', (320, 180)))
        self.assertNotIn(b'secret metadata', bytes(item.screenshot))
        self.assertEqual(item.diagnostics, engine_snapshot())

    def test_attachments_are_never_stored_without_the_captcha(self):
        for captcha in [{}, {'captcha_id': 'made-up', 'captcha_answer': 'PASSED'}]:
            response = self.submit(captcha=False, screenshot=image_data_url(), diagnostics=engine_snapshot(), **captcha)
            self.assertEqual(response.status_code, 400)
        self.assertFalse(Feedback.objects.exists())

    def test_either_attachment_alone(self):
        self.submit(screenshot=image_data_url(fmt='JPEG'))
        self.submit(screenshot=image_data_url(fmt='WEBP'), diagnostics=None)
        self.submit(diagnostics=engine_snapshot(), screenshot='')
        self.assertEqual([(bool(f.screenshot), bool(f.diagnostics)) for f in Feedback.objects.order_by('pk')], [(True, False), (True, False), (False, True)])

    def test_large_screenshots_are_scaled_down(self):
        self.submit(screenshot=image_data_url(size=(3000, 1500), fmt='JPEG'))
        self.assertEqual(Image.open(io.BytesIO(bytes(Feedback.objects.get().screenshot))).size, (1920, 960))

    def test_bad_screenshots_are_rejected(self):
        gif = io.BytesIO()
        Image.new('RGB', (32, 32)).save(gif, 'GIF')
        png_as_jpeg = image_data_url().replace('data:image/png', 'data:image/jpeg')
        for screenshot in ['not a data url', 'data:image/png;base64,%%%', 'data:image/png;base64,' + base64.b64encode(b'not an image').decode(),
                           'data:image/gif;base64,' + base64.b64encode(gif.getvalue()).decode(), png_as_jpeg,
                           image_data_url(size=(5000, 100)), image_data_url(size=(8, 8)), 42,
                           'data:image/png;base64,' + 'A' * 2_100_000]:
            response = self.submit(screenshot=screenshot)
            self.assertEqual(response.status_code, 400, str(screenshot)[:40])
            self.assertIn('screenshot', response.json()[0].lower())
        self.assertFalse(Feedback.objects.exists())

    def test_snapshots_keep_only_known_fields(self):
        snapshot = engine_snapshot(extra='dropped', warnings=['w' * 900] * 80)
        snapshot['browser']['cookies'] = 'dropped too'
        self.submit(diagnostics=snapshot)
        stored = Feedback.objects.get().diagnostics
        self.assertNotIn('extra', stored)
        self.assertNotIn('cookies', stored['browser'])
        self.assertEqual((len(stored['warnings']), len(stored['warnings'][0])), (SNAPSHOT_MAX_MESSAGES, 500))

    def test_malformed_snapshots_are_rejected(self):
        for snapshot in ['text', [], {}, {'unknown': 1}, engine_snapshot(performance={'fps': 'fast'}), engine_snapshot(performance={'fps': True}),
                         engine_snapshot(warnings='one'), engine_snapshot(warnings=[1]),
                         engine_snapshot(browser='Edge'), engine_snapshot(settings={'bloom': 'yes'})]:
            response = self.submit(diagnostics=snapshot)
            self.assertEqual(response.status_code, 400, snapshot)
            self.assertIn('Engine lab snapshot', response.json()[0])
        self.assertFalse(Feedback.objects.exists())
        # JSON cannot carry NaN or infinity (the parser refuses them), but the snapshot check does too.
        for number in [float('nan'), float('inf')]:
            with self.assertRaises(ValidationError):
                clean_diagnostics(engine_snapshot(performance={'resolution_scale': number}))

    def test_attachments_stay_private_when_the_item_is_accepted(self):
        self.submit(category='bug', screenshot=image_data_url(), diagnostics=engine_snapshot())
        item = Feedback.objects.get()
        set_status(Feedback.objects.filter(pk=item.pk), Feedback.Status.PLANNED)
        board = self.board(self.browser())
        self.assertEqual([i['id'] for i in board['items']], [item.pk])  # The bug report is public...
        self.assertNotIn('attachments', board['items'][0])  # ...its attachments are not.
        for private in ['webgl2', 'Edg/141', 'base64']:
            self.assertNotIn(private, json.dumps(board))


# 2. The admin review queue ----------------------------------------------------------------------

class AdminTests(FeedbackTestCase):
    def setUp(self):
        super().setUp()
        self.staff = Client()
        self.staff.force_login(get_user_model().objects.create_superuser('moderator', 'mod@example.com', PASSWORD))
        self.submit(title='Arrives as new', category='bug', screenshot=image_data_url(), diagnostics=engine_snapshot())
        self.new = Feedback.objects.get()
        self.old = self.accepted(title='Already planned')
        self.declined = self.accepted(title='Turned down', status=Feedback.Status.DECLINED)

    def test_the_queue_lists_new_first_with_attachments_and_no_add_button(self):
        response = self.staff.get('/admin/feedback/feedback/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual([item.title for item in response.context['cl'].result_list][0], 'Arrives as new')
        self.assertEqual(self.new.status, 'new')
        for text in ['Guest', 'Screenshot, Engine lab', '>New<']:
            self.assertContains(response, text)
        self.assertNotContains(response, '/admin/feedback/feedback/add/')
        self.assertEqual(self.staff.get('/admin/feedback/feedback/add/').status_code, 403)
        filtered = self.staff.get('/admin/feedback/feedback/?attachments=screenshot')
        self.assertEqual([item.title for item in filtered.context['cl'].result_list], ['Arrives as new'])

    def test_staff_can_set_planned_done_declined_and_back_to_new(self):
        for action, status in [('mark_planned', 'planned'), ('mark_done', 'done'), ('mark_declined', 'declined'), ('mark_new', 'new')]:
            response = self.staff.post('/admin/feedback/feedback/?status__exact=new' if status == 'planned' else '/admin/feedback/feedback/',
                                       {'action': action, '_selected_action': [self.new.pk]}, follow=True)
            self.assertContains(response, f'1 feedback item marked {status}.')
            self.new.refresh_from_db()
            self.assertEqual(self.new.status, status)
        self.assertIsNotNone(self.new.published_at)  # Stamped when first accepted, even from a filtered list.

    def test_the_change_form_shows_the_attachments_and_edits_status_and_reply(self):
        page = self.staff.get(f'/admin/feedback/feedback/{self.new.pk}/change/')
        self.assertContains(page, f'/admin/feedback/feedback/{self.new.pk}/screenshot/')
        for text in ['renderer.backend', 'webgl2', 'performance.fps', 'Postprocess pass unavailable: ssao', 'Edg/141']:
            self.assertContains(page, text)
        self.assertContains(page, '<option value="declined">Declined</option>', html=True)
        response = self.staff.post(f'/admin/feedback/feedback/{self.new.pk}/change/', {
            'title': 'Arrives as new (edited)', 'body': 'Cleaned up', 'category': 'bug', 'status': 'done', 'staff_response': 'Fixed in 1.1'})
        self.assertEqual(response.status_code, 302)
        self.new.refresh_from_db()
        self.assertEqual((self.new.title, self.new.status, self.new.staff_response), ('Arrives as new (edited)', 'done', 'Fixed in 1.1'))
        self.assertEqual(self.board()['mine'][0]['staff_response'], 'Fixed in 1.1')  # The submitter sees the reply.

    def test_every_type_marked_planned_in_the_admin_reaches_the_board_for_others_to_upvote(self):
        # Reported: bug reports and music comments marked Planned never appeared on the board.
        player = self.browser()
        for category in ['bug', 'idea', 'music']:
            self.assertEqual(self.submit(client=player, category=category, title=f'Planned {category} item').status_code, 201)
        for item in Feedback.objects.filter(title__startswith='Planned '):
            self.staff.post('/admin/feedback/feedback/', {'action': 'mark_planned', '_selected_action': [item.pk]})
        other = self.browser()
        items = {i['title']: i for i in self.board(other)['items']}
        self.assertTrue({'Planned bug item', 'Planned idea item', 'Planned music item'} <= set(items))
        for title in ['Planned bug item', 'Planned idea item', 'Planned music item']:
            self.assertEqual((items[title]['status'], items[title]['public']), ('planned', True))
            response = self.verified_vote(Feedback.objects.get(title=title), other)
            self.assertEqual((response.status_code, response.json()['votes']), (200, 1), title)

    def test_screenshots_are_served_to_staff_only(self):
        url = f'/admin/feedback/feedback/{self.new.pk}/screenshot/'
        response = self.staff.get(url)
        self.assertEqual((response.status_code, response['Content-Type']), (200, 'image/jpeg'))
        self.assertTrue({'private', 'no-store'} <= {part.strip() for part in response['Cache-Control'].split(',')})
        self.assertEqual(Image.open(io.BytesIO(response.content)).format, 'JPEG')
        self.assertEqual(self.staff.get(f'/admin/feedback/feedback/{self.old.pk}/screenshot/').status_code, 404)
        self.signup()
        self.assertEqual(self.client.get(url).status_code, 302)  # Players are sent to the admin login.
        self.assertEqual(Client().get(url).status_code, 302)
        self.assertEqual(self.client.get('/admin/feedback/feedback/').status_code, 302)


# 3. The public ideas board and voting -----------------------------------------------------------

class BoardTests(FeedbackTestCase):
    def test_every_accepted_item_appears_whatever_its_type(self):
        for category in Feedback.Category.values:
            for status in Feedback.Status.values:
                self.accepted(title=f'{category} {status}', category=category, status=status, staff_response=f'Reply to {category} {status}')
        items = self.board()['items']
        accepted = sorted(f'{category} {status}' for category in ['bug', 'idea', 'music'] for status in ['done', 'planned'])
        self.assertEqual(sorted(i['title'] for i in items), accepted)  # New and Declined stay hidden.
        self.assertEqual({i['staff_response'] for i in items}, {f'Reply to {title}' for title in accepted})
        self.assertEqual({i['category'] for i in items}, {'bug', 'idea', 'music'})
        self.assertTrue(all(i['published_at'] and i['public'] for i in items))

    def test_sorting_and_pages(self):
        old = self.accepted(title='Old favourite')
        new = self.accepted(title='Fresh idea', status=Feedback.Status.DONE)
        Feedback.objects.filter(pk=old.pk).update(published_at=timezone.now() - timedelta(days=2))
        FeedbackVote.objects.create(feedback=old, voter='guest:a')
        self.assertEqual([i['title'] for i in self.board()['items']], ['Old favourite', 'Fresh idea'])
        self.assertEqual([i['title'] for i in self.board(sort='new')['items']], ['Fresh idea', 'Old favourite'])
        self.assertEqual(self.board()['items'][0]['votes'], 1)
        Feedback.objects.bulk_create([Feedback(title=f'Idea {n}', category='idea', status='planned', submitter='guest:seed', published_at=timezone.now()) for n in range(25)])
        first, second = self.board(sort='new'), self.board(sort='new', offset=20)
        self.assertEqual((len(first['items']), first['has_more'], len(second['items']), second['has_more']), (20, True, 7, False))
        pages = [i['id'] for i in first['items'] + second['items']]
        self.assertEqual(sorted(pages), sorted(Feedback.objects.values_list('pk', flat=True)))
        self.assertEqual(pages[-2:], [new.pk, old.pk])
        for params in [{'sort': 'random'}, {'offset': 'ten'}]:
            self.assertEqual(self.client.get(BOARD, params).status_code, 400, params)

    def test_board_is_never_cached(self):
        self.assertEqual(self.client.get(BOARD)['Cache-Control'], 'no-store')

    @override_settings(FEEDBACK_VERIFIED_VOTER_TTL=6 * 60 * 60)
    def test_board_reports_how_long_a_vote_check_lasts(self):
        self.assertEqual(self.board()['limits']['voter_check_hours'], 6)

    def test_first_acceptance_time_is_kept(self):
        item = Feedback.objects.create(title='Slow burner', category='idea', submitter='guest:seed')
        self.assertIsNone(item.published_at)
        item.status = Feedback.Status.PLANNED
        item.save(update_fields=['status'])
        item.refresh_from_db()
        first = item.published_at
        self.assertIsNotNone(first)
        set_status(Feedback.objects.filter(pk=item.pk), Feedback.Status.NEW)
        set_status(Feedback.objects.filter(pk=item.pk), Feedback.Status.DONE)
        item.refresh_from_db()
        self.assertEqual((item.status, item.published_at), (Feedback.Status.DONE, first))


class VotingTests(FeedbackTestCase):
    def setUp(self):
        super().setUp()
        self.item = self.accepted()

    def test_upvoting_needs_the_captcha(self):
        response = self.vote(self.item)
        self.assertEqual(response.status_code, 403)
        self.assertTrue(response.json()['captcha_required'])
        self.assertFalse(self.board()['can_vote'])
        with override_settings(ACCOUNT_CAPTCHA_TEST_MODE=False):
            self.assertEqual(self.vote(self.item, captcha_id=self.captcha()['captcha_id'], captcha_answer='WRONG').status_code, 400)
        self.assertFalse(FeedbackVote.objects.exists())
        response = self.vote(self.item, **self.captcha())
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual((response.json()['votes'], response.json()['voted']), (1, True))
        self.assertTrue(self.board()['can_vote'])
        self.assertEqual(self.vote(self.accepted(title='Another idea')).status_code, 200)  # Once per session.

    def test_signed_in_players_pass_the_captcha_too(self):
        self.signup()
        self.assertEqual(self.vote(self.item).status_code, 403)
        self.assertEqual(self.vote(self.item, **self.captcha()).status_code, 200)
        vote = FeedbackVote.objects.get()
        self.assertEqual((vote.account, vote.voter), (Account.objects.get(), f'account:{Account.objects.get().pk}'))

    def test_a_session_or_account_votes_once_per_idea(self):
        for _ in range(3):
            self.assertEqual(self.verified_vote(self.item).json()['votes'], 1)
        self.signup('voter@example.com', client=(phone := self.browser()))
        self.assertEqual(self.verified_vote(self.item, phone).json()['votes'], 2)
        # The same account on another device still has one vote.
        laptop = self.browser()
        self.post('/api/account/login/', {'email': 'voter@example.com', 'password': PASSWORD}, laptop)
        self.assertEqual(self.verified_vote(self.item, laptop).json()['votes'], 2)
        self.assertTrue(self.board(laptop)['items'][0]['voted'])
        self.assertEqual(FeedbackVote.objects.count(), 2)

    def test_votes_can_be_removed(self):
        self.verified_vote(self.item)
        self.verified_vote(self.item, friend := self.browser())
        removed = self.post(vote_path(self.item), {'vote': False}).json()
        self.assertEqual((removed['votes'], removed['voted']), (1, False))
        self.assertEqual(self.post(vote_path(self.item), {'vote': False}).json()['votes'], 1)
        self.assertFalse(self.board()['items'][0]['voted'])
        self.assertTrue(self.board(friend)['items'][0]['voted'])
        self.assertEqual(self.post(vote_path(self.item), {'vote': 'yes'}).status_code, 400)

    def test_submitting_feedback_also_passes_the_voting_captcha(self):
        self.submit()
        self.assertEqual(self.vote(self.item).status_code, 200)

    def test_only_accepted_items_take_votes(self):
        self.verified_vote(self.item)
        for category, status in [('idea', 'new'), ('idea', 'declined'), ('bug', 'new'), ('music', 'declined')]:
            self.assertEqual(self.vote(self.accepted(title=f'{category} {status}', category=category, status=status)).status_code, 404)
        for category, status in [('bug', 'planned'), ('music', 'done')]:
            self.assertEqual(self.vote(self.accepted(title=f'{category} {status}', category=category, status=status)).status_code, 200)
        self.assertEqual(self.post('/api/feedback/999999/vote/', {'vote': True}).status_code, 404)
        set_status(Feedback.objects.filter(pk=self.item.pk), Feedback.Status.DECLINED)
        self.assertEqual(self.vote(self.item).status_code, 404)
        self.assertEqual(FeedbackVote.objects.filter(feedback=self.item).count(), 1)  # Kept, in case it is accepted again.

    @override_settings(FEEDBACK_VERIFIED_VOTER_TTL=-1)
    def test_a_solved_captcha_expires(self):
        self.assertEqual(self.vote(self.item, **self.captcha()).status_code, 200)
        self.assertEqual(self.vote(self.item).status_code, 403)

    def test_csrf_is_required(self):
        self.verified_vote(self.item)
        self.client.credentials()
        self.assertEqual(self.client.post(vote_path(self.item), {'vote': False}, format='json').status_code, 403)
        self.assertEqual(FeedbackVote.objects.count(), 1)


# 4. Rate limits and the spam filter ---------------------------------------------------------------

class RateLimitTests(FeedbackTestCase):
    @override_settings(FEEDBACK_SUBMISSION_COOLDOWN_SECONDS=60)
    def test_rapid_repeat_submissions_are_rejected(self):
        self.assertEqual(self.submit().status_code, 201)
        again = self.submit()
        self.assertEqual(again.status_code, 429)
        self.assertIn('You just sent feedback', again.json()['detail'])
        self.assertTrue(58 <= int(again['Retry-After']) <= 60)
        self.assertEqual(self.submit(client=self.browser()).status_code, 429)  # Same network, new session.
        self.assertEqual(Feedback.objects.count(), 1)
        later = time.time() + 61
        with patch('feedback.views.time.time', return_value=later):
            self.assertEqual(self.submit().status_code, 201)

    @override_settings(FEEDBACK_SUBMISSION_COOLDOWN_SECONDS=60)
    def test_rejected_attempts_do_not_start_the_cooldown(self):
        self.assertEqual(self.submit(title='').status_code, 400)
        self.assertEqual(self.submit().status_code, 201)

    @override_settings(FEEDBACK_SUBMISSIONS_PER_IP_HOUR=2)
    def test_submissions_are_limited_per_network(self):
        self.assertEqual(self.submit(title='').status_code, 400)  # Rejected drafts do not count.
        for _ in range(2):
            self.assertEqual(self.submit().status_code, 201)
        response = self.submit(client=self.browser())
        self.assertEqual(response.status_code, 429)
        self.assertIn('this network', response.json()['detail'])
        self.assertEqual(Feedback.objects.count(), 2)

    @override_settings(FEEDBACK_SUBMISSIONS_PER_SUBMITTER_DAY=2)
    def test_submissions_are_limited_per_submitter(self):
        for _ in range(2):
            self.assertEqual(self.submit().status_code, 201)
        self.assertEqual(self.submit().status_code, 429)
        self.assertEqual(self.submit(client=self.browser()).status_code, 201)

    @override_settings(FEEDBACK_VOTES_PER_IP_HOUR=3)
    def test_votes_are_limited_per_network(self):
        item = self.accepted()
        self.vote(item, **self.captcha())
        self.post(vote_path(item), {'vote': False})
        self.vote(item)
        self.assertEqual(self.post(vote_path(item), {'vote': False}).status_code, 429)
        self.assertEqual(FeedbackVote.objects.count(), 1)

    @override_settings(FEEDBACK_VOTES_PER_IDEA_PER_IP_DAY=2)
    def test_vote_stuffing_from_one_network_is_capped_per_idea(self):
        item, other = self.accepted(), self.accepted(title='Other idea')
        for _ in range(2):
            self.assertEqual(self.verified_vote(item, self.browser()).status_code, 200)
        stuffer = self.browser()
        response = self.verified_vote(item, stuffer)
        self.assertEqual(response.status_code, 429)
        self.assertIn('most votes allowed from your network', response.json()['detail'])
        self.assertEqual(self.vote(other, stuffer).status_code, 200)  # Other ideas are unaffected.
        # Removing and re-adding a vote does not reset the count.
        self.assertEqual(self.post(vote_path(other), {'vote': False}, stuffer).status_code, 200)
        self.assertEqual(self.vote(other, stuffer).status_code, 200)
        self.assertEqual(self.post(vote_path(other), {'vote': False}, stuffer).status_code, 200)
        self.assertEqual(self.vote(other, stuffer).status_code, 429)
        self.assertEqual(item.votes.count(), 2)


class SpamFilterTests(FeedbackTestCase):
    def rejected(self, message, **data):
        response = self.submit(**data)
        self.assertEqual(response.status_code, 400, data)
        self.assertIn(message, response.json()[0])

    def test_links(self):
        self.rejected('Titles cannot contain links', title='Great deals at www.example.com')
        self.rejected('at most 2 links', body='https://a.example http://b.example www.c.example')
        self.assertEqual(self.submit(body='Crash log: https://paste.example/abc and https://paste.example/def').status_code, 201)
        with override_settings(FEEDBACK_MAX_LINKS=0):
            self.rejected('cannot include links', body='See https://paste.example/abc')
        self.assertEqual(Feedback.objects.count(), 1)

    @override_settings(FEEDBACK_BLOCKED_WORDS=['casino', 'free crypto'])
    def test_blocked_words_and_phrases(self):
        self.rejected('looks like spam', title='Best CASINO bonuses')
        self.rejected('looks like spam', body='Get Free   Crypto now')
        self.assertEqual(self.submit(title='A casinos-style minigame', body='Free cryptography puzzles').status_code, 201)  # Whole words only.

    def test_keyboard_mashing_and_empty_titles(self):
        self.rejected('repeated characters', body='a' * 25)
        self.rejected('few words', title='!!!! ???? 1234')
        self.assertEqual(self.submit(body='Stack trace follows ======================== end').status_code, 201)  # 24 in a row is fine.

    def test_honeypot(self):
        self.rejected('looks like spam', website='http://bots.example')
        self.assertFalse(Feedback.objects.exists())

    def test_identical_feedback_is_accepted_once_a_day(self):
        text = {'title': 'Add a photo mode', 'body': 'Hide the HUD for screenshots.'}
        self.assertEqual(self.submit(**text).status_code, 201)
        self.rejected('already received this exact feedback', client=self.browser(), title='add a PHOTO  mode', body='Hide the HUD for screenshots. ')
        self.assertEqual(self.submit(title='Add a photo mode', body='And a timer.').status_code, 201)

    def test_spam_is_checked_after_the_captcha(self):
        response = self.submit(captcha=False, title='www.spam.example', captcha_id='made-up', captcha_answer='PASSED')
        self.assertIn('did not match', response.json()[0])


# Accounts: sign-in, data export and deletion -------------------------------------------------------

class SignInTests(FeedbackTestCase):
    def test_signing_in_claims_this_browsers_guest_feedback_and_votes(self):
        self.signup('pilot@example.com')
        self.post('/api/account/logout/')
        account = Account.objects.get()
        both, guest_only = self.accepted(title='Both voted'), self.accepted(title='Guest voted')
        FeedbackVote.objects.create(feedback=both, voter=f'account:{account.pk}', account=account)
        self.submit()
        self.vote(both)
        self.vote(guest_only)
        self.assertEqual(FeedbackVote.objects.filter(feedback=both).count(), 2)
        self.post('/api/account/login/', {'email': 'pilot@example.com', 'password': PASSWORD})
        self.assertEqual(Feedback.objects.get(status='new').account, account)
        # One vote per idea: the guest duplicate merged into the account's vote.
        self.assertEqual(sorted(FeedbackVote.objects.values_list('feedback__title', 'voter')),
                         [('Both voted', f'account:{account.pk}'), ('Guest voted', f'account:{account.pk}')])
        board = self.board()
        self.assertTrue(all(i['voted'] for i in board['items']))
        self.assertEqual(len(board['mine']), 1)
        self.post('/api/account/logout/')
        board = self.board()
        self.assertEqual((board['mine'], [i['voted'] for i in board['items']]), ([], [False, False]))


class AccountDataTests(FeedbackTestCase):
    CALLSIGN, EMAIL, PREVIOUS = 'Zephyrine Quill', 'zephyrine@example.com', 'zephyrine@example.co'
    BODY = 'Mail ZEPHYRINE@example.com (not zephyrine@example.co).\nGlowing fungi, and quieter sentinels near zephyrine quill\'s relay.'

    def setUp(self):
        super().setUp()
        self.post('/api/session/', {'name': self.CALLSIGN})  # A pilot the account flies.
        self.signup(self.EMAIL)
        # The address before an email change fixed a typo: a prefix of the current one.
        Account.objects.update(previous_email=self.PREVIOUS)
        self.submit(title=f'Let {self.CALLSIGN} rename squads', body=self.BODY, screenshot=image_data_url(), diagnostics=engine_snapshot())
        self.mine = Feedback.objects.get(account__isnull=False)
        Feedback.objects.filter(pk=self.mine.pk).update(staff_response=f'Thanks, {self.CALLSIGN}! Planned.')
        set_status(Feedback.objects.filter(pk=self.mine.pk), Feedback.Status.PLANNED)
        self.others = self.accepted(title='Someone else had this idea')
        self.vote(self.others)
        self.submit(client=(friend := self.browser()), title='A guest idea')
        self.vote(self.others, friend)
        self.vote(self.mine, friend)

    def test_export_includes_submitted_feedback_attachments_and_upvotes(self):
        data = json.loads(self.post('/api/account/export/', {'password': PASSWORD}).content)
        [item] = data['feedback']
        self.assertEqual((item['title'], item['details'], item['status'], item['category']), (f'Let {self.CALLSIGN} rename squads', self.BODY, 'planned', 'idea'))
        self.assertTrue(item['screenshot'].startswith('data:image/jpeg;base64,'))
        self.assertEqual(item['engine_lab_snapshot'], engine_snapshot())
        self.assertEqual([v['title'] for v in data['feedback_votes']], ['Someone else had this idea'])
        set_status(Feedback.objects.filter(pk=self.others.pk), Feedback.Status.DECLINED)
        data = json.loads(self.post('/api/account/export/', {'password': PASSWORD}).content)
        self.assertEqual(data['feedback_votes'][0]['title'], None)  # No longer public.
        self.assertNotIn('A guest idea', json.dumps(data))

    def test_deletion_keeps_feedback_without_the_accounts_identifiers(self):
        columns = ['pk', 'status', 'category', 'account', 'submitter', 'created_at', 'published_at', 'screenshot']
        before = [{**row, 'screenshot': bytes(row['screenshot'] or b'')} for row in Feedback.objects.values(*columns).order_by('pk')]
        self.assertEqual(self.post('/api/account/delete/', {'password': PASSWORD, 'confirm': True}).status_code, 200)
        # Every post, its status, dates, account link, screenshot and votes are kept for analysis.
        after = [{**row, 'screenshot': bytes(row['screenshot'] or b'')} for row in Feedback.objects.values(*columns).order_by('pk')]
        self.assertEqual(after, before)
        self.assertEqual((FeedbackVote.objects.filter(feedback=self.mine).count(), FeedbackVote.objects.filter(feedback=self.others).count()), (1, 2))
        # Only the account's email addresses, callsigns and user-agent string are removed.
        callsign = Account.objects.get().pilots.get().name
        self.assertRegex(callsign, r'^[0-9a-f]{24}$')
        self.mine.refresh_from_db()
        self.assertEqual(self.mine.title, f'Let {callsign} rename squads')
        self.assertEqual(self.mine.body, f"Mail [email removed] (not [email removed]).\nGlowing fungi, and quieter sentinels near {callsign}'s relay.")
        self.assertEqual(self.mine.staff_response, f'Thanks, {callsign}! Planned.')
        expected = engine_snapshot()
        expected['browser']['user_agent'] = '[removed: user-self-deletion]'
        self.assertEqual(self.mine.diagnostics, expected)
        dump = io.StringIO()
        call_command('dumpdata', stdout=dump)
        self.assertNotIn('zephyrine', dump.getvalue().lower())
        self.assertNotIn('Edg/141', dump.getvalue())
        item = next(i for i in self.board(self.browser())['items'] if i['id'] == self.mine.pk)
        self.assertEqual((item['title'], item['votes'], item['status']), (f'Let {callsign} rename squads', 1, 'planned'))
        staff = Client()
        staff.force_login(get_user_model().objects.create_superuser('moderator', 'mod@example.com', PASSWORD))
        self.assertContains(staff.get('/admin/feedback/feedback/'), 'Deleted account')


# Staff notifications ------------------------------------------------------------------------------

@override_settings(STAFF_EMAILS=['lead@example.com', 'moderator@example.com'])
class NotificationTests(FeedbackTestCase):
    def setUp(self):
        super().setUp()
        mail.outbox.clear()

    def test_staff_are_emailed_about_each_submission(self):
        self.submit(title='Tom\'s "glow" & fungi', body='Line one\nLine <two>', category='bug', screenshot=image_data_url(), diagnostics=engine_snapshot())
        item = Feedback.objects.get()
        self.assertEqual(len(mail.outbox), 1)
        message = mail.outbox[0]
        self.assertEqual(message.to, ['lead@example.com', 'moderator@example.com'])
        self.assertEqual(message.subject, '[RELAY feedback] Bug report: Tom\'s "glow" & fungi')
        self.assertEqual(message.attachments, [])  # Named, not attached: they stay in the admin.
        for text in ['Type: Bug report', 'From: a guest', 'Attachments: screenshot, Engine lab snapshot', 'Tom\'s "glow" & fungi',
                     'Line one\nLine <two>', f'http://testserver/admin/feedback/feedback/{item.pk}/change/', 'planned, done or declined',
                     'puts its title, details and any team reply on the public board', 'Attachments are never public']:
            self.assertIn(text, message.body)

    @override_settings(PUBLIC_SITE_URL='https://relay.example.com')
    def test_signed_in_ideas_link_to_the_public_site_without_the_players_email(self):
        self.signup('secret.pilot@example.com')
        mail.outbox.clear()  # The verification email.
        self.submit(body='')
        message = mail.outbox[0]
        for text in ['From: a signed-in player', 'Attachments: none', 'Details:\n(none)', 'on the public board',
                     f'https://relay.example.com/admin/feedback/feedback/{Feedback.objects.get().pk}/change/']:
            self.assertIn(text, message.body)
        self.assertNotIn('secret.pilot', message.body + message.subject)

    def test_long_titles_are_shortened_in_the_subject(self):
        self.submit(title='Glow ' * 24)
        subject = mail.outbox[0].subject
        self.assertTrue(subject.endswith('…'))
        self.assertEqual(len(subject), len('[RELAY feedback] Idea: ') + 80)
        self.assertIn(('Glow ' * 24).strip(), mail.outbox[0].body)

    def test_rejected_submissions_send_nothing(self):
        self.submit(title='')
        self.submit(captcha=False)
        self.submit(title='www.spam.example')
        self.assertEqual(mail.outbox, [])

    @override_settings(STAFF_EMAILS=[])
    def test_no_staff_emails_means_no_notification(self):
        self.assertEqual(self.submit().status_code, 201)
        self.assertEqual(mail.outbox, [])

    def test_a_mail_failure_still_saves_the_post(self):
        with patch('feedback.notifications.send_mail', side_effect=smtplib.SMTPException('down')), self.assertLogs('feedback.notifications', 'ERROR'):
            response = self.submit()
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Feedback.objects.count(), 1)


# Settings from .env --------------------------------------------------------------------------------

class EnvironmentSettingsTests(SimpleTestCase):
    """config/env.py, which reads the feedback settings and STAFF_EMAILS from .env."""

    def test_numbers(self):
        with patch.dict(os.environ, {'LIMIT': ' 25 '}):
            self.assertEqual(env_int('LIMIT', 10), 25)
        with patch.dict(os.environ):
            os.environ.pop('LIMIT', None)
            self.assertEqual(env_int('LIMIT', 10), 10)  # Unset.
        for blank in ['', '  ']:
            with patch.dict(os.environ, {'LIMIT': blank}):
                self.assertEqual(env_int('LIMIT', 10), 10)
        with patch.dict(os.environ, {'LIMIT': '0'}):
            self.assertEqual(env_int('LIMIT', 10, minimum=0), 0)
        for bad in ['ten', '2.5', '0', '-3']:
            with patch.dict(os.environ, {'LIMIT': bad}), self.assertRaises(ImproperlyConfigured):
                env_int('LIMIT', 10)

    def test_email_lists(self):
        with patch.dict(os.environ, {'STAFF': ' lead@example.com, ,Mod@Example.com,mod@example.com,'}):
            self.assertEqual(env_emails('STAFF'), ['lead@example.com', 'Mod@Example.com'])
        with patch.dict(os.environ, {'STAFF': ''}):
            self.assertEqual(env_emails('STAFF'), [])
        for bad in ['lead@example.com; mod@example.com', 'not-an-address', 'lead@example.com,bad@']:
            with patch.dict(os.environ, {'STAFF': bad}), self.assertRaisesMessage(ImproperlyConfigured, 'STAFF must be'):
                env_emails('STAFF')

    def test_word_lists(self):
        with patch.dict(os.environ, {'WORDS': ' casino,Free   Crypto, ,CASINO,'}):
            self.assertEqual(env_list('WORDS'), ['casino', 'Free Crypto'])
        with patch.dict(os.environ, {'WORDS': ''}):
            self.assertEqual(env_list('WORDS'), [])
