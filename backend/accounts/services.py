import hashlib
import logging
import secrets
import smtplib
from urllib.parse import urlencode

from django.conf import settings
from django.contrib.auth import SESSION_KEY, get_user, login, logout
from django.contrib.auth.tokens import default_token_generator
from django.core import signing
from django.core.cache import cache
from django.core.mail import send_mail
from django.db.models import Q
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.crypto import constant_time_compare, salted_hmac
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode

from .models import Account

logger = logging.getLogger(__name__)
VERIFY_SALT = 'accounts.verify-email'
SESSION_EPOCH = 'account_session_epoch'
RECOVERY_KEY_COUNT = 8


def _django(request):
    return getattr(request, '_request', request)


def current_account(request):
    """The signed-in player's Account for a Django or DRF request, or None.

    DRF authentication is disabled project-wide, and DRF then replaces the
    middleware's request.user with None, so read the user from the session.
    Sessions that no longer belong to an active account are signed out: after a
    password change (Django's session hash), deactivation, or a sign-out of every
    session (the account's session epoch). Staff sessions are left untouched.
    """
    django_request = _django(request)
    if SESSION_KEY not in django_request.session:
        return None  # Guests: no queries.
    user = get_user(django_request)
    if not user.is_authenticated:
        logout(django_request)
        return None
    account = Account.objects.filter(user=user).first()
    if account and django_request.session.get(SESSION_EPOCH, 0) != account.session_epoch:
        logout(django_request)
        return None
    return account


def sign_in(request, account):
    django_request = _django(request)
    login(django_request, account.user)
    django_request.session[SESSION_EPOCH] = account.session_epoch
    link_session_pilot(request, account)


def end_all_sessions(account):
    """Sign the account out everywhere on the next request. The caller saves."""
    account.session_epoch += 1


def account_payload(account):
    if account is None:
        return None
    return {
        'email': account.email, 'email_verified': account.email_verified, 'created': account.created_at.isoformat(),
        'recovery_keys_remaining': RECOVERY_KEY_COUNT - len(account.recovery_used) if account.recovery_nonce else None,
    }


def email_in_use(email, account=None):
    """Taken by another account, or held as the old address of an unconfirmed email change."""
    taken = Account.objects.filter(Q(email__iexact=email) | Q(previous_email__iexact=email, activation_required=True))
    return taken.exclude(pk=getattr(account, 'pk', None)).exists()


def link_session_pilot(request, account):
    """Attach this browser's guest pilot to the account that just signed in.

    Keeps the current squad membership, so signing in mid-expedition does not
    interrupt play. A pilot already owned by another account is never reassigned;
    the session drops it instead, so play is never attributed to the wrong account.
    """
    from game.models import Pilot  # game.views imports this module.
    session = _django(request).session
    pilot_id = session.get('pilot_id')
    if not pilot_id:
        return
    Pilot.objects.filter(id=pilot_id, account__isnull=True).update(account=account)
    if Pilot.objects.filter(id=pilot_id).exclude(account=account).exists():
        session.pop('pilot_id', None)


# Recovery keys: eight 12-digit numbers derived with HMAC from the server secret,
# the account and a random per-set nonce. The database stores only the nonce and
# which keys were used, so a database leak alone reveals no keys, yet the same keys
# can be shown again until they are regenerated.
def _recovery_key(account, index):
    digest = salted_hmac('accounts.recovery-key', f'{account.pk}:{account.recovery_nonce}:{index}', algorithm='sha256').digest()
    return str(int.from_bytes(digest, 'big') % 10 ** 12).zfill(12)


def recovery_keys(account):
    return [_recovery_key(account, index) for index in range(RECOVERY_KEY_COUNT)]


def create_recovery_keys(account):
    """Replace the account's keys; earlier keys stop working. The caller saves."""
    while True:
        account.recovery_nonce = secrets.token_hex(16)
        if len(set(recovery_keys(account))) == RECOVERY_KEY_COUNT:
            break
    account.recovery_used = []
    account.recovery_created_at = timezone.now()


