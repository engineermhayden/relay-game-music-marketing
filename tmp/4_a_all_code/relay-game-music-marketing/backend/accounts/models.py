from django.conf import settings
from django.db import models
from django.db.models.functions import Lower

USER_SELF_DELETION = 'user-self-deletion'


class Account(models.Model):
    """Optional player account. Guests can play without one.

    Staff users (admin, music uploads) are plain Django users without an Account, so a
    player sign-up never grants backend access and staff logins never appear as players.
    """
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='account')
    email = models.EmailField(max_length=254)
    email_verified_at = models.DateTimeField(null=True, blank=True)
    # Set by an email change. Recovery keys also accept the previous address, and
    # while activation is pending it is held so no one else can register it.
    previous_email = models.EmailField(max_length=254, blank=True)
    previous_email_verified_at = models.DateTimeField(null=True, blank=True)
    # The user is deactivated (is_active=False) until the new address is confirmed.
    activation_required = models.BooleanField(default=False)
    # Incremented to sign the account out of every session.
    session_epoch = models.PositiveIntegerField(default=0)
    # Recovery keys are derived from this random value and the server secret, so
    # they can be shown again without being stored. Rotating DJANGO_SECRET_KEY changes them.
    recovery_nonce = models.CharField(max_length=64, blank=True)
    recovery_used = models.JSONField(default=list, blank=True)
    recovery_created_at = models.DateTimeField(null=True, blank=True)
    # Soft deletion: personal data is scrambled, the row and its gameplay history stay for analytics.
    deleted_at = models.DateTimeField(null=True, blank=True)
    deletion_reason = models.CharField(max_length=32, blank=True, choices=[(USER_SELF_DELETION, 'User self-deletion')])
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(Lower('email'), name='account_email_ci_unique')]

    def __str__(self):
        return self.email

    @property
    def email_verified(self):
        return self.email_verified_at is not None
