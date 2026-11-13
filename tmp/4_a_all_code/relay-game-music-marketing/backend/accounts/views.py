"""Optional email/password accounts. None of these endpoints are needed to play."""
import secrets

from django.conf import settings
from django.contrib.auth import get_user_model, logout
from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core import signing
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.utils import timezone
from django.utils.http import urlsafe_base64_decode
from rest_framework.decorators import api_view
from rest_framework.exceptions import APIException, PermissionDenied, Throttled, ValidationError
from rest_framework.response import Response

from game.views import csrf

import redis

from . import captcha
from .captcha import require_captcha
from .deletion import delete_account
from .export import export_account, export_filename
from .models import Account
from .services import (
    account_from_verification_token, account_payload, attempts, clear_attempts, client_ip, create_recovery_keys,
    current_account, email_in_use, email_key, end_all_sessions, format_recovery_key, normalize_recovery_key,
    record_attempt, recovery_keys, recovery_set_id, send_account_deleted_notice, send_email_changed_notice, send_password_reset_email,
    send_verification_email, sign_in, unused_recovery_key_index,
)

MAX_EMAIL = 254
MAX_PASSWORD = 128
HOUR = 60 * 60
LOGIN_WINDOW = 15 * 60
EMAIL_TAKEN = 'An account with this email already exists. Sign in or reset your password.'
RESET_SENT = 'If an account uses that email, a reset link is on its way. Check your inbox and spam folder.'
BAD_LOGIN = 'Email or password is incorrect.'
BAD_RECOVERY = 'That email and recovery key do not match an account, or the key was already used.'
TOO_MANY_LOGINS = 'Too many sign-in attempts. Wait 15 minutes or reset your password.'
RESEND_SALT = 'accounts.resend-activation'
RESEND_MAX_AGE = 15 * 60


class EmailUnavailable(APIException):
    status_code = 503
    default_detail = 'We could not send the email right now. Try again in a few minutes.'


def respond(request, account, status=200, **extra):
    # login() rotates the CSRF token, so always return the current one.
    return Response({'account': account_payload(account), 'csrf': get_token(request), **extra}, status=status)


def limit(key, window, maximum, message):
    if record_attempt(key, window) > maximum:
        raise Throttled(window, message)


def clean_email(value):
    if not isinstance(value, str) or len(value.strip()) > MAX_EMAIL:
        raise ValidationError('Enter a valid email address.')
    try:
        validate_email(value.strip())
    except DjangoValidationError:
        raise ValidationError('Enter a valid email address.')
    return BaseUserManager.normalize_email(value.strip())


def clean_password(value, user):
    if not isinstance(value, str) or not value:
        raise ValidationError('Enter a password.')
    if len(value) > MAX_PASSWORD:
        raise ValidationError(f'Passwords can be at most {MAX_PASSWORD} characters.')
    try:
        validate_password(value, user)
    except DjangoValidationError as error:
        raise ValidationError(error.messages)
    return value


def signed_in_account(request):
    account = current_account(request)
    if account is None:
        raise PermissionDenied('Sign in to manage your account.')
    return account


def check_current_password(account, password):
    """Re-authenticate before sensitive changes; wrong guesses count toward the sign-in lockout."""
    if not isinstance(password, str) or not password:
        raise ValidationError('Enter your current password.')
    failures = f'login:email:{email_key(account.email)}'
    if attempts(failures) >= settings.ACCOUNT_LOGIN_FAILURES_PER_EMAIL:
        raise Throttled(LOGIN_WINDOW, TOO_MANY_LOGINS)
    if len(password) > MAX_PASSWORD or not account.user.check_password(password):
        record_attempt(failures, LOGIN_WINDOW)
        raise ValidationError('Your current password is incorrect.')


def credentials_account(request, email, password):
    """An account matching an email and password, with the sign-in lockout applied."""
    if not isinstance(email, str) or not isinstance(password, str) or not email.strip() or not password:
        raise ValidationError('Enter your email and password.')
    if len(email) > MAX_EMAIL or len(password) > MAX_PASSWORD:
        raise ValidationError(BAD_LOGIN)
    ip_key, email_attempts = f'login:ip:{client_ip(request)}', f'login:email:{email_key(email)}'
    if attempts(ip_key) >= settings.ACCOUNT_LOGIN_FAILURES_PER_IP or attempts(email_attempts) >= settings.ACCOUNT_LOGIN_FAILURES_PER_EMAIL:
        raise Throttled(LOGIN_WINDOW, TOO_MANY_LOGINS)
    account = Account.objects.filter(email__iexact=email.strip()).select_related('user').first()
    if account is None:
        get_user_model()().set_password(password)  # Same hashing cost as a real check, like ModelBackend.
    elif account.user.check_password(password):
        clear_attempts(email_attempts)
        return account
    record_attempt(ip_key, LOGIN_WINDOW)
    record_attempt(email_attempts, LOGIN_WINDOW)
    raise ValidationError(BAD_LOGIN)


