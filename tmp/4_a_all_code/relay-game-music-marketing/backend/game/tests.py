import json
from unittest.mock import patch
import redis
from django.conf import settings
from django.test import TestCase, override_settings
from django.contrib.gis.geos import Point
from rest_framework.test import APIClient
from .models import Pilot, Room, Membership, Landmark
from .simulation import new_world, add_player
from .state import store
from .ai import validate_plan, direct

class APIIntegrationTests(TestCase):
    """Run with docker compose exec api python manage.py test game."""
    def setUp(self):
        test_redis = redis.Redis.from_url(settings.REDIS_URL.rsplit('/',1)[0]+'/15', decode_responses=True)
        self.test_redis = test_redis
        for target in ['game.state.store', 'game.views.store', 'game.ai.store']:
            replacement = patch(target, test_redis)
            replacement.start()
            self.addCleanup(replacement.stop)
        self.client = APIClient(enforce_csrf_checks=True)
        bootstrap = self.client.get('/api/session/').json()
        self.client.credentials(HTTP_X_CSRFTOKEN=bootstrap['csrf'])
        response = self.client.post('/api/session/', {'name':'Test pilot'}, format='json')
        self.assertEqual(response.status_code,200)
        self.pilot = Pilot.objects.get(id=response.json()['pilot']['id'])
        self.client.credentials(HTTP_X_CSRFTOKEN=response.json()['csrf'])

    def tearDown(self):
        for room in Room.objects.all():
            self.test_redis.delete(f'room:{room.code}', f'lock:{room.code}', f'ai:room:{room.code}')
            self.test_redis.srem('active_rooms', room.code)
        self.test_redis.delete(f'create:{self.pilot.id}',f'ai:cooldown:{self.pilot.id}')

    def create_room(self):
        result=self.client.post('/api/rooms/',{'name':'Integration squad'},format='json')
        self.assertEqual(result.status_code,201,result.content)
        return result.json()['room']['code']

    def test_csrf_required(self):
        self.client.credentials()
        self.assertEqual(self.client.post('/api/rooms/',{'name':'Bad request'},format='json').status_code,403)

    def test_postgis_proximity_and_membership(self):
        code=self.create_room()
        result=self.client.get(f'/api/rooms/{code}/nearby/')
        self.assertEqual(result.status_code,200)
        self.assertEqual(len(result.json()['landmarks']),3)
        self.assertEqual(result.json()['landmarks'][0]['distance'],14)
        stranger=APIClient()
        self.assertEqual(stranger.get(f'/api/rooms/{code}/').status_code,403)

    def test_private_room_hidden(self):
        code=self.create_room()
        Room.objects.filter(code=code).update(private=True)
        self.assertNotIn(code,[r['code'] for r in self.client.get('/api/rooms/').json()])

    @override_settings(ANTHROPIC_API_KEY='')
    def test_ai_fallback_is_labeled_and_shared(self):
        code=self.create_room()
        result=self.client.post(f'/api/rooms/{code}/ai/',{'prompt':'Summon a storm and scout the next relay'},format='json')
        self.assertEqual(result.status_code,200,result.content)
        self.assertEqual(result.json()['source'],'local')
        state=self.client.get(f'/api/rooms/{code}/').json()['state']
        self.assertEqual(state['weather'],'storm')
        self.assertEqual(state['companion'],'scout')
        self.assertEqual(state['score'],0)

    def test_plan_validation_rejects_unknown_actions(self):
        for bad in [None,{}, {'message':'hi','weather':'lava','companion':'guard','waypoint':0},{'message':'hi','weather':'clear','companion':'guard','waypoint':True}]:
            with self.assertRaises(ValueError):validate_plan(bad)
        plan=validate_plan({'message':'hi','weather':'clear','companion':'guard','waypoint':0,'score':99999})
        self.assertNotIn('score',plan)

    def test_destination_validation_spatial_layout_and_resume(self):
        for invalid in ['unknown', [], None]:
            response = self.client.post('/api/rooms/', {'level':invalid}, format='json')
            self.assertEqual(response.status_code,400)
        for level in ['ember','glacier','tempest']:
            self.test_redis.delete(f'create:{self.pilot.id}')
            response=self.client.post('/api/rooms/',{'level':level,'name':'Destination check'},format='json')
            self.assertEqual(response.status_code,201,response.content)
            code=response.json()['room']['code']
            self.assertEqual(response.json()['state']['level'],level)
            # Redis loss restores the selected map from PostgreSQL.
            self.test_redis.delete(f'room:{code}')
            restored=self.client.get(f'/api/rooms/{code}/').json()
            self.assertEqual(restored['state']['level'],level)
            self.assertEqual(restored['room']['level'],level)
            landmarks=self.client.get(f'/api/rooms/{code}/nearby/').json()['landmarks']
            self.assertEqual({r['name'] for r in restored['state']['relays']},{r['name'] for r in landmarks})
