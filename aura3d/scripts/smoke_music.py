"""Run inside the API container to verify uploads and streaming through nginx.

PowerShell: Get-Content -Raw scripts/smoke_music.py | docker compose exec -T api python -
Creates a temporary staff account and recording; removes both, including media files.
"""
import io
import os
import secrets
import wave
from urllib.parse import urlsplit

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
import django
django.setup()

import httpx
from django.contrib.auth import get_user_model
from django.urls import reverse
from PIL import Image
from music.models import Track


def main():
    username = f'music-smoke-{secrets.token_hex(6)}'
    password = secrets.token_urlsafe(32)
    staff = get_user_model().objects.create_user(username, password=password, is_staff=True, is_superuser=True)
    track_id = None
    stored_files = []
    try:
        with httpx.Client(base_url='http://nginx', headers={'Host': 'localhost', 'Accept': 'application/json'}, timeout=30) as client:
            login = client.get('/api-auth/login/')
            assert login.status_code == 200, login.status_code
            result = client.post('/api-auth/login/', data={'username': username, 'password': password, 'csrfmiddlewaretoken': client.cookies['csrftoken'], 'next': '/api/music/tracks/'})
            assert result.status_code == 302, result.status_code
            client.headers['X-CSRFToken'] = client.cookies['csrftoken']
            audio_bytes = io.BytesIO()
            with wave.open(audio_bytes, 'wb') as audio:
                audio.setnchannels(1)
                audio.setsampwidth(2)
                audio.setframerate(8000)
                audio.writeframes(b'\x00\x00' * 24000)
            cover_bytes = io.BytesIO()
            Image.new('RGB', (16, 16), 'green').save(cover_bytes, 'PNG')
            response = client.post('/api/music/tracks/', data={'title': username, 'author': 'Smoke test composer', 'artist_name': 'Smoke test artist', 'artist_website': 'https://example.com/artist', 'audio_description': 'Temporary smoke test recording.', 'artist_description': 'Temporary smoke test artist.'}, files={'audio': ('smoke.wav', audio_bytes.getvalue(), 'audio/wav'), 'cover_art': ('cover.png', cover_bytes.getvalue(), 'image/png')})
            assert response.status_code == 201, response.status_code
            result = response.json()
            track_id = result['id']
            saved = Track.objects.get(pk=track_id)
            stored_files = [saved.audio, saved.cover_art]
            assert result['is_published'] is True
            assert result['duration_seconds'] == 3
            for field in ['author', 'artist_name', 'artist_website', 'audio_description', 'artist_description']:
                assert result[field], field
            streamed = client.get(urlsplit(result['audio']).path, headers={'Range': 'bytes=0-1023'})
            assert streamed.status_code == 206, streamed.status_code
            assert len(streamed.content) == 1024
            cover = client.get(urlsplit(result['cover_art']).path)
            assert cover.status_code == 200 and cover.headers['content-type'] == 'image/png'
            assert client.get('/static/admin/css/base.css').status_code == 200
            assert client.get(reverse('admin:music_track_add')).status_code == 200
            with httpx.Client(base_url='http://nginx', headers={'Host': 'localhost'}, timeout=10) as anonymous:
                assert any(track['id'] == track_id for track in anonymous.get('/api/music/tracks/').json())
                assert anonymous.patch(f'/api/music/tracks/{track_id}/', json={'title': 'Unauthorized'}).status_code == 403
            assert client.delete(f'/api/music/tracks/{track_id}/').status_code == 204
            print('PASS: staff login, CSRF, multipart audio/cover upload, metadata, publication, admin assets, byte-range streaming, anonymous write rejection and deletion.')
    finally:
        for stored_file in stored_files:
            stored_file.delete(save=False)
        if track_id is not None:
            Track.objects.filter(pk=track_id).delete()
        staff.delete()


if __name__ == '__main__':
    main()
