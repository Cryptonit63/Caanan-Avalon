#!/usr/bin/env python3
"""Avalon VlMiner read-only local collector and dashboard. Python stdlib only."""
import argparse, collections, datetime, http.server, json, pathlib, re, socket, threading, time, urllib.parse
ROOT=pathlib.Path(__file__).resolve().parents[2]
FRONTEND=ROOT/'src'/'frontend'
TEMP=ROOT/'temp'
CMDS=('version','summary','stats','notify')

def command(host,port,name,timeout=8):
    with socket.create_connection((host,port),timeout=timeout) as conn:
        conn.settimeout(timeout)
        conn.sendall(json.dumps({'command':name}).encode('ascii'))
        pieces=[]
        while True:
            block=conn.recv(65536)
            if not block:break
            pieces.append(block)
            if sum(map(len,pieces))>2_000_000:raise ValueError('Oversized API response')
    payload=b''.join(pieces).rstrip(b'\0 \r\n')
    if not payload:raise ValueError('Empty CGMiner response')
    result=json.loads(payload)
    if not isinstance(result,dict): raise ValueError('Invalid API response')
    return result

def fields(line):
    return {m.group(1):m.group(2).strip() for m in re.finditer(r'([A-Za-z][A-Za-z0-9_]*)\[([^\]]*)\]',line)}

def numbers(s):
    return [float(x) for x in s.split()] if s else []

def scalar(f,key,default=None):
    try:return float(f[key].rstrip('%'))
    except (KeyError,ValueError,TypeError):return default

def normalized(res):
    ver=res['version'].get('VERSION',[{}])[0]
    summ=res['summary'].get('SUMMARY',[{}])[0]
    stats=next((x for x in res['stats'].get('STATS',[]) if 'MM ID0' in x),None)
    if not stats:raise ValueError('MM ID0 is missing')
    raw=fields(stats['MM ID0'])
    boards=[]
    for i in range(3):
        ts=numbers(raw.get(f'PVT_T{i}',''))
        vs=numbers(raw.get(f'PVT_V{i}',''))
        ms=numbers(raw.get(f'MW{i}',''))
        if not(len(ts)==len(vs)==len(ms)==114):
            raise ValueError(f'Board {i+1}: incomplete 114-chip arrays')
        hashes=numbers(raw.get('MGHS',''))
        boards.append({'board':i+1,'hashrate_ths':hashes[i]/1000 if len(hashes)>i else None,
            'temperature_avg_c':round(sum(ts)/114,2),'temperature_max_c':max(ts),
            'temperatures_c':ts,'voltages_raw':vs,'mw_raw':ms})
    ps=numbers(raw.get('PS',''))
    if len(ps)<6:ps=[]
    timestamp=datetime.datetime.now().astimezone().isoformat(timespec='seconds')
    return {'timestamp':timestamp,'device':{'model':ver.get('MODEL','1326-106'),'swtype':ver.get('SWTYPE','MM317'),'firmware':ver.get('VERSION',''),
        'hwtype':ver.get('HWTYPE','')},'uptime_seconds':summ.get('Elapsed'),
        'hashrate_average_ths':float(summ.get('MHS av',0))/1e6,
        'hashrate_5m_ths':float(summ.get('MHS 5m',0))/1e6,
        'accepted':summ.get('Accepted'),'rejected':summ.get('Rejected'),'stale':summ.get('Stale'),
        'hardware_errors':summ.get('Hardware Errors'),'workmode_raw':raw.get('WORKMODE'),
        'power_level_profile_raw':raw.get('ATAOPTS2'),
        'power_status_raw':ps,'fan1_rpm':scalar(raw,'Fan1'),'fan2_rpm':scalar(raw,'Fan2'),
        'temperature_max_c':scalar(raw,'TMax'),'temperature_avg_c':scalar(raw,'TAvg'),
        'notify':res['notify'].get('NOTIFY',[]),'boards':boards}

