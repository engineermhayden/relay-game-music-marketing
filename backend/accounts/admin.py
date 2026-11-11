from django.contrib import admin

from .models import Account


@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = ['email', 'email_verified', 'activation_required', 'deletion_reason', 'created_at']
    list_filter = [('email_verified_at', admin.EmptyFieldListFilter), 'activation_required', 'deletion_reason']
    search_fields = ['email', 'previous_email']
    # Email is the login and reset address; changing it here would bypass verification.
    readonly_fields = ['user', 'email', 'previous_email', 'activation_required', 'recovery_keys', 'deleted_at', 'deletion_reason', 'created_at']
    fields = ['user', 'email', 'email_verified_at', 'previous_email', 'activation_required', 'recovery_keys', 'deleted_at', 'deletion_reason', 'created_at']

    def has_add_permission(self, request):
        return False  # Accounts are created through sign-up so they get a verification email.

    @admin.display(description='Recovery keys')
    def recovery_keys(self, account):
        # Never display the keys themselves to staff.
        return f'{8 - len(account.recovery_used)} of 8 unused' if account.recovery_nonce else 'Not created'

    @admin.display(boolean=True, description='Email verified')
    def email_verified(self, account):
        return account.email_verified
