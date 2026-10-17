import secrets
import time
from django.conf import settings
from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.geos import Point
from django.db import connection, transaction
from django.http import JsonResponse
from django.middleware.csrf import get_token, CsrfViewMiddleware
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view
from rest_framework.exceptions import PermissionDenied, ValidationError, Throttled
from rest_framework.response import Response
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from .models import Pilot, Room, Membership, Landmark, MissionEvent
from .simulation import add_player, new_world, public_state, event
from .state import locked_room, persist, snapshot, store
from .ai import direct
from .levels import LEVELS

def csrf(request):
    if request.method not in ['GET', 'HEAD', 'OPTIONS']:
        reason = CsrfViewMiddleware(lambda r: None).process_view(request._request, lambda r: None, (), {})
        if reason:
            raise PermissionDenied('CSRF verification failed. Refresh this page.')

def pilot(request):
    csrf(request)
    identity = request.session.get('pilot_id')
    if not identity:
        raise PermissionDenied('Choose a pilot name first.')
    return get_object_or_404(Pilot, id=identity)

def member_room(request, code):
    p = pilot(request)
    room = get_object_or_404(Room, code=code.upper())
    if not Membership.objects.filter(room=room, pilot=p).exists():
        raise PermissionDenied('Join this expedition first.')
    return room, p

def room_summary(room):
    return {'code': room.code, 'name': room.name, 'seed': room.seed, 'level': room.snapshot.get('level', 'verdant'), 'status': room.status, 'score': room.score, 'private': room.private, 'players': room.members.count(), 'created': room.created_at.isoformat()}

def health(request):
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT PostGIS_Version()')
            version = cursor.fetchone()[0]
        store.ping()
        return JsonResponse({'status': 'ok', 'database': 'postgis', 'postgis': version})
    except Exception:
        return JsonResponse({'status': 'unavailable'}, status=503)

@api_view(['GET', 'POST'])
def session_view(request):
    csrf(request)
    identity = request.session.get('pilot_id')
    p = Pilot.objects.filter(id=identity).first() if identity else None
    if request.method == 'POST':
        name = request.data.get('name', '')
        if not isinstance(name, str) or not 1 <= len(name.strip()) <= 24:
            raise ValidationError('Pilot name must be 1–24 characters.')
        if p:
            p.name = name.strip()
            p.save(update_fields=['name'])
        else:
            p = Pilot.objects.create(name=name.strip())
            request.session.cycle_key()
            request.session['pilot_id'] = str(p.id)
    return Response({'pilot': {'id': str(p.id), 'name': p.name} if p else None, 'csrf': get_token(request), 'ai': {'configured': bool(settings.ANTHROPIC_API_KEY), 'model': settings.ANTHROPIC_MODEL, 'daily_limit': settings.AI_DAILY_REQUEST_LIMIT}})

@api_view(['GET', 'POST'])
def rooms(request):
    if request.method == 'GET':
        return Response([room_summary(r) for r in Room.objects.filter(private=False, status='active').order_by('-created_at')[:24]])
    p = pilot(request)
    level = request.data.get('level', 'verdant')
    if not isinstance(level, str) or level not in LEVELS:
        raise ValidationError('Choose a known expedition destination.')
    if not store.set(f'create:{p.id}', 1, nx=True, ex=15):
        raise Throttled(15, 'Please wait before launching another expedition.')
    name = request.data.get('name') or f"{p.name}'s expedition"
    if not isinstance(name, str) or len(name) > 48:
        raise ValidationError('Squad name must be at most 48 characters.')
    private = request.data.get('private', False)
    if not isinstance(private, bool):
        raise ValidationError('private must be a boolean.')
    with transaction.atomic():
        room = Room.objects.create(name=name, private=private, seed=secrets.randbelow(1_000_000), owner=p)
        state = new_world(room.seed, level=level)
        add_player(state, str(p.id), p.name)
        room.snapshot = state
        room.save(update_fields=['snapshot'])
        Membership.objects.create(room=room, pilot=p, position=Point(0, 0, srid=3857))
        Landmark.objects.bulk_create([Landmark(room=room, index=r['id'], name=r['name'], position=Point(r['x'], r['z'], srid=3857)) for r in state['relays']])
    with locked_room(room.code):
        pass
    return Response({'room': room_summary(room), 'state': public_state(state)}, status=201)

