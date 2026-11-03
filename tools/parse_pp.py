import re, json, sys

FRAC = {'¼':'.25','½':'.5','¾':'.75'}

def split_races(txt):
    pages = txt.split('\f'); starts=[]
    for i,p in enumerate(pages):
        if re.search(r'CR:\s+\d+\s+\(Par of', p):
            starts.append(i)
    bounds = starts+[len(pages)]
    return ['\n'.join(pages[s:bounds[k+1]]) for k,s in enumerate(starts)]

def split_figs(tok):
    """Split jammed race-rating + speed-fig like '109116' or '97105'."""
    if ' ' in tok: a,b = tok.split(); return int(a), int(b)
    n=len(tok)
    if n==6: return int(tok[:3]), int(tok[3:])
    if n==4: return int(tok[:2]), int(tok[2:])
    if n==5:
        for k in (2,3):
            a,b=int(tok[:k]),int(tok[k:])
            if 30<=a<=150 and 30<=b<=150: return a,b
    return None,None

PP_RE = re.compile(
 r'^\s*(?P<date>\d{1,2}[A-Z][a-z]{2}\d{2})\s*(?P<rno>\d{1,2})?\s+(?P<trk>[A-Za-z]{2,4})\s+'
 r'(?P<cond>\w{1,3})\S{0,2}\s+(?P<dist>\S+)\s+(?P<tv>\d{1,3})?\s*.*?'
 r'(?P<cls>(?:\d[×x]?)?\s?(?:Stk|Msw|Mcl|Clm|Aoc|Alw|Soc|OC|Oc|Moc|Md)\S*(?:\s+\S+K)?(?:\s+G\d)?)\s+'
 r'(?P<figs>\d{2,3}\s?\d{2,3})\s+(?P<rest>.*)$')


HEAD_RE = re.compile(r'^\s*(?P<date>\d{1,2}[A-Z][a-z]{2}\d{2})\s*(?P<rno>\d{1,2})?\s+(?P<trk>[A-Za-z]{2,4}?)\s*(?P<cond>ft|gd|sy|fm|wf|my|sf|hy|yl|sl|fr|gf|gs|st|gy|sd|hv)\S{0,2}\s+(?:[^\w\s:*½¼¾]\s+)?(?P<dist>\*?[\d½¼¾]\S*)')
FIG_RE = re.compile(r'\s(?P<figs>\d{2,3}\s\d{1,3}|\d{4,6})\s+(?P<post>\d{1,2})\s+(?P<start>\d{1,2})\s+(?P<calls>(?:[\d½¼¾hdnkso]+\s+){3,10}?)(?P<jock>[A-Z][A-Za-z\'.\- 0-9]*?)\s+(?P<wt>[A-Za-z]?\d{3}[A-Za-z]*)(?=\s)(?:\s+(?P<odds>\*?\d+\.\d+))?')
FOREIGN_RE = re.compile(r'\s(?P<figs>\d{2,3}\s\d{1,3}|\d{4,6})(?:\s+Timeform:\s*\d+)?\s+(?P<fin>\d+[½¼¾]?(?:hd|nk|ns)?[½¼¾]?)\s+(?P<jock>[A-Z][A-Za-z\'.\- ]*?)\s+(?P<wt>[A-Za-z]?\d{3}[A-Za-z]*)(?=\s)(?:\s+(?P<odds>\*?\d+\.\d+))?')
def parse_pp_line(l):
    h=HEAD_RE.match(l)
    if not h: return None
    f=FIG_RE.search(l); kind='dom'
    if not f:
        f=FOREIGN_RE.search(l); kind='intl'
    if not f: return None
    a,b=split_figs(f['figs'])
    cls=l[h.end():f.start()].strip()
    wt=f['wt']
    d=dict(date=h['date'],track=h['trk'],cond=h['cond'],dist_raw=h['dist'],cls=cls[-80:],rr=a,spd=b,kind=kind,
           jockey=f['jock'].strip(),wt=int(re.sub(r'\D','',wt)),wt_token=wt,
           blinkers=('b' in wt), lasix=wt.startswith('L'),odds=f['odds'])
    mm=re.match(r'([A-Za-z]*)(\d{3})([A-Za-z]*)',wt)
    pre,suf=(mm[1],mm[3]) if mm else ('','')
    d['eq']=dict(lasix='L' in pre,prefix_B='B' in pre,blinkers='b' in suf,front_wraps='f' in suf,
                 aluminum_pads='a' in suf,hood='h' in suf,visor='v' in suf,no_whip='n' in suf)
    if kind=='dom':
        d.update(post=int(f['post']),start=int(f['start']),calls_raw=f['calls'].split())
        tail=l[f.end():]
    else:
        d.update(fin_raw=f['fin']); tail=l[f.end():]
    # top-3 finishers string follows the odds / -n variant field
    m=re.search(r'(?:\s-?\d+)?\s+([A-Z][A-Za-z\']*(?:[\d½¼¾]|hd|nk|ns)[A-Za-z0-9½¼¾\']*)',tail)
    d['chart_raw']=m[1][:80] if m else None
    return d

