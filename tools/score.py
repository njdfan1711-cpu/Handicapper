import json, math, re, statistics as st, itertools, sys
from datetime import datetime
sys.path.insert(0,'/home/claude/pp')
import parse_pp as P
W=json.load(open('/home/claude/pp/weights.json'))
RACE_DATE=datetime.strptime(W['race_date'],'%d%b%y')

def z(vals):
    vals=[v for v in vals]
    xs=[v for v in vals if v is not None]
    if len(xs)<2: return [0.0 if v is None else 0.0 for v in vals]
    m,s=st.mean(xs),(st.pstdev(xs) or 1.0)
    return [0.0 if v is None else (v-m)/s for v in vals]

def raw_features(h, race):
    pps=[p for p in h['pps'] if p.get('spd') is not None][:5]
    spds=[p['spd'] for p in pps if p['spd']>0]
    f={}
    top2=sorted(spds[:4],reverse=True)[:2]
    f['speed']=(st.mean(top2) + 0.25*((spds[0]-spds[min(2,len(spds)-1)]) if len(spds)>1 else 0)) if top2 else None
    rrs=[p['rr'] for p in pps[:3] if p.get('rr')]
    g1=sum(1 for p in h['pps'] if 'G1' in (p.get('cls') or ''))
    f['class']=(st.mean(rrs)-race['cr']+0.5*min(g1,4)) if rrs else None
    route=[p for p in h['pps'] if any(p['dist_raw'].lstrip('*').startswith(t) for t in W['route_dist_tokens'])]
    f['distance']=(len(route)/max(1,len(h['pps'])))*10 + (max([p['spd'] for p in route if p['spd']] or [0])/10 if route else 0) if h['pps'] else None
    # connections: shrink toward neutral when no stats (foreign)
    jw=h.get('j_win'); tw=h.get('t_win')
    f['connections']=((jw or 12)*0.4+(tw or 12)*0.6) if (jw or tw) else None
    last=h['pps'][0] if h['pps'] else None
    e=0.0
    if last:
        q=last['eq']
        if q['front_wraps']: e+=W['equipment_points']['front_wraps_last_start']
        if q['lasix']: e+=W['equipment_points']['lasix_last_start']
        if q['blinkers']: e+=W['equipment_points']['blinkers_last_start']
    f['equipment']=e
    wk=[w for w in h['works'] if (RACE_DATE-datetime.strptime(w['date'],'%d%b%y')).days<=35]
    bul=sum(1 for w in wk if w['rank']==1)
    # Overseas horses (no U.S. trainer stats) have their home works missing from the PDF -> treat as unknown, not bad.
    us_based = h.get('t_win') is not None
    f['workouts']=(min(len(wk),5)+1.5*min(bul,2)) if (h['works'] and us_based) else None
    n=len(h['pps'])
    f['workoutsRel']=1.0 if n<=2 else (0.5 if n<=5 else 0.25)   # works matter most when race history is thin
    f['_low_conf']=[k for k in ('speed','class','connections','workouts') if f[k] is None] + (['<4 lines'] if len(h['pps'])<4 else [])
    return f

def score_race(race):
    hs=race['horses']; F=[raw_features(h,race) for h in hs]
    comp={}
    for k in W['weights']:
        comp[k]=z([f[k] for f in F])
    scores=[sum(W['weights'][k]*comp[k][i]*(F[i]['workoutsRel'] if k=='workouts' else 1.0) for k in W['weights']) for i in range(len(hs))]
    T=W['softmax_temperature']; ex=[math.exp(s/T) for s in scores]; tot=sum(ex); probs=[e/tot for e in ex]
    return hs,F,comp,scores,probs

def plackett(probs, k):
    n=len(probs); res={}
    for combo in itertools.permutations(range(n),k):
        p=1.0; rem=1.0
        for i in combo:
            p*=probs[i]/rem; rem-=probs[i]
        res[combo]=p
    return res

if __name__=='__main__':
    card=json.load(open('/home/claude/pp/card.json'))
    rn=int(sys.argv[1]) if len(sys.argv)>1 else 12
    race=card[rn-1]; hs,F,comp,scores,probs=score_race(race)
    order=sorted(range(len(hs)),key=lambda i:-scores[i])
    print(f"R{rn} {race['dist_surface']} CR {race['cr']}")
    for i in order:
        h=hs[i]; c={k:round(comp[k][i],2) for k in comp}
        print(f"#{h['pp']:>2} {h['name'][:20]:20} ML {h['ml']:>5} score {scores[i]:+.2f} win% {100*probs[i]:4.1f} | {c} {F[i]['_low_conf'] or ''}")
    ex=sorted(plackett(probs,2).items(),key=lambda x:-x[1])[:3]
    tri=sorted(plackett(probs,3).items(),key=lambda x:-x[1])[:3]
    print("EXACTA:",[("-".join(str(hs[i]['pp']) for i in c),round(100*p,1)) for c,p in ex])
    print("TRI:",[("-".join(str(hs[i]['pp']) for i in c),round(100*p,1)) for c,p in tri])
