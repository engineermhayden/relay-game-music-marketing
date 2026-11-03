import json
import time
from contextlib import contextmanager
import redis
from django.conf import settings
from django.contrib.gis.geos import Point
from django.utils import timezone
from .models import Room, Membership, MissionEvent
from .simulation import new_world, add_player, public_state

store = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True, socket_timeout=3, socket_connect_timeout=3)

@contextmanager
def locked_room(code):
    with store.lock(f'lock:{code}', timeout=10, blocking_timeout=4):
        raw = store.get(f'room:{code}')
        if raw:
            state = json.loads(raw)
        else:
            room = Room.objects.get(code=code)
            state = room.snapshot or new_world(room.seed)
            # Memberships survive Redis loss and process restarts.
            for member in room.members.select_related('pilot'):
                add_player(state, str(member.pilot_id), member.pilot.name)
        yield state
        store.set(f'room:{code}', json.dumps(state), ex=86400)
        if state['status'] == 'active':
            store.sadd('active_rooms', code)

def persist(code, state):
    room = Room.objects.get(code=code)
    room.snapshot = state
    room.score = state['score']
    room.status = state['status']
    if room.status != 'active' and not room.finished_at:
        room.finished_at = timezone.now()
    room.save(update_fields=['snapshot', 'score', 'status', 'finished_at'])
    for p in state['players'].values():
        Membership.objects.filter(room=room, pilot_id=p['id']).update(position=Point(p['x'], p['z'], srid=3857))

def snapshot(code):
    with locked_room(code) as state:
        return public_state(state)