CLASS_TOK = re.compile(r'(Stk|Msw|Mcl|Clm|Aoc|Alw|Moc|Soc|Oc|Md)')
def is_workout(l): return bool(re.search(r'\s[BH]g?\s+\d+/\d+',l)) and not re.search(r'\d{2,3}\s?\d{2,3}\s+\d{1,2}\s+\d{1,2}\s',l)
def is_note(l): return bool(re.search(r'\s-\s+[A-Za-z-]+\s*(?:\||$)',re.sub(r'\s{2,}',' | ',l))) and not re.search(r'\d{2,3}\s?\d{2,3}',l)
def is_race_candidate(l):
    return bool(re.match(r'^\s*\d{1,2}[A-Z][a-z]{2}\d{2}',l) and not is_workout(l) and not is_note(l)
                and re.search(r'\s\d{2,3}\s?\d{1,3}\s',l) and CLASS_TOK.search(l))

def norm(n): return re.sub(r'[^a-z]','',re.sub(r'\([^)]*\)','',n.lower()))
def chart_names(chart):
    if not chart: return []
    return [norm(x[0]) for x in re.findall(r"([A-Za-z'.\-]+?)(\d+[½¼¾]?|[½¼¾]|hd|nk|ns)(?=[A-Z]|$)",chart)] or []
def decode_finish(tok, name, chart):
    names=chart_names(chart); nn=norm(name or '')
    for i,c in enumerate(names):
        if len(c)>=4 and nn and (nn.startswith(c[:8]) or c.startswith(nn[:8])): return i+1,'chart'
    m=re.match(r'(\d+)(.*)',tok or '')
    if not m: return None,None
    digits,rest=m[1],m[2]; cands=[]
    for k in range(1,len(digits)+1):
        pos=int(digits[:k]); mar=digits[k:]+rest
        if 4<=pos<=20 and mar and not mar.startswith('0'): cands.append(pos)
    return (cands[0],'token') if len(cands)==1 else (None,None)

def fix_jam(s):
    """Workout rank/field digits jam into the next date: '34/14722Aug26' -> '34/147 22Aug26'."""
    def rep(m):
        rank,D=m[1],m[2]
        day=D[-2:] if len(D)>=4 and 1<=int(D[-2:])<=31 else D[-1:]
        field=D[:-len(day)]
        return f"{rank}/{field} {day}"
    return re.sub(r'(\d+)/(\d+)(?=[A-Z][a-z]{2}\d{2})',rep,s)

