import math
import time
from asgiref.sync import async_to_sync
from channels.generic.websocket import JsonWebsocketConsumer
from .models import Membership
from .state import locked_room, persist
from .simulation import action, public_state

class ExpeditionConsumer(JsonWebsocketConsumer):
    def connect(self):
        self.code = self.scope['url_route']['kwargs']['code']
        self.pilot = self.scope['session'].get('pilot_id')
        self.group = f'expedition.{self.code}'
        if not self.pilot or not Membership.objects.filter(room__code=self.code, pilot_id=self.pilot).exists():
            self.close(code=4403)
            return
        self.last_input = 0
        self.input_tokens = 5.
        self.input_refill = time.monotonic()
        self.last_action = 0
        async_to_sync(self.channel_layer.group_add)(self.group, self.channel_name)
        self.accept()
        with locked_room(self.code) as state:
            if self.pilot not in state['players']:
                self.close(code=4403)
                return
            state['players'][self.pilot]['seen'] = time.time()
            self.send_json({'type': 'state', 'state': public_state(state)})

    def receive(self, text_data=None, bytes_data=None, **kwargs):
        if not text_data or len(text_data) > 1024:
            self.close(code=4400)
            return
        try:
            super().receive(text_data=text_data, **kwargs)
        except (ValueError, TypeError, KeyError):
            self.send_json({'type': 'error', 'message': 'Invalid input.'})

    def receive_json(self, content, **kwargs):
        if not isinstance(content, dict):
            return
        now = time.time()
        kind = content.get('type')
        if kind == 'ping':
            self.send_json({'type': 'pong', 'at': content.get('at')})
            return
        if kind == 'input':
            # Permit key transitions beside the 10 Hz heartbeat without dropping
            # key-up packets; still bound sustained traffic to 25 messages/sec.
            clock = time.monotonic()
            self.input_tokens = min(5., self.input_tokens + (clock - self.input_refill) * 25)
            self.input_refill = clock
            if self.input_tokens < 1:
                return
            self.input_tokens -= 1
            self.last_input = now
            dx, dz = float(content.get('x', 0)), float(content.get('z', 0))
            if not math.isfinite(dx) or not math.isfinite(dz):
                return
            with locked_room(self.code) as state:
                p = state['players'][self.pilot]
                p['input'] = [max(-1, min(1, dx)), max(-1, min(1, dz))]
                p['sprint'] = content.get('sprint') is True
                p['seen'] = now
        elif kind in ('interact', 'scan') and now - self.last_action > .3:
            self.last_action = now
            with locked_room(self.code) as state:
                message = action(state, self.pilot, kind, now)
                if kind == 'interact':
                    persist(self.code, state)
                result = public_state(state)
            self.send_json({'type': 'notice', 'message': message})
            async_to_sync(self.channel_layer.group_send)(self.group, {'type': 'world.state', 'state': result})

    def world_state(self, event):
        self.send_json({'type': 'state', 'state': event['state']})

    def disconnect(self, code):
        if hasattr(self, 'group'):
            async_to_sync(self.channel_layer.group_discard)(self.group, self.channel_name)
        # Presence expires from heartbeat; closing one tab must not kick another tab.
