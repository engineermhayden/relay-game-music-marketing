import logging
import time
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.core.management.base import BaseCommand
from django.db import close_old_connections
from game.state import store, locked_room, persist
from game.simulation import step, public_state

class Command(BaseCommand):
    help = 'Run the authoritative 10 Hz expedition simulation (one worker).'

    def handle(self, *args, **options):
        layer = get_channel_layer()
        self.stdout.write('RELAY authoritative simulation running at 10 Hz')
        previous = time.monotonic()
        last_save = time.monotonic()
        while True:
            start = time.monotonic()
            dt, previous = start - previous, start
            save = start - last_save >= 10
            for code in store.smembers('active_rooms'):
                try:
                    with locked_room(code) as state:
                        step(state, dt, time.time())
                        result = public_state(state)
                        finished = state['status'] != 'active'
                        if save or finished:
                            persist(code, state)
                    async_to_sync(layer.group_send)(f'expedition.{code}', {'type': 'world.state', 'state': result})
                    if finished:
                        store.srem('active_rooms', code)
                except Exception:
                    logging.exception('Simulation room failed: %s', code)
            if save:
                last_save = start
                close_old_connections()
            time.sleep(max(0, .1 - (time.monotonic() - start)))
