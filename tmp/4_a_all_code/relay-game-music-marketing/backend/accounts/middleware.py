from django.conf import settings

from .services import current_account


class AccountSessionMiddleware:
    """Ends sessions signed out elsewhere (password or email change, deactivation).

    Game endpoints never read request.user, so without this a stale session would
    keep its pilot until the next account request. Guest requests cost nothing.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        current_account(request)
        # Sign-in replaces the session, so a poll sent just before it finished carries a cookie
        # whose session is gone. Django would answer by deleting the cookie, which would also
        # remove the new sign-in. Sessions that really ended (modified) still clear their cookie.
        if request.session.session_key is None and not request.session.modified:
            request.COOKIES.pop(settings.SESSION_COOKIE_NAME, None)
        return self.get_response(request)
