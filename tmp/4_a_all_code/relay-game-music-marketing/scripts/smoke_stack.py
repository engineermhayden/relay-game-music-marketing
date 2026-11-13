"""HTTP stack smoke test. Add --live-ai for one paid, bounded ORA call."""
import argparse
import json
import http.cookiejar
import urllib.request

parser=argparse.ArgumentParser()
parser.add_argument('--url',default='http://127.0.0.1:8080')
parser.add_argument('--live-ai',action='store_true')
args=parser.parse_args()
client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
token=''

def request(path,body=None):
    req=urllib.request.Request(args.url+'/api/'+path,data=json.dumps(body).encode() if body is not None else None,headers={'Content-Type':'application/json','X-CSRFToken':token})
    with client.open(req,timeout=35) as response:return json.load(response)

health=request('health/')
token=request('session/')['csrf']
session=request('session/',{'name':'Smoke test pilot'})
token=session['csrf']
room=request('rooms/',{'name':'Private verification expedition','private':True})['room']
nearby=request(f"rooms/{room['code']}/nearby/")
result={'health':health['status'],'database':health['database'],'room_created':bool(room['code']),'landmarks':len(nearby['landmarks']),'ai_configured':session['ai']['configured']}
if args.live_ai:
    plan=request(f"rooms/{room['code']}/ai/",{'prompt':'Clear the skies and scout Echo Spire. Give the squad one sentence of advice.'})
    result['ai']={key:plan.get(key) for key in ['source','weather','waypoint','companion','model','reason']}
    shared=request(f"rooms/{room['code']}/")['state']
    assert shared['weather']==plan['weather'] and shared['companion']==plan['companion']
    result['ai_persisted']=True
assert result['health']=='ok' and result['landmarks']==3
print(json.dumps(result,indent=2))
