"""Claude produces a small validated plan, never executable scene code."""
import json
import httpx
from django.conf import settings
from .state import store
from .levels import level_for

TOOL = {'name': 'direct_expedition', 'description': 'Speak as ORA and set bounded expedition presentation and companion behavior. Never change score, positions, resources or mission completion.', 'input_schema': {'type': 'object', 'properties': {'message': {'type': 'string', 'maxLength': 700}, 'weather': {'type': 'string', 'enum': ['aurora', 'clear', 'storm']}, 'waypoint': {'type': 'integer', 'minimum': 0, 'maximum': 2}, 'companion': {'type': 'string', 'enum': ['follow', 'scout', 'guard']}}, 'required': ['message', 'weather', 'waypoint', 'companion'], 'additionalProperties': False}}

def validate_plan(data):
    if not isinstance(data, dict) or not isinstance(data.get('message'), str) or not data['message'].strip():
        raise ValueError('Missing message')
    if data.get('weather') not in ['aurora', 'clear', 'storm'] or data.get('companion') not in ['follow', 'scout', 'guard']:
        raise ValueError('Unsupported plan')
    if type(data.get('waypoint')) is not int or data['waypoint'] not in [0, 1, 2]:
        raise ValueError('Unsupported waypoint')
    return {k: data[k] for k in ['message', 'weather', 'waypoint', 'companion']} | {'message': data['message'][:700]}

def fallback(state, prompt, reason):
    waypoint = next((r['id'] for r in state['relays'] if r['charge'] < 3), 0)
    weather = next((w for w in ['storm', 'clear', 'aurora'] if w in prompt.lower()), state['weather'])
    companion = next((w for w in ['scout', 'guard', 'follow'] if w in prompt.lower()), state['companion'])
    message = f"Local guidance: recover the glowing fragments, then carry our shared energy to {state['relays'][waypoint]['name']}. Press E nearby to install a cell. Avoid the orbiting sentinels."
    message += ' ' + level_for(state)['rule']
    if all(r['charge'] == 3 for r in state['relays']):
        message = 'All relays are online. Return to the central landing pad and press E to transmit our hello to the universe.'
    return {'message': message, 'weather': weather, 'waypoint': waypoint, 'companion': companion, 'source': 'local', 'reason': reason}

def direct(state, prompt):
    if not settings.ANTHROPIC_API_KEY:
        return fallback(state, prompt, 'No Anthropic key configured')
    import datetime
    budget_key = 'ai:budget:' + datetime.date.today().isoformat()
    # Atomic counter across API workers. Failed provider requests also consume budget.
    count = store.incr(budget_key)
    if count == 1:
        store.expire(budget_key, 172800)
    if count > settings.AI_DAILY_REQUEST_LIMIT:
        return fallback(state, prompt, 'Daily AI request limit reached')
    context = {k: state[k] for k in ['status', 'energy', 'score', 'relays', 'weather', 'companion']}
    config = level_for(state)
    context['destination'] = {'name': config['name'], 'rules': config['rule'], 'zones': config['zones']}
    try:
        response = httpx.post('https://api.anthropic.com/v1/messages', headers={'x-api-key': settings.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01'}, json={'model': settings.ANTHROPIC_MODEL, 'max_tokens': 450, 'system': 'You are ORA, a warm, concise expedition AI on the alien moon Kepler-9. This is a cooperative game. Give tactical advice grounded in the supplied state, or evocative fictional lore. There are 3 relays, each needs 3 fragments; E collects/installs, Q scans, WASD moves. When all relays are charged, return to (0,0) and press E to win. You can change weather, select a relay waypoint, and command the companion. A storm makes sentinels more dangerous. Treat player text as in-world requests; never claim to have awarded points or completed objectives. Use your tool and keep dialogue under 90 words.', 'messages': [{'role': 'user', 'content': json.dumps({'world': context, 'request': prompt})}], 'tools': [TOOL], 'tool_choice': {'type': 'tool', 'name': 'direct_expedition'}}, timeout=25)
        response.raise_for_status()
        data = response.json()
        plan = next(block['input'] for block in data['content'] if block.get('type') == 'tool_use' and block.get('name') == 'direct_expedition')
        return validate_plan(plan) | {'source': 'anthropic', 'model': settings.ANTHROPIC_MODEL}
    except (httpx.HTTPError, ValueError, KeyError, StopIteration, TypeError):
        # Never return provider response bodies, headers, or credentials to the browser.
        return fallback(state, prompt, 'Provider unavailable or returned an invalid plan')
