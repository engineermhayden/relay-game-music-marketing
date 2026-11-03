import hashlib
from pathlib import Path

from django.conf import settings
from django.core.files import File
from django.core.management.base import BaseCommand, CommandError
from mutagen import File as AudioFile

from music.models import Track
from music.validators import AUDIO_EXTENSIONS


class Command(BaseCommand):
    help = 'Import recordings once, using embedded credits when present and filenames as fallback titles.'

    def add_arguments(self, parser):
        parser.add_argument('directory', nargs='?', default=str(settings.SAMPLE_SONGS_DIR))

    def handle(self, *args, **options):
        directory = Path(options['directory'])
        if not directory.is_dir():
            raise CommandError(f'Song directory not found: {directory}')
        added = 0
        for path in sorted(directory.iterdir()):
            if not path.is_file() or path.suffix.lower().lstrip('.') not in AUDIO_EXTENSIONS:
                continue
            with path.open('rb') as source:
                digest = hashlib.file_digest(source, 'sha256').hexdigest()
            if Track.objects.filter(source_hash=digest).exists():
                continue
            metadata = AudioFile(path, easy=True)
            tags = metadata.tags if metadata and metadata.tags else {}

            def tag(name, fallback=''):
                values = tags.get(name, [])
                return str(values[0]) if values else fallback

            with path.open('rb') as source:
                track = Track(title=tag('title', path.stem.replace('_', ' ').title()), author=tag('composer'), artist_name=tag('artist'), source_hash=digest)
                track.audio = File(source, name=path.name)
                track.full_clean(exclude=['cover_art'])
                track.save()
            added += 1
            self.stdout.write(f'Imported: {track.title}')
        self.stdout.write(self.style.SUCCESS(f'{added} song(s) added. Existing songs preserved.'))