class Store:
    def __init__(self,host,port,interval):
        self.host,self.port,self.interval=host,port,interval
        self.lock=threading.Lock();self.latest=None;self.error='Waiting for first response';self.history=collections.deque(maxlen=2880);self.updated=None
        TEMP.mkdir(parents=True,exist_ok=True)
        self.path=TEMP/('live_'+datetime.datetime.now().strftime('%Y%m%d_%H%M%S')+'.jsonl')
    def worker(self):
        while True:
            try:
                responses={name:command(self.host,self.port,name) for name in CMDS}
                sample=normalized(responses)
                with self.lock:
                    self.latest=sample;self.history.append(sample);self.updated=time.monotonic();self.error=None
                with self.path.open('a',encoding='utf-8') as f:f.write(json.dumps(sample,ensure_ascii=False,separators=(',',':'))+'\n')
            except Exception as exc:
                with self.lock:self.error=str(exc)[:250]
            time.sleep(self.interval)

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(FRONTEND),**kwargs)
    def log_message(self,fmt,*args):pass
    def do_GET(self):
        url=urllib.parse.urlsplit(self.path)
        if url.path in ('/api/state','/api/history','/api/health'):
            with self.server.store.lock:
                store=self.server.store
                age=round(time.monotonic()-store.updated,1) if store.updated is not None else None
                status={'online':store.latest is not None and age is not None and age<store.interval*2.5 and store.error is None,
                    'age_seconds':age,'error':store.error,'interval_seconds':store.interval,'read_only':True}
                if url.path=='/api/state':data={'status':status,'snapshot':store.latest}
                elif url.path=='/api/health':data={'status':status,'samples':len(store.history)}
                else:
                    data={'status':status,'samples':[{'timestamp':x['timestamp'],'hashrate_5m_ths':x['hashrate_5m_ths'],
                          'power_output_w':x['power_status_raw'][4] if len(x.get('power_status_raw') or [])>=6 else None,
                          'temperature_max_c':x['temperature_max_c'], 'fan1_rpm':x['fan1_rpm'],'fan2_rpm':x['fan2_rpm'],
                          'hardware_errors':x['hardware_errors']} for x in store.history]}
            output=json.dumps(data,ensure_ascii=False,allow_nan=False).encode('utf-8')
            self.send_response(200);self.send_header('Content-Type','application/json; charset=utf-8')
            self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(output)));self.end_headers();self.wfile.write(output)
            return
        if url.path.startswith('/api/'):
            self.send_error(404,'Read-only endpoint not found');return
        return super().do_GET()
    def do_POST(self):self.send_error(405,'Write operations disabled')
    def do_PUT(self):self.send_error(405,'Write operations disabled')
    def do_DELETE(self):self.send_error(405,'Write operations disabled')

class Server(http.server.ThreadingHTTPServer):
    daemon_threads=True;allow_reuse_address=True

if __name__=='__main__':
    p=argparse.ArgumentParser(description='Avalon VlMiner live read-only dashboard')
    p.add_argument('--host',default='192.168.3.41');p.add_argument('--api-port',type=int,default=4028)
    p.add_argument('--bind',default='127.0.0.1');p.add_argument('--port',type=int,default=8765)
    p.add_argument('--interval',type=int,default=30)
    args=p.parse_args()
    if args.interval<10: p.error('Minimum interval is 10 seconds')
    store=Store(args.host,args.api_port,args.interval)
    threading.Thread(target=store.worker,daemon=True).start()
    server=Server((args.bind,args.port),Handler);server.store=store
    print(f'Avalon VlMiner: http://{args.bind}:{args.port}/')
    print(f'Read-only CGMiner: {args.host}:{args.api_port} | {args.interval}s | log {store.path}',flush=True)
    try:server.serve_forever()
    except KeyboardInterrupt:print('\nServer stopped')
    finally:server.server_close()
