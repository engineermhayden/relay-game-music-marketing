import json

from django.contrib import admin, messages
from django.core.exceptions import PermissionDenied
from django.db.models import Case, Count, IntegerField, Value, When
from django.db.models.functions import Length
from django.http import Http404, HttpResponse
from django.shortcuts import get_object_or_404
from django.urls import path, reverse
from django.utils.html import format_html, format_html_join

from .models import Feedback, set_status


def status_action(status, description):
    def action(modeladmin, request, queryset):
        count = set_status(queryset, status)
        modeladmin.message_user(request, f'{count} feedback {"item" if count == 1 else "items"} marked {Feedback.Status(status).label.lower()}.', messages.SUCCESS)
    action.__name__ = f'mark_{status}'
    action.short_description = description
    action.allowed_permissions = ['change']
    return action


class AttachmentFilter(admin.SimpleListFilter):
    title = 'attachments'
    parameter_name = 'attachments'

    def lookups(self, request, model_admin):
        return [('screenshot', 'Has a screenshot'), ('snapshot', 'Has an Engine lab snapshot'), ('none', 'No attachments')]

    def queryset(self, request, queryset):
        if self.value() == 'screenshot':
            return queryset.filter(screenshot__isnull=False)
        if self.value() == 'snapshot':
            return queryset.filter(diagnostics__isnull=False)
        if self.value() == 'none':
            return queryset.filter(screenshot__isnull=True, diagnostics__isnull=True)
        return queryset


@admin.register(Feedback)
class FeedbackAdmin(admin.ModelAdmin):
    """Review queue. New feedback is listed first, newest first."""
    list_display = ['title', 'category', 'status', 'votes', 'attachments', 'submitted_by', 'created_at']
    list_filter = ['status', 'category', AttachmentFilter, ('account', admin.EmptyFieldListFilter)]
    search_fields = ['title', 'body', 'staff_response']
    list_per_page = 50
    actions = [
        status_action(Feedback.Status.PLANNED, 'Accept selected feedback as planned'),
        status_action(Feedback.Status.DONE, 'Accept selected feedback as done'),
        status_action(Feedback.Status.DECLINED, 'Decline selected feedback'),
        status_action(Feedback.Status.NEW, 'Return selected feedback to new'),
    ]
    # Staff may edit the wording, for example to remove personal details before accepting an item.
    fields = ['title', 'body', 'category', 'status', 'staff_response', 'screenshot_preview', 'engine_lab_snapshot',
              'submitted_by', 'votes', 'created_at', 'updated_at', 'published_at']
    readonly_fields = ['screenshot_preview', 'engine_lab_snapshot', 'submitted_by', 'votes', 'created_at', 'updated_at', 'published_at']

    def has_add_permission(self, request):
        return False  # Feedback comes from players, through the CAPTCHA-protected form.

    def get_queryset(self, request):
        # Annotate before ordering: the default order sorts on review_order. The screenshot itself
        # is only loaded by its own view, never for the list.
        queryset = self.model._default_manager.get_queryset().select_related('account').defer('screenshot').annotate(
            vote_count=Count('votes', distinct=True),
            screenshot_size=Length('screenshot'),
            review_order=Case(When(status=Feedback.Status.NEW, then=Value(0)), default=Value(1), output_field=IntegerField()),
        )
        return queryset.order_by(*self.get_ordering(request))

    def get_ordering(self, request):
        return ['review_order', '-created_at', '-pk']

    def get_urls(self):
        return [path('<int:pk>/screenshot/', self.admin_site.admin_view(self.screenshot_view), name='feedback_feedback_screenshot'), *super().get_urls()]

    def screenshot_view(self, request, pk):
        """The screenshot bytes, for staff only. Never served from the public media volume."""
        item = get_object_or_404(Feedback, pk=pk)
        if not self.has_view_permission(request, item):
            raise PermissionDenied
        if not item.screenshot:
            raise Http404('This feedback has no screenshot.')
        response = HttpResponse(bytes(item.screenshot), content_type='image/jpeg')
        response['Content-Disposition'] = f'inline; filename="relay-feedback-{item.pk}.jpg"'
        response['Cache-Control'] = 'private, no-store'
        return response

    @admin.display(description='Votes', ordering='vote_count')
    def votes(self, feedback):
        return feedback.vote_count if hasattr(feedback, 'vote_count') else feedback.votes.count()

    @admin.display(description='Attachments')
    def attachments(self, feedback):
        found = [label for label, present in [('Screenshot', getattr(feedback, 'screenshot_size', None)), ('Engine lab', feedback.diagnostics)] if present]
        return ', '.join(found) or '—'

    @admin.display(description='Screenshot')
    def screenshot_preview(self, feedback):
        if not getattr(feedback, 'screenshot_size', None):
            return 'None attached.'
        url = reverse('admin:feedback_feedback_screenshot', args=[feedback.pk])
        return format_html('<a href="{0}" target="_blank" rel="noopener"><img src="{0}" alt="Player screenshot" style="max-width:640px;width:100%;border-radius:6px"></a><br>'
                           '<a href="{0}" target="_blank" rel="noopener">Open full size</a> · {1} KB', url, round(feedback.screenshot_size / 1024))

    @admin.display(description='Engine lab snapshot')
    def engine_lab_snapshot(self, feedback):
        data = feedback.diagnostics
        if not data:
            return 'None attached.'
        rows = []
        for section in ['browser', 'renderer', 'performance', 'settings', 'scene']:
            for key, value in (data.get(section) or {}).items():
                rows.append((f'{section}.{key}', value))
        table = format_html_join('', '<tr><th style="text-align:left;padding-right:12px">{}</th><td>{}</td></tr>', rows)
        problems = [(kind, message) for kind in ['errors', 'warnings', 'limitations'] for message in data.get(kind) or []]
        listed = format_html_join('', '<li><strong>{}</strong>: {}</li>', problems) if problems else format_html('<li>{}</li>', 'No errors, warnings or limitations reported.')
        raw = json.dumps(data, indent=2, ensure_ascii=False)
        return format_html('<p>Captured {}</p><table>{}</table><ul>{}</ul><details><summary>Raw JSON</summary><pre style="white-space:pre-wrap">{}</pre></details>',
                           data.get('captured_at') or 'at an unknown time', table, listed, raw)

    @admin.display(description='Submitted by', ordering='account__email')
    def submitted_by(self, feedback):
        if feedback.account_id is None:
            return 'Guest'
        url = reverse('admin:accounts_account_change', args=[feedback.account_id])
        # A self-deleted account keeps its feedback; its email is random text by then.
        label = 'Deleted account' if feedback.account.deleted_at else feedback.account.email
        return format_html('<a href="{}">{}</a>', url, label)
