"""Player feedback: submit (CAPTCHA every time), browse the public board, and upvote accepted items.

Guests and signed-in players can report bugs, suggest ideas and comment on the music, optionally
attaching a screenshot and an Engine lab snapshot. Everything waits as New in the admin review
queue. Whatever staff accept (Planned or Done) appears on the public board. Voting needs a CAPTCHA
once per browser session per FEEDBACK_VOTER_CHECK_HOURS, and each session or account votes once.
"""
import re
import time

from django.conf import settings
from django.core.cache import cache
from django.db.models import BooleanField, Case, Count, Exists, OuterRef, Value, When
from django.middleware.csrf import get_token
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view
from rest_framework.exceptions import Throttled, ValidationError
from rest_framework.response import Response

from accounts.captcha import require_captcha
from accounts.services import attempts, client_ip, current_account, record_attempt
from game.views import csrf

from . import spam
from .attachments import clean_diagnostics, clean_screenshot
from .models import Feedback, FeedbackVote
from .notifications import notify_staff
from .services import identity, is_verified, mark_verified, viewer

PAGE_SIZE = 20
MINE_LIMIT = 20
MAX_OFFSET = 10_000
HOUR, DAY = 60 * 60, 24 * 60 * 60
TITLE_MIN, TITLE_MAX = 4, Feedback._meta.get_field('title').max_length
BODY_MAX = Feedback._meta.get_field('body').max_length
SORTS = {'top': ['-vote_count', '-published_at', '-pk'], 'new': ['-published_at', '-pk']}
THANKS = 'Thanks! The RELAY team will review it. You can follow its status under Your submissions.'
VOTE_CHECK = 'Type the characters in the image to start voting. You only need to do this once.'
# Control characters (tabs and newlines are kept) and bidirectional overrides, which can disguise text.
UNSAFE = re.compile(r'[\x00-\x08\x0b-\x1f\x7f-\x9f\u200e\u200f\u202a-\u202e\u2066-\u2069]')


def clean_text(value, label, maximum, minimum=0, single_line=False):
    if value is None:
        value = ''
    if not isinstance(value, str):
        raise ValidationError(f'{label} must be text.')
    value = UNSAFE.sub('', value.replace('\r\n', '\n').replace('\r', '\n'))
    value = ' '.join(value.split()) if single_line else re.sub(r'\n{3,}', '\n\n', value.strip())
    if len(value) < minimum:
        raise ValidationError(f'{label} needs at least {minimum} characters.')
    if len(value) > maximum:
        raise ValidationError(f'{label} can be at most {maximum} characters.')
    return value


def limit(key, window, maximum, message):
    if attempts(key) >= maximum:
        raise Throttled(window, message)


def check_cooldown(keys):
    """Reject a post sent too soon after the previous one from this network or submitter."""
    now = time.time()
    waits = [until - now for until in (cache.get(key) for key in keys) if until and until > now]
    if waits:
        raise Throttled(max(1, round(max(waits))), 'You just sent feedback. Please wait a moment before sending more.')


def start_cooldown(keys):
    seconds = settings.FEEDBACK_SUBMISSION_COOLDOWN_SECONDS
    if seconds:
        for key in keys:
            cache.set(key, time.time() + seconds, seconds)


def annotated(voter):
    voted = Exists(FeedbackVote.objects.filter(feedback=OuterRef('pk'), voter=voter)) if voter else Value(False)
    present = lambda field: Case(When(**{f'{field}__isnull': True}, then=Value(False)), default=Value(True), output_field=BooleanField())
    # The attachments themselves never leave the admin; the board only says whether they exist.
    return Feedback.objects.defer('screenshot', 'diagnostics').annotate(
        vote_count=Count('votes', distinct=True), voted=voted, has_screenshot=present('screenshot'), has_diagnostics=present('diagnostics'))


def payload(item, voter):
    public, mine = item.is_public, voter is not None and item.submitter == voter
    data = {
        'id': item.pk, 'title': item.title, 'body': item.body, 'category': item.category, 'status': item.status,
        # Votes on an item that was later declined are kept, but only public items show a count.
        'votes': item.vote_count if public else 0, 'voted': bool(item.voted) and public, 'public': public, 'mine': mine,
        'staff_response': item.staff_response or None,
        'created_at': item.created_at.isoformat(), 'published_at': item.published_at.isoformat() if item.published_at else None,
    }
    if mine:  # Only the submitter learns what they attached.
        data['attachments'] = {'screenshot': bool(item.has_screenshot), 'engine_lab_snapshot': bool(item.has_diagnostics)}
    return data


