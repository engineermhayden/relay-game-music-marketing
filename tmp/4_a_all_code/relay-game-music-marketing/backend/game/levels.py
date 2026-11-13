"""One level catalog shared with the TypeScript client (no untrusted rule code)."""
import json
from pathlib import Path

LEVELS = {level['id']: level for level in json.loads((Path(__file__).resolve().parents[2] / 'shared' / 'levels.json').read_text())}

def level_for(state):
    return LEVELS.get(state.get('level', 'verdant'), LEVELS['verdant'])

def in_zone(player, zone):
    return (player['x'] - zone['x']) ** 2 + (player['z'] - zone['z']) ** 2 < zone['radius'] ** 2

def heat_active(state, now):
    return (now - state['started']) % 10 >= 6
