#!/usr/bin/env python3
"""Avalon VlMiner safe observation-only CGMiner API sampler.
No ascset, no command writes, no config mutation, no authentication secrets.
"""
import argparse,json,socket,datetime,pathlib,re,time
ALLOWED=("version","summary","stats","devs","config","estats","notify","asccount")
def query(host,port,command,timeout=7):
    if command not in ALLOWED: raise ValueError("Command not allowlisted")
    with socket.create_connection((host,port),timeout=timeout) as s:
        s.settimeout(timeout);s.sendall(json.dumps({"command":command}).encode())
        parts=[]
        while True:
            try: block=s.recv(65536)
            except socket.timeout: break
            if not block:break
            parts.append(block)
            if b"\x00" in block:break
    data=b"".join(parts).split(b"\x00")[0]
    if not data:raise ValueError("Empty API reply")
    return json.loads(data.decode("utf-8","replace"))
def decode(obj):
    out={}
    for st in obj.get("STATS",[]):
        mm=st.get("MM ID0","")
        if not isinstance(mm,str):continue
        for key in ("PS","Fan1","Fan2","TAvg","TMax","WORKMODE","ATAOPTS2","PVT_T0","PVT_T1","PVT_T2","PVT_V0","PVT_V1","PVT_V2","MW0","MW1","MW2"):
            m=re.search(r"(?<![A-Za-z0-9_])"+re.escape(key)+r"\[([^]]*)\]",mm)
            if not m:continue
            raw=m.group(1)
            if key in ("PS", "Fan1", "Fan2", "TAvg", "TMax", "WORKMODE"):
                try:out[key]=[float(t) if "." in t else int(t) for t in raw.split()]
                except ValueError:out[key+"_raw"]=raw
            elif key.startswith(("PVT_","MW")):
                parts=raw.split();out[key]={"count":len(parts),"raw_sample_first_3":parts[:3]}
            else:out[key+"_raw"]=raw
    ps=out.get("PS")
    if ps and len(ps)>=6:out["ps_interpretation"]={"controller_v":ps[1]/100,"hashboard_v":ps[2]/100,"hashboard_a":ps[3],"hashboard_output_w":ps[4],"set_hashboard_v":ps[5]/100,"extra_unmapped":ps[6:],"not_wall_power":True,"mapping_status":"documentation_based_unverified_for_A1326"}
    return out
def main():
    p=argparse.ArgumentParser();p.add_argument("--host",default="192.168.3.41");p.add_argument("--port",type=int,default=4028);p.add_argument("--output",default=None);p.add_argument("--timeout",type=float,default=7);a=p.parse_args()
    record={"project":"Avalon VlMiner","timestamp":datetime.datetime.now(datetime.timezone.utc).astimezone().isoformat(),"read_only":True,"host":a.host,"responses":{},"errors":{}}
    for cmd in ALLOWED:
        try:
            response=query(a.host,a.port,cmd,a.timeout)
            if cmd=="stats":record["decoded_stats"]=decode(response)
            # Avoid storing pool worker credentials and network secrets.
            record["responses"][cmd]=response
            print(f"[OK] {cmd}")
        except (OSError,ValueError,json.JSONDecodeError) as e:
            record["errors"][cmd]=str(e);print(f"[ERROR] {cmd}: {e}")
    path=pathlib.Path(a.output or ("temp/controller_probe_"+datetime.datetime.now().strftime("%Y%m%d_%H%M%S")+".json"));path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding="utf-8")
    print("Saved:",path.resolve())
if __name__=="__main__":main()