@api_view(['GET'])
def captcha_challenge(request):
    """A new single-use CAPTCHA image. Never cached; every page load and failed attempt gets a new one."""
    limit(f'captcha:ip:{client_ip(request)}', 10 * 60, settings.ACCOUNT_CAPTCHAS_PER_IP, 'Too many CAPTCHA images requested. Wait a few minutes.')
    challenge_id, image = captcha.new_challenge()
    response = Response({'captcha_id': challenge_id, 'image': image, 'expires_in': settings.ACCOUNT_CAPTCHA_TTL})
    response['Cache-Control'] = 'no-store'
    return response


@api_view(['GET'])
def account_detail(request):
    return respond(request, current_account(request))


@api_view(['POST'])
def signup(request):
    csrf(request)
    require_captcha(request)
    # Count created accounts, not typos: people sharing a network may retry weak passwords.
    ip_key = f'signup:ip:{client_ip(request)}'
    if attempts(ip_key) >= settings.ACCOUNT_SIGNUPS_PER_IP_HOUR:
        raise Throttled(HOUR, 'Too many new accounts from this network. Try again later.')
    email = clean_email(request.data.get('email'))
    if email_in_use(email):
        raise ValidationError(EMAIL_TAKEN)
    # Players sign in by email; the username is an internal, never-displayed identifier.
    user = get_user_model()(username=f'player-{secrets.token_hex(8)}', email=email)
    password = clean_password(request.data.get('password'), user)
    try:
        with transaction.atomic():
            user.set_password(password)
            user.save()
            account = Account.objects.create(user=user, email=email)
    except IntegrityError:  # A concurrent sign-up claimed the address.
        raise ValidationError(EMAIL_TAKEN)
    record_attempt(ip_key, HOUR)
    sign_in(request, account)
    record_attempt(f'verify:account:{account.pk}', HOUR)
    sent = send_verification_email(request, account)
    return respond(request, account, status=201, verification_sent=sent)


@api_view(['POST'])
def signin(request):
    csrf(request)
    require_captcha(request)
    account = credentials_account(request, request.data.get('email'), request.data.get('password'))
    if account.activation_required:
        # Only reported after the correct password, so it reveals nothing to guessers.
        return Response({'detail': f'Confirm {account.email} to reactivate your account. Open the link we emailed, or send a new one.',
                         'activation_required': True, 'email': account.email, 'csrf': get_token(request),
                         # Lets this browser ask for a new link without sending the password again.
                         'resend_token': signing.dumps({'account': account.pk, 'email': account.email.lower()}, salt=RESEND_SALT)}, status=403)
    if not account.user.is_active:
        raise ValidationError(BAD_LOGIN)  # Deactivated by staff.
    sign_in(request, account)
    return respond(request, account)


@api_view(['POST'])
def signout(request):
    csrf(request)
    # Ends the whole browser session, including its pilot, so a shared device does
    # not keep playing as (or recording results for) the signed-out account.
    logout(request._request)
    return respond(request, None)


@api_view(['POST'])
def verify_email(request):
    csrf(request)
    token = request.data.get('token')
    account = account_from_verification_token(token) if isinstance(token, str) and len(token) <= 512 else None
    if account is None:
        raise ValidationError('This verification link is invalid or has expired. Sign in to send a new one.')
    with transaction.atomic():
        if not account.email_verified:
            account.email_verified_at = timezone.now()
        reactivated = account.activation_required
        if reactivated:
            # Confirming the new address after an email change reactivates the account.
            account.activation_required = False
            account.user.is_active = True
            account.user.save(update_fields=['is_active'])
        account.save(update_fields=['email_verified_at', 'activation_required'])
    # The link may be opened in a browser that is signed out or signed in as someone else.
    return respond(request, current_account(request), verified_email=account.email, reactivated=reactivated)


@api_view(['POST'])
def resend_verification(request):
    csrf(request)
    account = current_account(request)
    if account is None:
        # A deactivated account cannot sign in. Its CAPTCHA-protected sign-in attempt issued a
        # short-lived token instead, so this endpoint never checks passwords (no CAPTCHA bypass).
        token = request.data.get('resend_token')
        if not isinstance(token, str) or not token:
            raise PermissionDenied('Sign in to verify your email.')
        try:
            data = signing.loads(token, salt=RESEND_SALT, max_age=RESEND_MAX_AGE)
        except signing.BadSignature:
            raise ValidationError('This request expired. Sign in again to send a new activation link.')
        account = Account.objects.filter(pk=data.get('account'), email__iexact=data.get('email', ''), activation_required=True).first()
        if account is None:
            raise ValidationError('This request expired. Sign in again to send a new activation link.')
    if account.email_verified:
        return respond(request, account, verification_sent=False)
    limit(f'verify:account:{account.pk}', HOUR, settings.ACCOUNT_EMAILS_PER_ADDRESS_HOUR, 'Verification email limit reached. Check your spam folder or try again in an hour.')
    if not send_verification_email(request, account):
        raise EmailUnavailable()
    return respond(request, current_account(request), verification_sent=True, email=account.email)


