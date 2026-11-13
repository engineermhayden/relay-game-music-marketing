"""Content checks that reject spam after the CAPTCHA and before anything is saved.

The CAPTCHA and rate limits stop automated volume; these catch what a person (or a
solver service) pastes: link drops, blocked words, keyboard mashing and resubmissions.
"""
import hashlib
import re

from django.conf import settings
from django.core.cache import cache
from rest_framework.exceptions import ValidationError

LINK = re.compile(r'https?://|www\.', re.IGNORECASE)
REPEATED = re.compile(r'(\S)\1{24,}')  # One character 25 or more times in a row.
DUPLICATE_WINDOW = 24 * 60 * 60
# The form's hidden honeypot field. People never see it; form-filling bots often fill it in.
HONEYPOT = 'website'
SPAM = 'This looks like spam, so it was not sent.'


def _words(text):
    """A blocked word or phrase, as whole words, ignoring case and how much space separates a phrase's words."""
    phrases = sorted(settings.FEEDBACK_BLOCKED_WORDS, key=len, reverse=True)
    pattern = '|'.join(r'\s+'.join(re.escape(word) for word in phrase.split()) for phrase in phrases)
    return re.compile(rf'(?<!\w)(?:{pattern})(?!\w)', re.IGNORECASE).search(text)


def _fingerprint(title, body):
    normalized = ' '.join(f'{title}\n{body}'.casefold().split())
    return 'feedback:duplicate:' + hashlib.sha256(normalized.encode()).hexdigest()


def check(data, title, body):
    """Raise ValidationError if a submission looks like spam. Call remember() once it is saved."""
    if data.get(HONEYPOT):
        raise ValidationError(SPAM)
    if LINK.search(title):
        raise ValidationError('Titles cannot contain links. Put a link in the details instead.')
    if len(LINK.findall(body)) > settings.FEEDBACK_MAX_LINKS:
        allowed = settings.FEEDBACK_MAX_LINKS
        raise ValidationError(f'Feedback can include at most {allowed} {"link" if allowed == 1 else "links"}.' if allowed else 'Feedback cannot include links.')
    if settings.FEEDBACK_BLOCKED_WORDS and (_words(title) or _words(body)):
        raise ValidationError(SPAM)
    if REPEATED.search(title) or REPEATED.search(body):
        raise ValidationError('Remove the long run of repeated characters and try again.')
    if sum(character.isalpha() for character in title) < 3:
        raise ValidationError('The title needs a few words describing your feedback.')
    if cache.get(_fingerprint(title, body)):
        raise ValidationError('We already received this exact feedback recently. Thank you!')


def remember(title, body):
    """Reject identical feedback, from anyone, for the next 24 hours."""
    cache.set(_fingerprint(title, body), 1, DUPLICATE_WINDOW)
