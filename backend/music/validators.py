from pathlib import Path

from django.core.exceptions import ValidationError
from mutagen import File as AudioFile


AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'opus']
MAX_AUDIO_SIZE = 100 * 1024 * 1024
MAX_COVER_SIZE = 5 * 1024 * 1024


def audio_duration(upload):
    try:
        upload.seek(0)
        audio = AudioFile(upload)
        if audio is None or audio.info.length <= 0:
            raise ValueError('No audio')
        return round(audio.info.length, 2)
    except Exception as error:
        raise ValidationError('Upload a valid MP3, WAV, OGG, M4A, FLAC, or Opus audio file.') from error
    finally:
        upload.seek(0)


def validate_audio(upload):
    if upload.size > MAX_AUDIO_SIZE:
        raise ValidationError('Audio files must be 100 MB or smaller.')
    if Path(upload.name).suffix.lower().lstrip('.') not in AUDIO_EXTENSIONS:
        raise ValidationError('Use MP3, WAV, OGG, M4A, FLAC, or Opus. MP3 is recommended.')
    audio_duration(upload)


def validate_cover(upload):
    if upload.size > MAX_COVER_SIZE:
        raise ValidationError('Cover art must be 5 MB or smaller.')

