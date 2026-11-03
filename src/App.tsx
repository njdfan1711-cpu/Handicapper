import { useEffect, useMemo, useState } from 'react'
import raw from './data/card.json'
import type { Card, Factor, Race, Weights } from './lib/types'
import { FACTORS, FACTOR_LABEL, scoreRace, topCombos, type Scored } from './lib/score'

const data = raw as unknown as Card
const STORE = 'handicapper.settings.v1'

const CLOTH: Record<number, [string, string]> = {
  1: ['#D7263D', '#fff'], 2: ['#FFFFFF', '#1F2A33'], 3: ['#1D5FD1', '#fff'], 4: ['#F2C318', '#1F2A33'],
  5: ['#1E9E4A', '#fff'], 6: ['#1A1A1A', '#fff'], 7: ['#F28C1B', '#1F2A33'], 8: ['#F2A0C0', '#1F2A33'],
  9: ['#1FB5B0', '#1F2A33'], 10: ['#7B3FA0', '#fff'], 11: ['#B8BEC6', '#1F2A33'], 12: ['#A6D12B', '#1F2A33'],
  13: ['#6B7A2A', '#fff'], 14: ['#8B5A2B', '#fff'], 15: ['#5B6C8F', '#fff'], 16: ['#E8C9A0', '#1F2A33'],
  17: ['#2C5E4A', '#fff'], 18: ['#A33A6B', '#fff'],
}
function Cloth({ n }: { n: number }) {
  const [bg, fg] = CLOTH[n] ?? ['#888', '#fff']
  return <span className="cloth" style={{ background: bg, color: fg }}>{n}</span>
}

const MODES = [
  { key: 'win', label: 'Win', k: 1 },
  { key: 'exacta', label: 'Exacta', k: 2 },
  { key: 'trifecta', label: 'Trifecta', k: 3 },
  { key: 'superfecta', label: 'Superfecta', k: 4 },
] as const

function shortName(r: Race) {
  if (r.title.startsWith("Breeders' Cup ")) return r.title.replace("Breeders' Cup ", '').replace('Filly & Mare', 'F&M')
  if (r.title.startsWith('Optional Claiming')) return 'Opt Clm'
  return r.title.replace(' Special', '')
}
function surface(r: Race) { return r.distSurface.includes('Turf') ? 'turf' : 'dirt' }
function meta(r: Race) {
  const [dist, , age] = r.distSurface.split(' - ')
  const ageText = (age ?? '').replace('Ages ', '').replace('Age ', '').replace('×', '+')
  return { dist, surf: surface(r) === 'turf' ? 'Turf' : 'Dirt', age: ageText ? `${ageText}yo` : '' }
}
const pct = (p: number) => (p * 100 >= 10 ? (p * 100).toFixed(0) : (p * 100).toFixed(1)) + '%'
const modelOdds = (p: number) => { const o = (1 - p) / p; return (o < 10 ? o.toFixed(1) : o.toFixed(0)) + '-1' }

function loadSettings(): { weights: Weights; temp: number } {
  try {
    const s = JSON.parse(localStorage.getItem(STORE) || 'null')
    if (s && s.weights && typeof s.temp === 'number') return s
  } catch { /* ignore */ }
  return { weights: data.weights, temp: data.temperature }
}