@api_view(['POST'])
def join(request):
    p = pilot(request)
    code = request.data.get('code', '')
    if not isinstance(code, str) or len(code) != 6:
        raise ValidationError('Enter the six-character squad code.')
    room = get_object_or_404(Room, code=code.upper())
    with locked_room(room.code) as state:
        if state['status'] != 'active':
            raise ValidationError('This expedition has ended. Launch a new one.')
        try:
            add_player(state, str(p.id), p.name)
        except ValueError as e:
            raise ValidationError(str(e))
        Membership.objects.get_or_create(room=room, pilot=p, defaults={'position': Point(0, 0, srid=3857)})
        persist(room.code, state)
        result = public_state(state)
    return Response({'room': room_summary(room), 'state': result})

@api_view(['GET'])
def room_detail(request, code):
    room, _ = member_room(request, code)
    return Response({'room': room_summary(room), 'state': snapshot(room.code), 'journal': list(room.events.order_by('-created_at').values('kind', 'message', 'data', 'created_at')[:20])})

@api_view(['GET'])
def nearby(request, code):
    room, p = member_room(request, code)
    state = snapshot(room.code)
    player = next(x for x in state['players'] if x['id'] == str(p.id))
    origin = Point(player['x'], player['z'], srid=3857)
    # Real spatial query; coordinates are fictional world meters in a planar SRID.
    landmarks = room.landmarks.filter(position__dwithin=(origin, 40)).annotate(distance=Distance('position', origin)).order_by('distance')
    return Response({'engine': 'PostGIS ST_DWithin + ST_Distance', 'origin': [player['x'], player['z']], 'landmarks': [{'id': x.index, 'name': x.name, 'distance': round(x.distance.m, 1), 'x': x.position.x, 'z': x.position.y} for x in landmarks]})

@api_view(['POST'])
def ai_director(request, code):
    room, p = member_room(request, code)
    prompt = request.data.get('prompt', '')
    if not isinstance(prompt, str) or not 1 <= len(prompt.strip()) <= 600:
        raise ValidationError('Send a request between 1 and 600 characters.')
    if not store.set(f'ai:cooldown:{p.id}', 1, nx=True, ex=12):
        raise Throttled(12, 'ORA is recalibrating. Try again in a moment.')
    if not store.set(f'ai:room:{room.code}', 1, nx=True, ex=35):
        raise Throttled(10, 'ORA is answering another squad member.')
    try:
        with locked_room(room.code) as state:
            if state['status'] != 'active':
                raise ValidationError('Launch a new expedition to contact ORA.')
            context = public_state(state)
        plan = direct(context, prompt.strip())
        with locked_room(room.code) as state:
            if state['status'] != 'active':
                raise ValidationError('The expedition ended while ORA was responding.')
            state.update({k: plan[k] for k in ['weather', 'waypoint', 'companion']})
            state['ai'] = plan
            event(state, 'ai', plan['message'])
            persist(room.code, state)
            result = public_state(state)
        MissionEvent.objects.create(room=room, kind='ai', message=plan['message'], data={'prompt': prompt, 'source': plan['source'], 'pilot': p.name})
        async_to_sync(get_channel_layer().group_send)(f'expedition.{room.code}', {'type': 'world.state', 'state': result})
        return Response(plan)
    finally:
        store.delete(f'ai:room:{room.code}')

@api_view(['GET'])
def leaderboard(request):
    return Response([room_summary(r) for r in Room.objects.filter(status='won', private=False).order_by('-score')[:12]])