def recovery_set_id(account):
    """Public fingerprint of the current key set, so a change confirms the keys actually shown."""
    return salted_hmac('accounts.recovery-set', f'{account.pk}:{account.recovery_nonce}').hexdigest()[:16]


def format_recovery_key(key):
    return f'{key[:4]}-{key[4:8]}-{key[8:]}'


def normalize_recovery_key(value):
    digits = ''.join(character for character in value if character.isdigit()) if isinstance(value, str) and len(value) <= 40 else ''
    return digits if len(digits) == 12 else None


def unused_recovery_key_index(account, key):
    if not account.recovery_nonce or key is None:
        return None
    for index, candidate in enumerate(recovery_keys(account)):
        if index not in account.recovery_used and constant_time_compare(candidate, key):
            return index
    return None


# Verification links only prove control of an address, so a signed, expiring
# payload is enough. It is bound to the address, so it dies if the email changes.
def email_verification_token(account):
    return signing.dumps({'user': account.user_id, 'email': account.email.lower()}, salt=VERIFY_SALT)


def account_from_verification_token(token):
    try:
        data = signing.loads(token, salt=VERIFY_SALT, max_age=settings.ACCOUNT_EMAIL_VERIFICATION_MAX_AGE)
    except signing.BadSignature:  # Includes SignatureExpired.
        return None
    if not isinstance(data, dict):
        return None
    return Account.objects.filter(user_id=data.get('user'), email__iexact=data.get('email', '')).select_related('user').first()


def site_url(request):
    # Prefer the configured public origin: email links must not depend on request headers.
    return settings.PUBLIC_SITE_URL or request.build_absolute_uri('/').rstrip('/')


def _link(request, **params):
    # Tokens travel in the URL fragment, which browsers never send to servers or in Referer headers.
    return f'{site_url(request)}/#{urlencode(params)}'


def _send(template, context, recipient):
    subject = ''.join(render_to_string(f'accounts/email/{template}_subject.txt', context).splitlines())
    body = render_to_string(f'accounts/email/{template}.txt', context)
    try:
        send_mail(subject, body, None, [recipient])
        return True
    except (smtplib.SMTPException, OSError):
        logger.exception('Could not send the %s email.', template)
        return False


def send_verification_email(request, account):
    """Sign-up verification, or reactivation after an email change."""
    link = _link(request, account='verify-email', token=email_verification_token(account))
    hours = settings.ACCOUNT_EMAIL_VERIFICATION_MAX_AGE // 3600
    template = 'activate_email' if account.activation_required else 'verify_email'
    return _send(template, {'link': link, 'email': account.email, 'hours': hours}, account.email)


def send_email_changed_notice(request, account):
    """Tell the previous address, so an unwanted change can be undone with a recovery key."""
    return _send('email_changed', {'old': account.previous_email, 'new': account.email, 'site': site_url(request)}, account.previous_email)


def send_account_deleted_notice(address):
    return _send('account_deleted', {'email': address}, address)


def send_password_reset_email(request, account):
    user = account.user
    link = _link(request, account='reset-password', uid=urlsafe_base64_encode(force_bytes(user.pk)), token=default_token_generator.make_token(user))
    minutes = settings.PASSWORD_RESET_TIMEOUT // 60
    return _send('password_reset', {'link': link, 'email': account.email, 'minutes': minutes}, account.email)


def client_ip(request):
    return request.META.get('REMOTE_ADDR', '')


def email_key(email):
    return hashlib.sha256(email.strip().lower().encode()).hexdigest()[:32]


def attempts(key):
    return cache.get(f'accounts:{key}', 0)


def record_attempt(key, window):
    """Count an event in a fixed window and return the new total."""
    key = f'accounts:{key}'
    cache.add(key, 0, window)
    try:
        return cache.incr(key)
    except ValueError:  # Expired between add and incr.
        cache.set(key, 1, window)
        return 1


def clear_attempts(key):
    cache.delete(f'accounts:{key}')
