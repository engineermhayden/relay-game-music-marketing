"""One opt-in, bounded live credential check. Never print the key or provider body."""
import json
import os
import sys
import urllib.request
import urllib.error
from pathlib import Path

if '--live' not in sys.argv:
    raise SystemExit('Pass --live to send one small paid Anthropic request (32 output tokens max).')
values={}
path=Path(__file__).resolve().parents[1]/'.env.files/.env.antropic'
if path.exists():
    for line in path.read_text(encoding='utf-8-sig').splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            key,value=line.split('=',1);values[key.strip()]=value.strip().strip('"').strip("'")
key=os.getenv('ANTHROPIC_API_KEY') or values.get('ANTHROPIC_API_KEY') or values.get('ANTROPIC_API_KEY')
if not key:raise SystemExit('No Anthropic key found.')
model=os.getenv('ANTHROPIC_MODEL','claude-sonnet-4-6')
request=urllib.request.Request('https://api.anthropic.com/v1/messages',data=json.dumps({'model':model,'max_tokens':32,'messages':[{'role':'user','content':'You are ORA, an expedition game companion. Greet our squad in one short sentence.'}]}).encode(),headers={'x-api-key':key,'anthropic-version':'2023-06-01','content-type':'application/json'})
try:
    with urllib.request.urlopen(request,timeout=30) as response:data=json.load(response)
    print(json.dumps({'status':'ok','model':data.get('model'),'usage':data.get('usage'),'has_text':any(c.get('type')=='text' for c in data.get('content',[]))}))
except urllib.error.HTTPError as e:
    print(json.dumps({'status':'provider_error','http_status':e.code}));sys.exit(1)
except Exception as e:
    print(json.dumps({'status':'connection_error','type':type(e).__name__}));sys.exit(1)