@api_view(['POST'])
def password_reset(request):
    csrf(request)
    require_captcha(request)
    email = clean_email(request.data.get('email'))
    limit(f'reset:ip:{client_ip(request)}', HOUR, settings.ACCOUNT_RESETS_PER_IP_HOUR, 'Too many reset requests from this network. Try again later.')
    # Accounts awaiting activation can reset too; the link goes to the new address and confirms it.
    account = Account.objects.filter(Q(user__is_active=True) | Q(activation_required=True), email__iexact=email).select_related('user').first()
    # Same response whether or not the account exists; per-address limits stop inbox flooding.
    if account and record_attempt(f'reset:email:{email_key(email)}', HOUR) <= settings.ACCOUNT_EMAILS_PER_ADDRESS_HOUR:
        send_password_reset_email(request, account)
    return Response({'detail': RESET_SENT, 'csrf': get_token(request)})


@api_view(['POST'])
def password_reset_confirm(request):
    csrf(request)
    uid, token = request.data.get('uid'), request.data.get('token')
    user = None
    if isinstance(uid, str) and isinstance(token, str) and len(uid) <= 64 and len(token) <= 128:
        try:
            user = get_user_model().objects.select_related('account').get(pk=urlsafe_base64_decode(uid).decode(), account__isnull=False)
        except (TypeError, ValueError, OverflowError, UnicodeDecodeError, get_user_model().DoesNotExist):
            user = None
    # The token is single use: it hashes the current password, last login and email.
    if user is None or not (user.is_active or user.account.activation_required) or not default_token_generator.check_token(user, token):
        raise ValidationError('This reset link is invalid or has expired. Request a new one.')
    password = clean_password(request.data.get('password'), user)
    account = user.account
    with transaction.atomic():
        user.set_password(password)
        user.is_active = True
        user.save(update_fields=['password', 'is_active'])
        # Receiving the reset link proves control of the address, which also completes a pending activation.
        if not account.email_verified:
            account.email_verified_at = timezone.now()
        account.activation_required = False
        end_all_sessions(account)
        account.save(update_fields=['email_verified_at', 'activation_required', 'session_epoch'])
    clear_attempts(f'login:email:{email_key(account.email)}')
    sign_in(request, account)
    return respond(request, account)


@api_view(['POST'])
def recovery_key_list(request):
    """Show the account's recovery keys, creating them if needed, or replace them with `regenerate`."""
    csrf(request)
    account = signed_in_account(request)
    check_current_password(account, request.data.get('password'))
    with transaction.atomic():
        account = Account.objects.select_for_update().get(pk=account.pk)
        if request.data.get('regenerate') is True or not account.recovery_nonce:
            create_recovery_keys(account)
            account.save(update_fields=['recovery_nonce', 'recovery_used', 'recovery_created_at'])
    keys = [{'key': format_recovery_key(key), 'used': index in account.recovery_used} for index, key in enumerate(recovery_keys(account))]
    return respond(request, account, keys=keys, recovery_set=recovery_set_id(account), recovery_created=account.recovery_created_at.isoformat())


@api_view(['POST'])
def change_credentials(request):
    """Change email and/or password. Both sign the account out of every session, including this one.

    `validate_only` checks everything without changing anything, so the client can
    warn about the sign-out (and show recovery keys) only for a request that will succeed.
    An email change also requires `keys_confirmed` and the `recovery_set` that was shown,
    then deactivates the account until the new address is confirmed.
    """
    csrf(request)
    account = signed_in_account(request)
    user = account.user
    check_current_password(account, request.data.get('current_password'))
    new_email, new_password = request.data.get('new_email') or None, request.data.get('new_password') or None
    if new_email is not None:
        new_email = clean_email(new_email)
        if new_email.lower() == account.email.lower():
            raise ValidationError('That is already your email address.')
        if email_in_use(new_email, account):
            raise ValidationError('Another account already uses that email.')
    if new_password is not None:
        clean_password(new_password, get_user_model()(username=user.username, email=new_email or account.email))
    if new_email is None and new_password is None:
        raise ValidationError('Enter a new email, a new password, or both.')
    if request.data.get('validate_only') is True:
        return respond(request, account, valid=True)
    if new_email and (request.data.get('keys_confirmed') is not True or not account.recovery_nonce
                      or request.data.get('recovery_set') != recovery_set_id(account)):
        raise ValidationError('Confirm you have stored your current recovery keys before changing your email.')
    try:
        with transaction.atomic():
            if new_password:
                user.set_password(new_password)
            if new_email:
                account.previous_email, account.previous_email_verified_at = account.email, account.email_verified_at
                account.email, account.email_verified_at, account.activation_required = new_email, None, True
                user.email, user.is_active = new_email, False
            end_all_sessions(account)
            user.save()
            account.save()
    except IntegrityError:  # A concurrent sign-up claimed the address.
        raise ValidationError('Another account already uses that email.')
    logout(request._request)
    activation_sent = None
    if new_email:
        record_attempt(f'verify:account:{account.pk}', HOUR)
        activation_sent = send_verification_email(request, account)
        send_email_changed_notice(request, account)
    return respond(request, None, email=account.email, email_changed=bool(new_email), password_changed=bool(new_password), activation_sent=activation_sent)


