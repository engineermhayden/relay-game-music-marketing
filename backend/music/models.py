import uuid
from pathlib import Path

from django.core.validators import FileExtensionValidator, URLValidator
from django.db import models

from .validators import audio_duration, validate_audio, validate_cover


def audio_path(instance, filename):
    return f'music/audio/{uuid.uuid4().hex}{Path(filename).suffix.lower()}'


def cover_path(instance, filename):
    return f'music/covers/{uuid.uuid4().hex}{Path(filename).suffix.lower()}'


class Track(models.Model):
    title = models.CharField(max_length=200)
    author = models.CharField(max_length=200, blank=True, help_text='Songwriter or composer.')
    artist_name = models.CharField('artist / band name', max_length=200, blank=True)
    artist_website = models.URLField(blank=True, validators=[URLValidator(schemes=['http', 'https'])])
    audio = models.FileField(upload_to=audio_path, validators=[validate_audio], help_text='Up to 100 MB. MP3 recommended; WAV, OGG, M4A, FLAC and Opus also accepted.')
    cover_art = models.ImageField(upload_to=cover_path, blank=True, validators=[FileExtensionValidator(['jpg', 'jpeg', 'png', 'webp']), validate_cover], help_text='JPEG, PNG or WebP, up to 5 MB.')
    audio_description = models.TextField(blank=True)
    artist_description = models.TextField('artist / group description', blank=True)
    is_published = models.BooleanField(default=True, help_text='Published songs automatically appear in the public playlist.')
    duration_seconds = models.FloatField(default=0, editable=False)
    # Stable import identity: rerunning the sample import never duplicates or overwrites edits.
    source_hash = models.CharField(max_length=64, unique=True, null=True, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['created_at', 'pk']

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if self.audio and not self.audio._committed:
            self.duration_seconds = audio_duration(self.audio)
        super().save(*args, **kwargs)

