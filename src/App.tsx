import { useEffect, useMemo, useState } from 'react'
import raw from './data/cards.json'
import type { CardsFile, Factor, Race, Weights } from './lib/types'
import { FACTORS, FACTOR_LABEL, scoreRace, topCombos, type Scored } from './lib/score'
import { STYLE_NAME, scenarioText } from './lib/pace'
import { CLOTH } from './lib/cloth'
import SimPanel from './SimPanel'

const data = raw as unknown as CardsFile
const STORE = 'handicapper.settings.v1'
const SCR = 'handicapper.scratches.v2'

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
  return r.title.replace(' Special', '').replace(/ S\.$/, '').replace('Churchill Distaff Turf Mile', 'Distaff Turf Mile').replace('Derby City Distaff', 'Distaff')
}
function meta(r: Race) {
  const [dist, , age] = r.distSurface.split(' - ')
  const ageText = (age ?? '').replace('Ages ', '').replace('Age ', '').replace('×', '+')
  return { dist, surf: r.surface === 'turf' ? 'Turf' : 'Dirt', age: ageText ? `${ageText}yo` : '' }
}
const pct = (p: number) => (p * 100 >= 10 ? (p * 100).toFixed(0) : (p * 100).toFixed(1)) + '%'
const modelOdds = (p: number) => { const o = (1 - p) / p; return (o < 10 ? o.toFixed(1) : o.toFixed(0)) + '-1' }
const styleClass = (s: string | null) => (s ? 's-' + s.replace('/', '') : 's-none')

function loadSettings(): { weights: Weights; temp: number } {
  try {
    const s = JSON.parse(localStorage.getItem(STORE) || 'null')
    if (s && s.weights && typeof s.temp === 'number') return { weights: { ...data.weights, ...s.weights }, temp: s.temp }
  } catch { /* ignore */ }
  return { weights: data.weights, temp: data.temperature }
}
function loadScratches(): Record<string, number[]> {
  try { return JSON.parse(localStorage.getItem(SCR) || '{}') || {} } catch { return {} }
}