@api_view(['POST'])
def recover(request):
    """Regain access with an unused recovery key and a new password.

    Identifies the account by its current or previous email. If an email change is
    still awaiting confirmation, the previous email is restored. Each key works once.
    """
    csrf(request)
    email, key = request.data.get('email'), normalize_recovery_key(request.data.get('key'))
    if not isinstance(email, str) or not email.strip() or len(email) > MAX_EMAIL:
        raise ValidationError('Enter your account email.')
    ip_key, email_attempts = f'recover:ip:{client_ip(request)}', f'recover:email:{email_key(email)}'
    if attempts(ip_key) >= settings.ACCOUNT_LOGIN_FAILURES_PER_IP or attempts(email_attempts) >= settings.ACCOUNT_LOGIN_FAILURES_PER_EMAIL:
        raise Throttled(LOGIN_WINDOW, 'Too many recovery attempts. Try again in 15 minutes.')
    match = None
    for candidate in Account.objects.filter(Q(email__iexact=email.strip()) | Q(previous_email__iexact=email.strip())).select_related('user'):
        index = unused_recovery_key_index(candidate, key)
        # Staff-deactivated accounts stay deactivated.
        if index is not None and (candidate.user.is_active or candidate.activation_required):
            match = candidate, index
            break
    if match is None:
        record_attempt(ip_key, LOGIN_WINDOW)
        record_attempt(email_attempts, LOGIN_WINDOW)
        raise ValidationError(BAD_RECOVERY)
    account, index = match
    password = clean_password(request.data.get('password'), account.user)  # Before the key is spent.
    with transaction.atomic():
        account = Account.objects.select_for_update().select_related('user').get(pk=account.pk)
        if index in account.recovery_used:  # Spent by a concurrent request.
            raise ValidationError(BAD_RECOVERY)
        account.recovery_used = [*account.recovery_used, index]
        if account.activation_required:
            # Undo the unconfirmed email change. The old address was held, so it is still free.
            account.email, account.email_verified_at = account.previous_email, account.previous_email_verified_at
            account.previous_email, account.previous_email_verified_at = '', None
            account.activation_required = False
        user = account.user
        user.email, user.is_active = account.email, True
        user.set_password(password)
        end_all_sessions(account)
        user.save()
        account.save()
    clear_attempts(email_attempts)
    clear_attempts(f'login:email:{email_key(account.email)}')
    sign_in(request, account)
    return respond(request, account)


@api_view(['POST'])
def export_data(request):
    """Download what RELAY stores about the signed-in player as a JSON file. Requires the current password."""
    csrf(request)
    account = signed_in_account(request)
    check_current_password(account, request.data.get('password'))
    now = timezone.now()
    response = JsonResponse(export_account(account, now), json_dumps_params={'indent': 2, 'ensure_ascii': False})
    response['Content-Disposition'] = f'attachment; filename="{export_filename(now)}"'
    response['Cache-Control'] = 'no-store'  # Personal data: keep it out of browser and proxy caches.
    return response


class DeletionUnavailable(APIException):
    status_code = 503
    default_detail = 'We could not delete your account right now. Nothing was changed; try again in a minute.'


@api_view(['POST'])
def delete_self(request):
    """Self-service deletion: scramble personal data, keep anonymous gameplay history. Signs out everywhere."""
    csrf(request)
    account = signed_in_account(request)
    check_current_password(account, request.data.get('password'))
    if request.data.get('confirm') is not True:
        raise ValidationError('Confirm that you understand your account cannot be restored.')
    address = account.email
    try:
        delete_account(account)
    except redis.exceptions.RedisError:  # Live game state unreachable; nothing was changed.
        raise DeletionUnavailable()
    logout(request._request)
    send_account_deleted_notice(address)  # The only remaining use of the address, which is not stored.
    return respond(request, None, deleted=True)
