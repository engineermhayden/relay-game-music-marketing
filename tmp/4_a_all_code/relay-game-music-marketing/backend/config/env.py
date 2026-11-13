"""Typed readers for settings that come from the environment (.env, or the Compose environment).

Invalid values stop the server at startup with a clear message, rather than failing later.
"""
import os

from django.core.exceptions import ImproperlyConfigured, ValidationError
from django.core.validators import validate_email


def env_int(name, default, minimum=1):
    """A whole number of at least `minimum`. Unset or blank uses the default."""
    raw = os.getenv(name, '').strip()
    if not raw:
        return default
    try:
        value = int(raw)
    except ValueError:
        raise ImproperlyConfigured(f'{name} must be a whole number, not {raw!r}.')
    if value < minimum:
        raise ImproperlyConfigured(f'{name} must be at least {minimum}.')
    return value


def env_list(name):
    """A comma-separated list of words or phrases. Blank entries are skipped and duplicates (any case) removed."""
    entries, seen = [], set()
    for entry in os.getenv(name, '').split(','):
        entry = ' '.join(entry.split())
        if entry and entry.casefold() not in seen:
            seen.add(entry.casefold())
            entries.append(entry)
    return entries


def env_emails(name):
    """A comma-separated list of email addresses. Blank entries are skipped and duplicates (any case) removed."""
    addresses, seen = [], set()
    for entry in os.getenv(name, '').split(','):
        address = entry.strip()
        if not address:
            continue
        try:
            validate_email(address)
        except ValidationError:
            raise ImproperlyConfigured(f'{name} must be a comma-separated list of email addresses; {address!r} is not one.')
        if address.lower() not in seen:
            seen.add(address.lower())
            addresses.append(address)
    return addresses