export default function App() {
  const [cardIdx, setCardIdx] = useState(data.cards.length - 1)
  const card = data.cards[cardIdx]
  const [raceIdx, setRaceIdx] = useState(card.races.length - 1)
  const [mode, setMode] = useState<(typeof MODES)[number]['key']>('win')
  const [openPP, setOpenPP] = useState<number | null>(null)
  const [sheet, setSheet] = useState(false)
  const [{ weights, temp }, setSettings] = useState(loadSettings)
  const [scratches, setScratches] = useState<Record<string, number[]>>(loadScratches)

  useEffect(() => { try { localStorage.setItem(STORE, JSON.stringify({ weights, temp })) } catch { /* ignore */ } }, [weights, temp])
  useEffect(() => { try { localStorage.setItem(SCR, JSON.stringify(scratches)) } catch { /* ignore */ } }, [scratches])
  useEffect(() => { setOpenPP(null) }, [raceIdx, cardIdx])
  useEffect(() => {
    document.querySelector('.tab[aria-pressed="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [raceIdx, cardIdx])

  const race = card.races[Math.min(raceIdx, card.races.length - 1)]
  const key = `${card.id}:${race.n}`
  const saved = scratches[key]
  const scratchedPPs = saved ?? race.scratched
  const normW = useMemo(() => {
    const sum = FACTORS.reduce((s, f) => s + (weights[f] ?? 0), 0) || 1
    return Object.fromEntries(FACTORS.map(f => [f, (weights[f] ?? 0) / sum])) as Weights
  }, [weights])
  const active = useMemo(() => race.horses.filter(h => !scratchedPPs.includes(h.pp)), [race, scratchedPPs])
  const scratchedHorses = race.horses.filter(h => scratchedPPs.includes(h.pp))
  const toggleScratch = (pp: number) => {
    setOpenPP(null)
    setScratches(s => {
      const cur = s[key] ?? race.scratched
      return { ...s, [key]: cur.includes(pp) ? cur.filter(x => x !== pp) : [...cur, pp] }
    })
  }
  const scored = useMemo(() => scoreRace(active, normW, temp), [active, normW, temp])
  const ranked = useMemo(() => [...scored].sort((a, b) => b.prob - a.prob), [scored])
  const m = MODES.find(x => x.key === mode)!
  const combos = useMemo(() => topCombos(scored.map(s => s.prob), m.k, m.k === 1 ? 3 : 4), [scored, m.k])
  const mm = meta(race)
  const pickCard = (i: number) => { setCardIdx(i); setRaceIdx(data.cards[i].races.length - 1) }

  return (
    <div className="app">
      <header className="top">
        <div>
          <h1>Handicapper</h1>
          <p className="sub">{card.meta.track}, {card.meta.date}</p>
        </div>
        <button className="ghost" onClick={() => setSheet(true)}>Weights</button>
      </header>

      {data.cards.length > 1 && (
        <div className="cardpick" role="group" aria-label="Card">
          {data.cards.map((c, i) => (
            <button key={c.id} aria-pressed={i === cardIdx} onClick={() => pickCard(i)}>{c.meta.track} {c.meta.date.slice(-4)}</button>
          ))}
        </div>
      )}

      <nav className="tabs" aria-label="Races">
        {card.races.map((r, i) => (
          <button key={r.n} className={`tab ${r.surface}`} aria-pressed={i === raceIdx} onClick={() => setRaceIdx(i)}>
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
            <span className={`surf ${race.surface}`}>{mm.surf}</span>
            <span>{mm.dist}</span>
            <span>{mm.age}</span>
            {race.purse && <span>${race.purse}</span>}
            <span>{active.length} runners{scratchedHorses.length > 0 ? `, ${scratchedHorses.length} scratched` : ''}</span>
          </p>
        </section>

        <section className="picks" aria-label="Model picks">
          <div className="seg" role="group" aria-label="Pick type">
            {MODES.map(x => (
              <button key={x.key} aria-pressed={mode === x.key} onClick={() => setMode(x.key)}>{x.label}</button>
            ))}
          </div>
          <ol className="combos">
            {combos.length === 0 && <li className="empty">Not enough runners left for a {m.label.toLowerCase()}.</li>}
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
                  {m.k === 1 && <i>model odds {modelOdds(c.p)}</i>}
                </span>
              </li>
            ))}
          </ol>
          <p className="note">Combinations use the model's win chances, so exotic percentages are estimates, not odds.</p>
          <details className="help">
            <summary>How to read this</summary>
            <ul>
              <li><b>Big %</b>: the model's chance this horse wins, after comparing it with the rest of the field.</li>
              <li><b>Model odds</b>: that chance as odds. 2.0-1 means about a 1 in 3 chance.</li>
              <li><b>ML and pts</b>: the morning line, then how many percentage points the model is above (+) or below (−) what the morning line implies.</li>
              <li><b>Factor numbers</b>: how the horse ranks against this field on each factor. 0 is average, and a factor with no data counts as 0.</li>
              <li><b>E, E/P, P, S</b>: running style from recent races. E wants the lead, E/P sits just off it, P is mid-pack, S is a closer.</li>
              <li><b>Pace fit</b>: scores each style against this field's pace matchup. It is off by default because it has not shown an edge in testing.</li>
            </ul>
          </details>
        </section>

        {scored.length >= 2 && <SimPanel key={key} race={race} scored={scored} weights={normW} />}

        <section className="field" aria-label="Field ranked by model">
          <div className="fieldhead"><span>Horse</span><span>Model vs morning line</span></div>
          {ranked.map(s => <Row key={s.horse.pp} s={s} open={openPP === s.horse.pp} toggle={() => setOpenPP(openPP === s.horse.pp ? null : s.horse.pp)} max={ranked[0].prob} onScratch={() => toggleScratch(s.horse.pp)} />)}
          {scratchedHorses.length > 0 && (
            <div className="scratched">
              <div className="fieldhead"><span>Scratched{saved === undefined ? ' (official scratches and also-eligibles)' : ''}</span><button className="linkbtn" onClick={() => setScratches(s => ({ ...s, [key]: [] }))}>Restore all</button></div>
              {scratchedHorses.map(h => (
                <div key={h.pp} className="srow">
                  <Cloth n={h.pp} />
                  <span className="sname">{h.name}</span>
                  <button className="ghost small" onClick={() => toggleScratch(h.pp)}>Restore</button>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {sheet && <Sheet weights={weights} temp={temp} onClose={() => setSheet(false)}
        onChange={(w, t) => setSettings({ weights: w, temp: t })}
        onReset={() => setSettings({ weights: data.weights, temp: data.temperature })} />}
    </div>
  )
}

function Row({ s, open, toggle, max, onScratch }: { s: Scored; open: boolean; toggle: () => void; max: number; onScratch: () => void }) {
  const h = s.horse
  const edge = s.mlProb === null ? null : (s.prob - s.mlProb) * 100
  return (
    <article className={`row ${open ? 'open' : ''}`}>
      <button className="rowbtn" aria-expanded={open} onClick={toggle}>
        <Cloth n={h.pp} />
        <span className="who">
          <span className="hname">{h.name}{h.lowConf.length > 0 && <em className="thin" title={`Thin data: ${h.lowConf.join(', ')}`}>thin data</em>}</span>
          <span className="hsub"><b className={`sty ${styleClass(h.style)}`} title={h.style ? STYLE_NAME[h.style] : 'No running style yet'}>{h.style ?? '–'}</b>{h.jockey ?? '—'} for {h.trainer ?? '—'}</span>
        </span>
        <span className="nums">
          <b>{pct(s.prob)}</b>
          <span className="ml">{h.ml ?? '—'}{edge !== null && <i className={edge >= 0 ? 'up' : 'down'}>{edge >= 0 ? '+' : '−'}{Math.abs(edge).toFixed(1)} pts</i>}</span>
        </span>
        <span className="bar" aria-hidden><span style={{ width: `${(s.prob / max) * 100}%` }} /></span>
      </button>
      {open && <Detail s={s} onScratch={onScratch} />}
    </article>
  )
}

function Detail({ s, onScratch }: { s: Scored; onScratch: () => void }) {
  const h = s.horse
  const gain = h.lateGain
  return (
    <div className="detail">
      <p className="bio">{h.age ?? ''}{h.sex ?? ''}, by {h.sire ?? 'unknown'}. {h.jWin === null && h.tWin === null ? 'No U.S. win rates for this jockey or trainer, so that factor counts as average.' : `Jockey wins ${h.jWin ?? 'n/a'}${h.jWin !== null ? '%' : ''}, trainer wins ${h.tWin ?? 'n/a'}${h.tWin !== null ? '%' : ''}.`}{h.lowConf.includes('workouts') ? ' Workouts count as average because his earlier works were not in this card.' : ''}</p>
      {h.style && h.earlyLen !== null && gain !== null
        ? <p className="bio"><b>{STYLE_NAME[h.style]}.</b> Usually {h.earlyLen <= 0 ? 'on the lead' : `${h.earlyLen.toFixed(1)} lengths off the lead`} at the first call, and {gain >= 0 ? `gains ${gain.toFixed(1)}` : `loses ${Math.abs(gain).toFixed(1)}`} lengths from there to the finish (last {h.paceRuns} races).</p>
        : <p className="bio">No running style yet: no usable pace calls in recent races.</p>}
      <p className="cap">How this horse compares with the rest of the field. 0 is average, +1 is about one step above, and the bars cap at ±2.5.</p>
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
      <button className="scratchbtn" onClick={onScratch}>Scratch {h.name}</button>
      <p className="legend">Gear: L Lasix, B Bute, b blinkers, f front wraps, a aluminum pads, h hood, v visor, n no whip.</p>
    </div>
  )
}

function Sheet({ weights, temp, onChange, onReset, onClose }: {
  weights: Weights; temp: number; onChange: (w: Weights, t: number) => void; onReset: () => void; onClose: () => void
}) {
  const sum = FACTORS.reduce((s, f) => s + (weights[f] ?? 0), 0) || 1
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label="Model weights" onClick={e => e.stopPropagation()}>
        <div className="sheethead"><h3>Model weights</h3><button className="ghost" onClick={onClose}>Done</button></div>
        <p className="note">Weights are relative. Each slider's share of the total is shown on the right. The simulation uses these weights (except Pace fit) as each horse's ability.</p>
        {FACTORS.map(f => (
          <label key={f} className="slider">
            <span>{FACTOR_LABEL[f]}</span>
            <input type="range" min={0} max={0.6} step={0.01} value={weights[f] ?? 0} onChange={e => onChange({ ...weights, [f]: Number(e.target.value) }, temp)} />
            <b>{Math.round(((weights[f] ?? 0) / sum) * 100)}%</b>
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
