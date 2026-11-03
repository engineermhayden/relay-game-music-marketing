import io
import tempfile
import wave
from pathlib import Path
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.urls import reverse
from PIL import Image
from rest_framework.test import APIClient

from .models import Track


def wav_bytes():
    buffer = io.BytesIO()
    with wave.open(buffer, 'wb') as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(8000)
        audio.writeframes(b'\x00\x00' * 8000)
    return buffer.getvalue()


def song_upload():
    return SimpleUploadedFile('recording.wav', wav_bytes(), content_type='audio/wav')


def cover_upload():
    buffer = io.BytesIO()
    Image.new('RGB', (16, 16), 'green').save(buffer, 'PNG')
    return SimpleUploadedFile('cover.png', buffer.getvalue(), content_type='image/png')


@override_settings(CACHES={'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}})
class MusicTests(TestCase):
    def setUp(self):
        media = tempfile.TemporaryDirectory()
        self.addCleanup(media.cleanup)
        settings = override_settings(MEDIA_ROOT=media.name)
        settings.enable()
        self.addCleanup(settings.disable)
        self.staff = get_user_model().objects.create_user('music-editor', password='test-only-secret', is_staff=True)
        self.client = APIClient(enforce_csrf_checks=True)

    def login_editor(self):
        self.client.force_login(self.staff)
        # Use the same CSRF cookie/token flow as the browsable API and Django admin.
        self.client.get(reverse('admin:index'))
        self.client.credentials(HTTP_X_CSRFTOKEN=self.client.cookies['csrftoken'].value)

    def test_staff_upload_metadata_public_playlist_and_edit(self):
        self.login_editor()
        response = self.client.post('/api/music/tracks/', {
            'title': 'First signal', 'author': 'Composer', 'artist_name': 'Signal Band',
            'artist_website': 'https://example.com/artist', 'audio': song_upload(),
            'cover_art': cover_upload(), 'audio_description': 'An original recording.',
            'artist_description': 'An independent band.', 'is_published': True,
        }, format='multipart')
        self.assertEqual(response.status_code, 201, response.content)
        track = response.json()
        self.assertEqual(track['duration_seconds'], 1)
        self.assertIn('/media/music/audio/', track['audio'])
        self.assertIn('/media/music/covers/', track['cover_art'])
        self.assertNotIn('source_hash', track)
        public = APIClient().get('/api/music/tracks/').json()
        self.assertEqual(public, [track])
        self.assertEqual(public[0]['author'], 'Composer')
        self.assertEqual(public[0]['artist_description'], 'An independent band.')
        result = self.client.patch(f"/api/music/tracks/{track['id']}/", {'title': 'Retitled'}, format='json')
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json()['title'], 'Retitled')
        self.assertEqual(result.json()['audio'], track['audio'])

    def test_anonymous_and_nonstaff_cannot_modify_music(self):
        track = Track.objects.create(title='Public recording', audio=song_upload())
        url = f'/api/music/tracks/{track.pk}/'
        self.assertEqual(self.client.get(url).status_code, 200)
        self.assertEqual(self.client.post('/api/music/tracks/', {'title': 'Bad', 'audio': song_upload()}, format='multipart').status_code, 403)
        self.assertEqual(self.client.patch(url, {'title': 'Bad'}, format='json').status_code, 403)
        self.assertEqual(self.client.delete(url).status_code, 403)
        visitor = get_user_model().objects.create_user('visitor', password='test-only')
        self.client.force_authenticate(visitor)
        self.assertEqual(self.client.post('/api/music/tracks/', {'title': 'Bad', 'audio': song_upload()}, format='multipart').status_code, 403)
        self.assertEqual(self.client.delete(url).status_code, 403)

    def test_staff_session_requires_csrf(self):
        self.client.force_login(self.staff)
        result = self.client.post('/api/music/tracks/', {'title': 'No token', 'audio': song_upload()}, format='multipart')
        self.assertEqual(result.status_code, 403)

    def test_drafts_hidden_and_new_songs_append_in_publish_catalog(self):
        first = Track.objects.create(title='First', audio=song_upload())
        draft = Track.objects.create(title='Draft', audio=song_upload(), is_published=False)
        last = Track.objects.create(title='Last', audio=song_upload())
        self.assertEqual([t['id'] for t in self.client.get('/api/music/tracks/').json()], [first.id, last.id])
        self.assertEqual(self.client.get(f'/api/music/tracks/{draft.id}/').status_code, 404)
        self.login_editor()
        self.assertEqual(len(self.client.get('/api/music/tracks/').json()), 3)
        self.assertEqual(self.client.patch(f'/api/music/tracks/{draft.id}/', {'is_published': True}, format='json').status_code, 200)
        self.assertEqual(len(APIClient().get('/api/music/tracks/').json()), 3)
        self.assertEqual(self.client.delete(f'/api/music/tracks/{last.id}/').status_code, 204)
        self.assertEqual(len(APIClient().get('/api/music/tracks/').json()), 2)

    def test_invalid_audio_cover_and_website_rejected(self):
        self.login_editor()
        for upload in [SimpleUploadedFile('fake.mp3', b'not audio'), SimpleUploadedFile('file.html', wav_bytes())]:
            result = self.client.post('/api/music/tracks/', {'title': 'Bad', 'audio': upload}, format='multipart')
            self.assertEqual(result.status_code, 400, result.content)
            self.assertIn('audio', result.json())
        result = self.client.post('/api/music/tracks/', {'title': 'Bad image', 'audio': song_upload(), 'cover_art': SimpleUploadedFile('fake.png', b'not an image')}, format='multipart')
        self.assertEqual(result.status_code, 400)
        self.assertIn('cover_art', result.json())
        result = self.client.post('/api/music/tracks/', {'title': 'Bad URL', 'audio': song_upload(), 'artist_website': 'javascript:alert(1)'}, format='multipart')
        self.assertEqual(result.status_code, 400)
        with patch('music.validators.MAX_AUDIO_SIZE', 10):
            result = self.client.post('/api/music/tracks/', {'title': 'Large', 'audio': song_upload()}, format='multipart')
            self.assertEqual(result.status_code, 400)
        with patch('music.validators.MAX_COVER_SIZE', 10):
            result = self.client.post('/api/music/tracks/', {'title': 'Large cover', 'audio': song_upload(), 'cover_art': cover_upload()}, format='multipart')
            self.assertEqual(result.status_code, 400)
        self.assertEqual(Track.objects.count(), 0)

    def test_import_is_idempotent_and_preserves_owner_edits(self):
        with tempfile.TemporaryDirectory() as directory:
            Path(directory, 'sample_track.wav').write_bytes(wav_bytes())
            call_command('import_songs', directory, stdout=io.StringIO())
            track = Track.objects.get()
            self.assertEqual(track.title, 'Sample Track')
            self.assertEqual(track.duration_seconds, 1)
            track.title = 'Owner title'
            track.is_published = False
            track.save()
            call_command('import_songs', directory, stdout=io.StringIO())
            self.assertEqual(Track.objects.count(), 1)
            track.refresh_from_db()
            self.assertEqual(track.title, 'Owner title')
            self.assertFalse(track.is_published)

    def test_upload_forms_available_to_staff(self):
        self.staff.user_permissions.set(Permission.objects.filter(content_type__app_label='music'))
        self.login_editor()
        form = self.client.get(reverse('admin:music_track_add'))
        self.assertEqual(form.status_code, 200)
        self.assertContains(form, 'multipart/form-data')
        self.assertContains(form, 'name="cover_art"')
        browsable = self.client.get('/api/music/tracks/', HTTP_ACCEPT='text/html')
        self.assertEqual(browsable.status_code, 200)
        self.assertContains(browsable, 'name="audio"')

    def test_multipart_upload_is_published_by_default(self):
        self.login_editor()
        response = self.client.post('/api/music/tracks/', {'title': 'New release', 'audio': song_upload()}, format='multipart')
        self.assertEqual(response.status_code, 201, response.content)
        self.assertTrue(response.json()['is_published'])
        self.assertEqual(len(APIClient().get('/api/music/tracks/').json()), 1)

