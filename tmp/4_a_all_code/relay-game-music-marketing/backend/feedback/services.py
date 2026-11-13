"""Who is submitting or voting, and whether they have passed the CAPTCHA.

Signed-in players are identified by their account. Guests get a random token in their
session; only a keyed hash of it is stored with their feedback and votes, so a database
dump alone cannot be matched to session rows. Signing out ends the session, so a guest's
identity lasts as long as their browser session (30 days by default).
"""
import secrets
import time

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils.crypto import salted_hmac

from accounts.services import current_account

from .models import Feedback, FeedbackVote

GUEST_TOKEN = 'feedback_guest'
VERIFIED_UNTIL = 'feedback_verified_until'


def _session(request):
    return getattr(request, '_request', request).session


def account_voter(account):
    return f'account:{account.pk}'


def guest_voter(token):
    return 'guest:' + salted_hmac('feedback.guest', token, algorithm='sha256').hexdigest()[:48]


def identity(request, account=None, create=False):
    """The voter/submitter string for this request, or None for a guest without a token yet."""
    if account is not None:
        return account_voter(account)
    session = _session(request)
    token = session.get(GUEST_TOKEN)
    if not token and create:
        token = session[GUEST_TOKEN] = secrets.token_urlsafe(24)
    return guest_voter(token) if token else None


def is_verified(request):
    """Whether this browser session passed a feedback CAPTCHA recently. Required to vote, signed in or not."""
    return _session(request).get(VERIFIED_UNTIL, 0) > time.time()


def mark_verified(request):
    _session(request)[VERIFIED_UNTIL] = time.time() + settings.FEEDBACK_VERIFIED_VOTER_TTL


def link_session_feedback(request, account):
    """Give the account this browser's guest feedback and votes when the player signs in.

    Mirrors link_session_pilot: the account's data export and deletion then cover what the
    player wrote as a guest, and they cannot vote twice on one item as guest and account.
    """
    token = _session(request).get(GUEST_TOKEN)
    if not token:
        return
    guest, owner = guest_voter(token), account_voter(account)
    Feedback.objects.filter(submitter=guest, account__isnull=True).update(submitter=owner, account=account)
    for attempt in range(3):
        try:
            with transaction.atomic():
                already = FeedbackVote.objects.filter(voter=owner).values('feedback_id')
                FeedbackVote.objects.filter(voter=guest, feedback_id__in=already).delete()
                FeedbackVote.objects.filter(voter=guest).update(voter=owner, account=account)
            return
        except IntegrityError:  # The account voted on one of these items concurrently; try again.
            continue


def viewer(request):
    """(account, identity, verified) for the current request, without creating a guest token."""
    account = current_account(request)
    return account, identity(request, account), is_verified(request)
