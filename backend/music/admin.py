from django.contrib import admin

from .models import Track


@admin.register(Track)
class TrackAdmin(admin.ModelAdmin):
    list_display = ['title', 'artist_name', 'author', 'is_published', 'duration_seconds', 'created_at']
    list_filter = ['is_published']
    search_fields = ['title', 'author', 'artist_name']
    readonly_fields = ['duration_seconds', 'created_at', 'updated_at']
    fields = ['title', 'author', 'artist_name', 'artist_website', 'audio', 'cover_art', 'audio_description', 'artist_description', 'is_published', 'duration_seconds', 'created_at', 'updated_at']

