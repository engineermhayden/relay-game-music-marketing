import django.core.validators
import music.models
import music.validators
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True
    dependencies = []
    operations = [
        migrations.CreateModel(
            name='Track',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=200)),
                ('author', models.CharField(blank=True, help_text='Songwriter or composer.', max_length=200)),
                ('artist_name', models.CharField(blank=True, max_length=200, verbose_name='artist / band name')),
                ('artist_website', models.URLField(blank=True, validators=[django.core.validators.URLValidator(schemes=['http', 'https'])])),
                ('audio', models.FileField(help_text='Up to 100 MB. MP3 recommended; WAV, OGG, M4A, FLAC and Opus also accepted.', upload_to=music.models.audio_path, validators=[music.validators.validate_audio])),
                ('cover_art', models.ImageField(blank=True, help_text='JPEG, PNG or WebP, up to 5 MB.', upload_to=music.models.cover_path, validators=[django.core.validators.FileExtensionValidator(['jpg', 'jpeg', 'png', 'webp']), music.validators.validate_cover])),
                ('audio_description', models.TextField(blank=True)),
                ('artist_description', models.TextField(blank=True, verbose_name='artist / group description')),
                ('is_published', models.BooleanField(default=True, help_text='Published songs automatically appear in the public playlist.')),
                ('duration_seconds', models.FloatField(default=0, editable=False)),
                ('source_hash', models.CharField(editable=False, max_length=64, null=True, unique=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={'ordering': ['created_at', 'pk']},
        ),
    ]