def parse_horse(lines):
    h={'raw_lines':len(lines)}
    blob='\n'.join(lines)
    m=re.search(r'PP-(\d+)\s+Jock:\s+(.+?)\s+\(St~(\d+)~W~(\d+)%~P~(\d+)%~S~(\d+)%~~ITM~(\d+)%~ROI~([+-]?\d+)%\)',blob)
    if m: h.update(pp=int(m[1]),jockey=m[2].strip(),j_starts=int(m[3]),j_win=int(m[4]),j_itm=int(m[7]),j_roi=int(m[8]))
    mj=re.search(r'PP-(\d+)\s+Jock:\s+(.+?)\s+\(no starts\)',blob)
    if mj: h.update(pp=int(mj[1]),jockey=mj[2].strip(),j_starts=0,j_win=None,j_itm=None,j_roi=None)
    m0=re.search(r'Tr:\s+(.+?)\s+\(no starts\)',blob)
    if m0: h.update(trainer=re.sub(r'\s+',' ',m0[1]).strip(),t_starts=0,t_win=None,t_itm=None,t_roi=None)
    m=re.search(r'Tr:\s+(.+?)\s+\(St~(\d+)~W~(\d+)%~P~(\d+)%~S~(\d+)%~~ITM~(\d+)%~ROI~([+-]?\d+)%\)',blob)
    if m: h.update(trainer=re.sub(r'\s+',' ',m[1]).strip(),t_starts=int(m[2]),t_win=int(m[3]),t_itm=int(m[6]),t_roi=int(m[7]))
    for l in lines[:5]:
        m=re.match(r'^\s+(\d{1,2})\s*[^A-Za-z0-9\s]?\s*([A-Z][A-Za-z\'.\-() ]+?)(?:\s{2,}|$)',l)
        if m and 'name' not in h: h['name']=m[2].strip(); h['pgm']=int(m[1])
    m=re.search(r'Sire:\s+(.+?)(?:\s+\(\$|\s{2,})',blob); h['sire']=m[1].strip() if m else None
    m=re.search(r'Dam:\s+(.+?)\s+\(([^)]+)\)',blob); h['dam']=m[1].strip() if m else None; h['damsire']=m[2] if m else None
    m=re.search(r'(?m)^\s*(\d+/\d+|\*?\d+(?:\.\d+)?/1)\s+Tr:',blob) or re.search(r'(\d+/\d+|\d+/1)\s+Tr:',blob)
    h['ml']=m[1] if m else None
    m=re.search(r'\b(\d{3})\s+(?:[A-Za-z/]{1,6}\s+){0,2}?([cfghrm])\s+(\d)\b',blob)
    if m: h.update(weight=int(m[1]),sex=m[2],age=int(m[3]))
    m=re.search(r'Lifetime Record\s+(\d+)',blob)
    # past performances
    pps=[]; cand=0
    for i,l in enumerate(lines):
        if is_race_candidate(l): cand+=1
        d=parse_pp_line(l)
        if not d and is_race_candidate(l):
            for extra in (1,2):
                if i+extra<len(lines):
                    d=parse_pp_line(l.rstrip()+'  '+' '.join(x.strip() for x in lines[i+1:i+1+extra]))
                    if d: break
        if d:
            fp,how=decode_finish(d.get('fin_raw') or (d.get('calls_raw') or [None])[-1],h.get('name'),d.get('chart_raw'))
            d['finish']=fp; d['finish_how']=how
            pps.append(d)
    h['pp_candidates']=cand; h['pp_parsed']=len(pps)
    h['pps']=pps
    works=re.findall(r'(\d{1,2}[A-Z][a-z]{2}\d{2})\s+(\d)f\s+\S*\s*(?:ft|gd|sy|wf|fm|my|sf)\s+(\w+)\s+(:?\d?:?\d{2}\.?\d?)\s+([BH]g?)\s+(\d+)/(\d+)',fix_jam(blob))
    h['works']=[dict(date=w[0],f=int(w[1]),trk=w[2],time=w[3],kind=w[4],rank=int(w[5]),of=int(w[6])) for w in works]
    return h

def parse_race(body):
    r={}
    m=re.search(r'POST\s+•\s+(.+?)\s{2,}',body); r['dist_surface']=m[1] if m else None
    m=re.search(r'CR:\s+(\d+)\s+\(Par of ([\d:.]+)\)',body); r['cr']=int(m[1]); r['par']=m[2]
    m=re.search(r'PURSE\s+\$([\d,]+)',body); r['purse']=m[1] if m else None
    lines=body.split('\n')
    idx=[i for i,l in enumerate(lines) if re.match(r'^\s*[øÔÖ]?\s*\d{3}\s+(?:Sire:|[A-Za-z/ ]{1,12}?\s+[cfghrm]\s+\d)',l)]
    horses=[]
    for k,i in enumerate(idx):
        j=idx[k+1] if k+1<len(idx) else len(lines)
        horses.append(parse_horse(lines[i:j]))
    r['horses']=horses
    return r

if __name__=='__main__':
    txt=open('/tmp/pp.txt').read()
    races=split_races(txt)
    out=[parse_race(b) for b in races]
    json.dump(out,open('card.json','w'),indent=1,ensure_ascii=False)
    n=int(sys.argv[1]) if len(sys.argv)>1 else 12
    r=out[n-1]
    print(f"R{n} {r['dist_surface']} CR {r['cr']} par {r['par']} purse {r['purse']} | {len(r['horses'])} horses")
    for h in r['horses']:
        last=[f"{p['rr']}/{p['spd']}" for p in h['pps'][:3]]
        print(f"#{h.get('pp')} {h.get('name')} | ML {h.get('ml')} | {h.get('age')}{h.get('sex')} | J {h.get('jockey')} {h.get('j_win')}% | T {h.get('trainer')} {h.get('t_win')}% | sire {h.get('sire')} | PPs {len(h['pps'])} last3 RR/Spd {last} | works {len(h['works'])}")
