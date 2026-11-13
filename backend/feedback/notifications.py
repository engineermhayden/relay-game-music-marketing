"""Email STAFF_EMAILS about each new feedback submission, so none waits unseen in the review queue."""
import logging
import smtplib

from django.conf import settings
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.urls import reverse

from accounts.services import site_url

logger = logging.getLogger(__name__)
SUBJECT_TITLE = 80


def notify_staff(request, item):
    """Send one notification to every staff address. True if sent, False if sending failed, None if none are configured.

    The submitter's email is left out: staff see the account in the admin, and player
    addresses then never sit in staff inboxes, which account deletion cannot reach.
    """
    if not settings.STAFF_EMAILS:
        return None
    context = {
        'item': item, 'category': item.get_category_display(), 'signed_in': item.account_id is not None,
        'title': item.title if len(item.title) <= SUBJECT_TITLE else item.title[:SUBJECT_TITLE - 1] + '…',
        'link': site_url(request) + reverse('admin:feedback_feedback_change', args=[item.pk]),
        # Named only: the attachments themselves stay in the admin, out of inboxes.
        'attachments': ', '.join(name for name, present in [('screenshot', item.screenshot), ('Engine lab snapshot', item.diagnostics)] if present) or 'none',
    }
    subject = ''.join(render_to_string('feedback/email/new_feedback_subject.txt', context).splitlines())
    body = render_to_string('feedback/email/new_feedback.txt', context)
    try:
        send_mail(subject, body, None, settings.STAFF_EMAILS)
        return True
    except (smtplib.SMTPException, OSError):
        # The post is saved either way; staff still find it in the review queue.
        logger.exception('Could not email staff about feedback %s.', item.pk)
        return False