def board(request):
    account, voter, verified = viewer(request)
    sort = request.query_params.get('sort', 'top')
    if sort not in SORTS:
        raise ValidationError('sort must be top or new.')
    try:
        offset = min(max(int(request.query_params.get('offset', 0)), 0), MAX_OFFSET)
    except ValueError:
        raise ValidationError('offset must be a number.')
    page = list(annotated(voter).filter(Feedback.public()).order_by(*SORTS[sort])[offset:offset + PAGE_SIZE + 1])
    # Your own submissions of every type and status, so you can follow them through review.
    mine = list(annotated(voter).filter(submitter=voter).order_by('-created_at', '-pk')[:MINE_LIMIT]) if voter else []
    response = Response({
        'items': [payload(item, voter) for item in page[:PAGE_SIZE]], 'has_more': len(page) > PAGE_SIZE,
        'mine': [payload(item, voter) for item in mine], 'can_vote': verified, 'signed_in': account is not None,
        'categories': [{'id': value, 'label': label} for value, label in Feedback.Category.choices],
        'limits': {'title_min': TITLE_MIN, 'title': TITLE_MAX, 'body': BODY_MAX, 'voter_check_hours': settings.FEEDBACK_VERIFIED_VOTER_TTL // 3600},
        'csrf': get_token(request),
    })
    response['Cache-Control'] = 'no-store'  # Includes the viewer's own votes and submissions.
    return response


def submit(request):
    csrf(request)
    require_captcha(request)  # Before any other work; every attempt spends the challenge.
    account = current_account(request)
    ip = client_ip(request)
    submitter = identity(request, account, create=True)
    cooldowns = [f'feedback:cooldown:ip:{ip}', f'feedback:cooldown:{submitter}']
    check_cooldown(cooldowns)
    ip_key = f'feedback:ip:{ip}'
    limit(ip_key, HOUR, settings.FEEDBACK_SUBMISSIONS_PER_IP_HOUR, 'Too much feedback from this network. Try again in an hour.')
    title = clean_text(request.data.get('title'), 'The title', TITLE_MAX, TITLE_MIN, single_line=True)
    body = clean_text(request.data.get('body'), 'The details', BODY_MAX)
    category = request.data.get('category', Feedback.Category.BUG)
    if category not in Feedback.Category.values:
        raise ValidationError('Choose a bug report, an idea, or a music comment.')
    # Attachments exist only if the player opted in: the app sends them only when ticked.
    screenshot = clean_screenshot(request.data.get('screenshot'))
    diagnostics = clean_diagnostics(request.data.get('diagnostics'))
    spam.check(request.data, title, body)
    submitter_key = f'feedback:submitter:{submitter}'
    limit(submitter_key, DAY, settings.FEEDBACK_SUBMISSIONS_PER_SUBMITTER_DAY, 'You have sent the most feedback allowed today. Thank you! Try again tomorrow.')
    item = Feedback.objects.create(title=title, body=body, category=category, account=account, submitter=submitter,
                                   screenshot=screenshot, diagnostics=diagnostics)
    # Count accepted submissions, not typos: the CAPTCHA already limits failed attempts.
    record_attempt(ip_key, HOUR)
    record_attempt(submitter_key, DAY)
    start_cooldown(cooldowns)
    spam.remember(title, body)
    mark_verified(request)  # They just solved a CAPTCHA, so they can vote without another.
    notify_staff(request, item)  # A mail failure is logged; the post is saved regardless.
    item = annotated(submitter).get(pk=item.pk)
    return Response({'item': payload(item, submitter), 'detail': THANKS, 'can_vote': True, 'csrf': get_token(request)}, status=201)


@api_view(['GET', 'POST'])
def feedback_list(request):
    return board(request) if request.method == 'GET' else submit(request)


@api_view(['POST'])
def vote(request, pk):
    """Set (vote: true) or remove (vote: false) this session's or account's upvote on an accepted item. Idempotent."""
    csrf(request)
    wanted = request.data.get('vote', True)
    if not isinstance(wanted, bool):
        raise ValidationError('vote must be true or false.')
    item = get_object_or_404(Feedback.objects.filter(Feedback.public()), pk=pk)
    if not is_verified(request):
        if request.data.get('captcha_id') is None:
            return Response({'detail': VOTE_CHECK, 'captcha_required': True, 'csrf': get_token(request)}, status=403)
        require_captcha(request)
        mark_verified(request)
    account, ip = current_account(request), client_ip(request)
    ip_key = f'feedback:votes:ip:{ip}'
    limit(ip_key, HOUR, settings.FEEDBACK_VOTES_PER_IP_HOUR, 'Too many votes from this network. Try again later.')
    record_attempt(ip_key, HOUR)
    voter = identity(request, account, create=True)
    if wanted:
        if not FeedbackVote.objects.filter(feedback=item, voter=voter).exists():
            # Vote stuffing: many sessions from one network upvoting the same item. Removing a vote
            # does not give one back, so toggling cannot get around this.
            idea_key = f'feedback:idea-votes:{item.pk}:ip:{ip}'
            limit(idea_key, DAY, settings.FEEDBACK_VOTES_PER_IDEA_PER_IP_DAY, 'This item has had the most votes allowed from your network today.')
            _, created = FeedbackVote.objects.get_or_create(feedback=item, voter=voter, defaults={'account': account})
            if created:
                record_attempt(idea_key, DAY)
    else:
        FeedbackVote.objects.filter(feedback=item, voter=voter).delete()
    return Response({'id': item.pk, 'votes': item.votes.count(), 'voted': wanted, 'can_vote': True, 'csrf': get_token(request)})
