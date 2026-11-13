from django.db import models
from django.db.models import Q, Value
from django.db.models.functions import Coalesce
from django.utils import timezone


class Feedback(models.Model):
    """A bug report, idea or music comment from a guest or a signed-in player.

    Everything arrives as New in the admin review queue. Staff accept an item by marking it
    Planned or Done, or decline it. Accepted items of every type appear on the public board,
    where players upvote them. The optional screenshot and Engine lab snapshot are only ever
    seen by staff (and the submitter's own data export), never on the board.
    """

    class Category(models.TextChoices):
        BUG = 'bug', 'Bug report'
        IDEA = 'idea', 'Idea'
        MUSIC = 'music', 'Music'

    class Status(models.TextChoices):
        NEW = 'new', 'New'
        PLANNED = 'planned', 'Planned'
        DONE = 'done', 'Done'
        DECLINED = 'declined', 'Declined'

    # Accepted statuses. Items with one of these are on the public board and open for voting.
    ACCEPTED = [Status.PLANNED, Status.DONE]

    title = models.CharField(max_length=120)
    body = models.TextField('details', max_length=2000, blank=True)
    category = models.CharField(max_length=16, choices=Category.choices, default=Category.BUG)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.NEW, db_index=True,
                              help_text='Planned and Done accept it and put it on the public board for players to upvote. New and Declined are seen only by staff and the submitter.')
    staff_response = models.TextField('team reply', max_length=1000, blank=True, help_text='Shown to the submitter, and publicly once the item is accepted.')
    # Optional attachments, sent only when the player opts in and passes the CAPTCHA. Staff-only:
    # kept in the database rather than the public media volume, and never on the board.
    screenshot = models.BinaryField(null=True, blank=True, editable=False, help_text='JPEG re-encoded by the server from the photograph capture.')
    diagnostics = models.JSONField('Engine lab snapshot', null=True, blank=True, editable=False)
    # Set for signed-in submitters, and when a guest later signs in on the same browser.
    # Self-service account deletion keeps the feedback (for analysis) and removes the account's
    # email addresses and callsigns from its text (accounts/deletion.py).
    account = models.ForeignKey('accounts.Account', null=True, blank=True, on_delete=models.SET_NULL, related_name='feedback')
    # Who submitted it: 'account:<id>' or 'guest:<keyed hash>' of a random token in the guest's session.
    submitter = models.CharField(max_length=64, db_index=True, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    # When staff first accepted it; the public board's "New" order.
    published_at = models.DateTimeField(null=True, blank=True, editable=False)

    class Meta:
        verbose_name = 'feedback'
        verbose_name_plural = 'feedback'
        indexes = [models.Index(fields=['status', '-published_at'], name='feedback_board')]

    def __str__(self):
        return self.title

    @property
    def is_accepted(self):
        return self.status in self.ACCEPTED

    @property
    def is_public(self):
        """On the public board, and open for voting: every accepted item, whatever its type."""
        return self.is_accepted

    @classmethod
    def public(cls):
        return Q(status__in=cls.ACCEPTED)

    def save(self, *args, **kwargs):
        if self.is_accepted and self.published_at is None:
            self.published_at = timezone.now()
            if kwargs.get('update_fields') is not None:
                kwargs['update_fields'] = {*kwargs['update_fields'], 'published_at'}
        super().save(*args, **kwargs)


def set_status(queryset, status):
    """Bulk status change that also stamps first acceptance, which a plain update() would skip."""
    # One UPDATE: the queryset may be filtered by status (an admin changelist filter), so a
    # second query after changing the status would no longer match the same rows.
    if status in Feedback.ACCEPTED:
        return queryset.update(status=status, published_at=Coalesce('published_at', Value(timezone.now())), updated_at=timezone.now())
    return queryset.update(status=status, updated_at=timezone.now())


class FeedbackVote(models.Model):
    """One upvote per voter (session or account) per item. Votes are only accepted on accepted (public) items."""
    feedback = models.ForeignKey(Feedback, on_delete=models.CASCADE, related_name='votes')
    # Same format as Feedback.submitter.
    voter = models.CharField(max_length=64)
    account = models.ForeignKey('accounts.Account', null=True, blank=True, on_delete=models.SET_NULL, related_name='feedback_votes')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['feedback', 'voter'], name='one_vote_per_voter')]
        indexes = [models.Index(fields=['voter'], name='feedback_vote_voter')]
