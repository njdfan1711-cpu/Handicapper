import json, re, sys
sys.path.insert(0,'/home/claude/pp')
import parse_pp as P, score as S
txt=open('/tmp/pp.txt').read()
bodies=P.split_races(txt)
card=json.load(open('/home/claude/pp/card.json'))
def eqstr(p):
    q=p['eq']; out=[]
    if q['lasix']: out.append('L')
    if q['prefix_B']: out.append('B')
    for k,l in (('blinkers','b'),('front_wraps','f'),('aluminum_pads','a'),('hood','h'),('visor','v'),('no_whip','n')):
        if q[k]: out.append(l)
    return ''.join(out)
FR={'Ê':'1⅛','Â':'1 1/16','Ã':'1 3/16'}
def fixd(d):
    for g,v in FR.items():
        if d.startswith('1'+g): return v+d[2:]
        if g in d: d=d.replace('1'+g,v).replace(g,v)
    return d

CT='Stk|Msw|Mcl|Clm|Aoc|Alw|Moc|Soc|Oc|Md'
def clean_cls(t):
    ms=list(re.finditer(r'(\d)([×x]?)\s*[^\sA-Za-z0-9:]?\s*('+CT+r')(\S*)((?:\s+\S*K\S*)?)((?:\s+G\d)?)',t))
    if not ms: return ''
    m=ms[-1]
    age=m[1]+('+' if m[2] else '')
    return re.sub(r'\s+',' ',f"{age} {m[3]}{m[4]} {m[5].strip()} {m[6].strip()}").strip()[:26]
races=[]
for i,(b,r) in enumerate(zip(bodies,card),1):
    t=re.search(r'•\s+(.+?)\s{2,}',b); title=t[1].strip() if t else f'Race {i}'
    nm=re.search(r"Trk Rcrd: \([\d:.]+\)\s+(.+?)\s+-\s+Grade\s+(\d)",b)
    grade=None
    if nm: title=re.sub(r"^(Prevagen|Maker's Mark|Cygames|FanDuel|Longines)\s+","",nm[1]).replace(' Presented by PDJF',''); grade='G'+nm[2]
    post=re.search(r'(\d{1,2}:\d{2}[AP])\s+•',b)
    horses=[]
    for h in r['horses']:
        f=S.raw_features(h,r)
        low=f.pop('_low_conf')
        horses.append(dict(pp=h['pp'],name=h['name'],ml=h['ml'],age=h.get('age'),sex=h.get('sex'),weight=h.get('weight'),
          jockey=h.get('jockey'),jWin=h.get('j_win'),trainer=h.get('trainer'),tWin=h.get('t_win'),sire=h.get('sire'),
          features=f,lowConf=low,
          pps=[dict(date=p['date'],track=p['track'],dist=fixd(p['dist_raw'].lstrip('*')),cls=clean_cls(p['cls']),rr=p['rr'],spd=p['spd'],fin=p.get('finish'),eq=eqstr(p)) for p in h['pps'][:6]],
          works=[dict(date=w['date'],f=w['f'],trk=w['trk'],time=w['time'],rank=w['rank'],of=w['of']) for w in h['works'][:4]]))
    races.append(dict(n=i,title=title,grade=grade,distSurface=fixd(r['dist_surface']),cr=r['cr'],par=r['par'],purse=r['purse'],horses=horses))
    print(i,title,'|',r['dist_surface'],'|',r['purse'])
out=dict(meta=dict(track='Keeneland',date='Saturday, October 31, 2026',source='TVG/Equibase past performances'),weights=S.W['weights'],temperature=S.W['softmax_temperature'],races=races)
json.dump(out,open('/home/claude/race-lens/src/data/card.json','w'),ensure_ascii=False,separators=(',',':'))
import os; print('json bytes',os.path.getsize('/home/claude/race-lens/src/data/card.json'))