export default function App() {
  const [raceIdx, setRaceIdx] = useState(data.races.length - 1)
  const [mode, setMode] = useState<(typeof MODES)[number]['key']>('win')
  const [openPP, setOpenPP] = useState<number | null>(null)
  const [sheet, setSheet] = useState(false)
  const [{ weights, temp }, setSettings] = useState(loadSettings)

  useEffect(() => { try { localStorage.setItem(STORE, JSON.stringify({ weights, temp })) } catch { /* ignore */ } }, [weights, temp])
  useEffect(() => { setOpenPP(null) }, [raceIdx])
  useEffect(() => {
    document.querySelector('.tab[aria-pressed="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [raceIdx])

  const race = data.races[raceIdx]
  const normW = useMemo(() => {
    const sum = FACTORS.reduce((s, f) => s + weights[f], 0) || 1
    return Object.fromEntries(FACTORS.map(f => [f, weights[f] / sum])) as Weights
  }, [weights])
  const scored = useMemo(() => scoreRace(race.horses, normW, temp), [race, normW, temp])
  const ranked = useMemo(() => [...scored].sort((a, b) => b.prob - a.prob), [scored])
  const m = MODES.find(x => x.key === mode)!
  const combos = useMemo(() => topCombos(scored.map(s => s.prob), m.k, m.k === 1 ? 3 : 4), [scored, m.k])
  const mm = meta(race)

  return (
    <div className="app">
      <header className="top">
        <div>
          <h1>Handicapper</h1>
          <p className="sub">{data.meta.track}, {data.meta.date}</p>
        </div>
        <button className="ghost" onClick={() => setSheet(true)}>Weights</button>
      </header>

      <nav className="tabs" aria-label="Races">
        {data.races.map((r, i) => (
          <button key={r.n} className={`tab ${surface(r)}`} aria-pressed={i === raceIdx} onClick={() => setRaceIdx(i)}>
            <span className="tabnum">{r.n}</span>
            <span className="tabname">{shortName(r)}</span>
          </button>
        ))}
      </nav>

      <main>
        <section className="racehead">
          <div className="titleline">
            {race.grade && <span className="grade">{race.grade}</span>}
            <h2>{race.title}</h2>
          </div>
          <p className="facts">
            <span className={`surf ${surface(race)}`}>{mm.surf}</span>
            <span>{mm.dist}</span>
            <span>{mm.age}</span>
            {race.purse && <span>${race.purse}</span>}
            <span>{race.horses.length} runners</span>
          </p>
        </section>

        <section className="picks" aria-label="Model picks">
          <div className="seg" role="group" aria-label="Pick type">
            {MODES.map(x => (
              <button key={x.key} aria-pressed={mode === x.key} onClick={() => setMode(x.key)}>{x.label}</button>
            ))}
          </div>
          <ol className="combos">
            {combos.map((c, i) => (
              <li key={c.idx.join('-')} className={i === 0 ? 'top1' : ''}>
                <span className="chips">
                  {c.idx.map((ix, j) => (
                    <span key={ix} className="chipwrap">
                      {j > 0 && <span className="sep">over</span>}
                      <Cloth n={scored[ix].horse.pp} />
                      {m.k === 1 && <span className="cname">{scored[ix].horse.name}</span>}
                    </span>
                  ))}
                </span>
                <span className="cp">
                  <b>{pct(c.p)}</b>
                  {m.k === 1 && <i>fair {modelOdds(c.p)}</i>}
                </span>
              </li>
            ))}
          </ol>
          <p className="note">Combinations use the model's win chances, so exotic percentages are estimates, not odds.</p>
        </section>

        <section className="field" aria-label="Field ranked by model">
          <div className="fieldhead"><span>Horse</span><span>Model vs morning line</span></div>
          {ranked.map(s => <Row key={s.horse.pp} s={s} open={openPP === s.horse.pp} toggle={() => setOpenPP(openPP === s.horse.pp ? null : s.horse.pp)} max={ranked[0].prob} />)}
        </section>
      </main>

      {sheet && <Sheet weights={weights} temp={temp} onClose={() => setSheet(false)}
        onChange={(w, t) => setSettings({ weights: w, temp: t })}
        onReset={() => setSettings({ weights: data.weights, temp: data.temperature })} />}
    </div>
  )
}

function Row({ s, open, toggle, max }: { s: Scored; open: boolean; toggle: () => void; max: number }) {
  const h = s.horse
  const edge = s.mlProb === null ? null : (s.prob - s.mlProb) * 100
  return (
    <article className={`row ${open ? 'open' : ''}`}>
      <button className="rowbtn" aria-expanded={open} onClick={toggle}>
        <Cloth n={h.pp} />
        <span className="who">
          <span className="hname">{h.name}{h.lowConf.length > 0 && <em className="thin" title={`Thin data: ${h.lowConf.join(', ')}`}>thin data</em>}</span>
          <span className="hsub">{h.jockey ?? '—'} for {h.trainer ?? '—'}</span>
        </span>
        <span className="nums">
          <b>{pct(s.prob)}</b>
          <span className="ml">{h.ml ?? '—'}{edge !== null && <i className={edge >= 0 ? 'up' : 'down'}>{edge >= 0 ? '+' : '−'}{Math.abs(edge).toFixed(1)}</i>}</span>
        </span>
        <span className="bar" aria-hidden><span style={{ width: `${(s.prob / max) * 100}%` }} /></span>
      </button>
      {open && <Detail s={s} />}
    </article>
  )
}

function Detail({ s }: { s: Scored }) {
  const h = s.horse
  return (
    <div className="detail">
      <p className="bio">{h.age ?? ''}{h.sex ?? ''}, by {h.sire ?? 'unknown'}. {h.jWin === null && h.tWin === null ? 'No U.S. win rates for this jockey or trainer.' : `Jockey wins ${h.jWin ?? 'n/a'}${h.jWin !== null ? '%' : ''}, trainer wins ${h.tWin ?? 'n/a'}${h.tWin !== null ? '%' : ''}.`}</p>
      <div className="factors">
        {FACTORS.map((f: Factor) => (
          <div key={f} className="frow">
            <span>{FACTOR_LABEL[f]}</span>
            <span className="fbar"><span className={s.z[f] >= 0 ? 'pos' : 'neg'} style={{ width: `${Math.min(Math.abs(s.z[f]) / 2.5, 1) * 50}%`, [s.z[f] >= 0 ? 'left' : 'right']: '50%' }} /></span>
            <span className="fz">{s.z[f] >= 0 ? '+' : '−'}{Math.abs(s.z[f]).toFixed(1)}</span>
          </div>
        ))}
      </div>
      <div className="pptable" role="table" aria-label="Recent races">
        <div className="pprow head" role="row"><span>Date</span><span>Track, dist</span><span>Class</span><span>RR / Spd</span><span>Fin</span><span>Gear</span></div>
        {h.pps.map((p, i) => (
          <div className="pprow" role="row" key={i}>
            <span>{p.date}</span><span>{p.track} {p.dist}</span><span className="cls">{p.cls || '-'}</span>
            <span>{p.rr ?? '-'} / <b>{p.spd ?? '-'}</b></span>
            <span className={p.fin === 1 ? 'win' : ''}>{p.fin ?? '-'}</span>
            <span className={p.eq.includes('f') ? 'flag' : ''}>{p.eq || '-'}</span>
          </div>
        ))}
      </div>
      {h.works.length > 0 && <p className="works">Works: {h.works.map(w => `${w.date} ${w.f}f ${w.time} (${w.rank}/${w.of})`).join(', ')}</p>}
      <p className="legend">Gear: L Lasix, B Bute, b blinkers, f front wraps, a aluminum pads, h hood, v visor, n no whip.</p>
    </div>
  )
}

function Sheet({ weights, temp, onChange, onReset, onClose }: {
  weights: Weights; temp: number; onChange: (w: Weights, t: number) => void; onReset: () => void; onClose: () => void
}) {
  const sum = FACTORS.reduce((s, f) => s + weights[f], 0) || 1
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label="Model weights" onClick={e => e.stopPropagation()}>
        <div className="sheethead"><h3>Model weights</h3><button className="ghost" onClick={onClose}>Done</button></div>
        <p className="note">Weights are relative. Each slider's share of the total is shown on the right.</p>
        {FACTORS.map(f => (
          <label key={f} className="slider">
            <span>{FACTOR_LABEL[f]}</span>
            <input type="range" min={0} max={0.6} step={0.01} value={weights[f]} onChange={e => onChange({ ...weights, [f]: Number(e.target.value) }, temp)} />
            <b>{Math.round((weights[f] / sum) * 100)}%</b>
          </label>
        ))}
        <label className="slider">
          <span>Favorite strength</span>
          <input type="range" min={0.4} max={2} step={0.05} value={temp} onChange={e => onChange(weights, Number(e.target.value))} />
          <b>{temp.toFixed(2)}</b>
        </label>
        <p className="note">Lower values give the top-rated horses a bigger share of the win chance.</p>
        <button className="ghost" onClick={onReset}>Reset to defaults</button>
      </div>
    </div>
  )
}
