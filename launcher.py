#!/usr/bin/env python3
"""Cross-platform launcher for the local, read-only Avalon VlMiner dashboard."""
import configparser
import pathlib
import subprocess
import sys
import time
import urllib.request
import webbrowser

ROOT=pathlib.Path(__file__).resolve().parent
CONF=ROOT/'settings.ini'

def main():
    cfg=configparser.ConfigParser()
    if not CONF.exists():
        print('Missing settings.ini:', CONF)
        return 2
    cfg.read(CONF,encoding='utf-8')
    try:
        host=cfg.get('miner','ip').strip()
        api_port=cfg.getint('miner','api_port')
        bind=cfg.get('dashboard','bind',fallback='127.0.0.1')
        port=cfg.getint('dashboard','port',fallback=8765)
        interval=cfg.getint('dashboard','interval_seconds',fallback=30)
        if not host or not 1<=api_port<=65535 or not 1<=port<=65535 or interval<10:
            raise ValueError('Invalid IP/port/interval')
        if bind not in ('127.0.0.1','localhost'):
            raise ValueError('Dashboard binds to localhost only for safety')
    except (ValueError,configparser.Error) as exc:
        print('Configuration error:',exc)
        return 2
    cmd=[sys.executable,str(ROOT/'src'/'backend'/'avalon_server.py'),
         '--host',host,'--api-port',str(api_port),'--bind','127.0.0.1',
         '--port',str(port),'--interval',str(interval)]
    print('Avalon VlMiner | Author: vlasss666 / Cryptonit')
    print('Read-only: CGMiner',host,api_port)
    print('Local UI: http://127.0.0.1:%s/'%port)
    print('Stop with Ctrl+C. Logs under temp/.')
    child=subprocess.Popen(cmd,cwd=str(ROOT))
    ready=False
    try:
        for _ in range(40):
            if child.poll() is not None:
                print('Server exited with code',child.returncode)
                return child.returncode or 1
            try:
                with urllib.request.urlopen(f'http://127.0.0.1:{port}/api/health',timeout=0.5) as r:
                    if r.status==200:
                        ready=True
                        break
            except Exception:
                time.sleep(.15)
        if ready:
            webbrowser.open(f'http://127.0.0.1:{port}/')
        else:
            print('Web server did not respond; check port and terminal output.')
        return child.wait()
    except KeyboardInterrupt:
        print('Stopping Avalon VlMiner...')
        child.terminate()
        try:child.wait(timeout=4)
        except subprocess.TimeoutExpired:child.kill();child.wait()
        return 0

if __name__=='__main__':sys.exit(main())
