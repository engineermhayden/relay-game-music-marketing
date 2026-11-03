"""Deterministic, server-authoritative rules. No renderer or network dependencies."""
import math
import random
import time
from .levels import LEVELS, level_for, in_zone, heat_active

RELAY_NAMES = ['Echo Spire', 'Verdant Array', 'Horizon Gate']
RELAY_POSITIONS = [(-12, -8), (12, -8), (0, 14)]
COLORS = ['#b9f36b', '#65d8ed', '#eab0ff', '#ffba78', '#a7baff', '#ff91ad', '#fff09c', '#e2f5ee']

def new_world(seed, now=None, level='verdant'):
    config = LEVELS[level]
    rng = random.Random(seed)
    shards = []
    for i in range(18):
        angle = i * math.tau / 18
        radius = rng.uniform(5, 19)
        shards.append({'id': i, 'x': round(math.cos(angle) * radius, 2), 'z': round(math.sin(angle) * radius, 2), 'taken': False})
    return {'seed': seed, 'level': level, 'started': time.time() if now is None else now, 'duration': config['duration'], 'status': 'active', 'score': 0, 'energy': 0, 'weather': config['weather'], 'waypoint': 0, 'companion': 'follow', 'players': {}, 'shards': shards, 'relays': [{'id': i, **r, 'charge': 0} for i, r in enumerate(config['relays'])], 'events': [], 'revision': 0, 'ai': {'message': f"Welcome to {config['name']}. {config['rule']} Each relay needs three cells; return to the pad to transmit.", 'source': 'local', 'weather': config['weather'], 'waypoint': 0, 'companion': 'follow'}}

def add_player(state, pilot_id, name):
    if pilot_id in state['players']:
        state['players'][pilot_id]['name'] = name
        return
    if len(state['players']) >= 8:
        raise ValueError('This expedition has eight pilots. Create another squad.')
    state['players'][pilot_id] = {'id': pilot_id, 'name': name, 'x': 0.0, 'z': 0.0, 'yaw': 0.0, 'shield': 100.0, 'color': COLORS[len(state['players']) % 8], 'connected': False, 'input': [0, 0], 'sprint': False, 'seen': 0, 'cooldown': 0, 'scan': 0}

def event(state, kind, message):
    entry = {'id': state['revision'], 'kind': kind, 'message': message, 'at': time.time()}
    state['events'] = (state['events'] + [entry])[-12:]
    state['revision'] += 1
    return entry

def sentinels(state, now):
    t = now - state['started']
    config = level_for(state)
    return [{'x': math.cos(t * config['sentinelSpeed'] + i * math.tau / config['sentinelCount']) * config['sentinelRadius'], 'z': math.sin(t * config['sentinelSpeed'] + i * math.tau / config['sentinelCount']) * config['sentinelRadius']} for i in range(config['sentinelCount'])]

def step(state, dt, now):
    if state['status'] != 'active':
        return
    dt = min(max(dt, 0), .2)
    hazards = sentinels(state, now)
    config = level_for(state)
    if now - state['started'] >= state['duration']:
        state['status'] = 'lost'
        event(state, 'lost', 'The signal window closed. Launch a new expedition to try again.')
        return
    for p in state['players'].values():
        p['connected'] = now - p['seen'] < 8
        if now - p['seen'] > .4:
            p['input'] = [0, 0]
        dx, dz = p['input']
        length = max(1, math.hypot(dx, dz))
        speed = 7 if p['sprint'] else 4.5
        if any(z['kind'] == 'frost' and in_zone(p, z) for z in config['zones']):
            speed *= .55
        p['x'] = max(-23, min(23, p['x'] + dx / length * dt * speed))
        p['z'] = max(-23, min(23, p['z'] + dz / length * dt * speed))
        radius = math.hypot(p['x'], p['z'])
        if radius > 23:
            p['x'] *= 23 / radius
            p['z'] *= 23 / radius
        if dx or dz:
            p['yaw'] = math.atan2(dx, dz)
        p['shield'] = min(100, p['shield'] + dt * 3)
        if any(math.hypot(p['x'] - h['x'], p['z'] - h['z']) < 1.7 for h in hazards):
            p['shield'] = max(0, p['shield'] - dt * (32 if state['weather'] == 'storm' else 22))
        if heat_active(state, now) and any(z['kind'] == 'heat' and in_zone(p, z) for z in config['zones']):
            p['shield'] = max(0, p['shield'] - dt * 28)
        if p['shield'] <= 0:
            p.update(x=0., z=0., shield=100.)
            event(state, 'rescue', f"ORA recovered {p['name']} to the landing pad.")
    state['revision'] += 1

def action(state, pilot_id, kind, now):
    if state['status'] != 'active':
        return 'This expedition has ended.'
    p = state['players'][pilot_id]
    if now < p['cooldown']:
        return 'Scanner recharging.'
    p['cooldown'] = now + .5
    if kind == 'scan':
        p['scan'] = now + 4
        return event(state, 'scan', f"{p['name']} released a survey pulse.")['message']
    if kind != 'interact':
        return 'Unknown action.'
    for shard in state['shards']:
        if not shard['taken'] and math.hypot(p['x'] - shard['x'], p['z'] - shard['z']) < 2.7:
            shard['taken'] = True
            state['energy'] += 1
            state['score'] += 100
            return event(state, 'collect', f"{p['name']} recovered a signal fragment. +100")['message']
    for relay in state['relays']:
        if relay['charge'] < 3 and math.hypot(p['x'] - relay['x'], p['z'] - relay['z']) < 3.4:
            if level_for(state)['ordered'] and any(r['charge'] < 3 for r in state['relays'][:relay['id']]):
                return 'Circuit locked. Fully power the preceding relay first.'
            if state['energy'] < 1:
                return 'Recover luminous fragments first. Your squad shares its energy supply.'
            state['energy'] -= 1
            relay['charge'] += 1
            state['score'] += 250
            return event(state, 'relay', f"{relay['name']}: {relay['charge']}/3 cells installed. +250")['message']
    if all(r['charge'] == 3 for r in state['relays']) and math.hypot(p['x'], p['z']) < 4:
        state['status'] = 'won'
        state['score'] += 1000 + max(0, int(state['duration'] - (now - state['started'])))
        return event(state, 'won', 'Signal restored. Hello, universe. Your squad made contact!')['message']
    return 'Move near a fragment or relay and press E. Return to the landing pad after all relays are online.'

def public_state(state, now=None):
    now = now or time.time()
    return {**{k: v for k, v in state.items() if k not in ['players']}, 'now': now, 'sentinels': sentinels(state, now), 'players': [{k: v for k, v in p.items() if k not in ['input', 'seen', 'cooldown']} for p in state['players'].values()]}
