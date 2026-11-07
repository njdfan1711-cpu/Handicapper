import { useMemo, useState } from 'react'
import type { Race, Weights } from './lib/types'
import { ability, type Scored } from './lib/score'
import { CLOTH } from './lib/cloth'
import { BAND, R, callsFor, loopPath, pathPoint, tStartFor } from './lib/track'
import { LENGTH_F, avgRelBehind, mulberry32, relBehind, runOnce, simulateMany, type SimHorse } from './lib/sim'
import { STYLE_NAME, scenarioText } from './lib/pace'

const GAP = 0.15 // furlongs of separation before two chips may share a lane
const fmtL = (x: number) => (x < 0.05 ? 'Leader' : `${x < 10 ? x.toFixed(1) : x.toFixed(0)} L`)

export default function SimPanel({ race, scored, weights }: { race: Race; scored: Scored[]; weights: Weights }) {
  const calls = useMemo(() => callsFor(race.distF), [race.distF])
  const [callIdx, setCallIdx] = useState(() => Math.min(1, callsFor(race.distF).length - 1))
  const [mode, setMode] = useState<'likely' | 'run'>('likely')
  const [seed, setSeed] = useState(1)

  const simH: SimHorse[] = useMemo(() => {
    const known = scored.map(s => s.horse.earlyLen).filter((x): x is number => x !== null)
    const mean = known.length ? known.reduce((a, b) => a + b, 0) / known.length : 6
    return scored.map(s => ({ ability: ability(s, weights), earlyLen: s.horse.earlyLen ?? mean }))
  }, [scored, weights])
  const summary = useMemo(() => simulateMany(simH), [simH])
  const single = useMemo(() => runOnce(simH, mulberry32(seed * 7919 + 13)), [simH, seed])

  const call = calls[Math.min(callIdx, calls.length - 1)]
  const f = call.run / race.distF
  const f1 = Math.min(0.5, Math.max(0.12, 2 / race.distF))
  const rel = mode === 'likely' ? avgRelBehind(f, f1, summary.runs) : relBehind(f, f1, single)
  const tStart = tStartFor(race.distF)
  const order = scored.map((_, i) => i).sort((a, b) => rel[a] - rel[b] || scored[a].horse.pp - scored[b].horse.pp)

  const placed = useMemo(() => {
    const out: { i: number; x: number; y: number }[] = []
    if (call.run === 0) {
      const byPP = scored.map((_, i) => i).sort((a, b) => scored[a].horse.pp - scored[b].horse.pp)
      const sp = byPP.length > 1 ? Math.min(10, (BAND - 10) / (byPP.length - 1)) : 0
      byPP.forEach((i, k) => { const p = pathPoint(tStart, -35 + k * sp); out.push({ i, x: p.x, y: p.y }) })
      return out
    }
    const tails = new Array<number>(8).fill(-Infinity)
    for (const i of order) {
      const relF = rel[i] * LENGTH_F
      let lane = tails.findIndex(t => relF - t >= GAP)
      if (lane < 0) lane = tails.reduce((best, t, L) => (relF - t > relF - tails[best] ? L : best), 0)
      tails[lane] = relF
      const p = pathPoint(tStart + call.run - relF, -35 + lane * 10)
      out.push({ i, x: p.x, y: p.y })
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call.run, mode, seed, summary, single, scored, race.distF])

  // Close-up strip: lengths behind the leader, leader on the right, rows chosen so chips never overlap.
  const strip = useMemo(() => {
    if (call.run === 0) return null
    const W = 340, padL = 16, padR = 16
    const span = Math.max(Math.max(...rel), 4)
    const px = (W - padL - padR) / span
    const rows: number[] = []
    const items: { i: number; x: number; row: number }[] = []
    for (const i of [...order].reverse()) {          // from the back of the pack to the front
      const x = W - padR - rel[i] * px
      let row = rows.findIndex(last => Math.abs(x - last) >= 22)
      if (row < 0) { rows.push(x); row = rows.length - 1 } else rows[row] = x
      items.push({ i, x, row })
    }
    return { W, items, rows: rows.length, span }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call.run, mode, seed, summary, single, scored, race.distF])

  const turf = race.surface === 'turf'
  const w0 = pathPoint(0, -BAND / 2), w1 = pathPoint(0, BAND / 2)
  const g0 = pathPoint(tStart, -BAND / 2), g1 = pathPoint(tStart, BAND / 2)
  const poles = [{ t: 6, l: '¼' }, { t: 4, l: '½' }, { t: 2, l: '¾' }]
  const leader = order[0]

  return (
    <section className="sim" aria-label="Race simulation">
      <div className="simhead">
        <h3>Race simulation</h3>
        <div className="seg two" role="group" aria-label="Simulation view">
          <button aria-pressed={mode === 'likely'} onClick={() => setMode('likely')}>Most likely</button>
          <button aria-pressed={mode === 'run'} onClick={() => setMode('run')}>One run</button>
        </div>
      </div>
      <p className="scen">{scenarioText(scored.map(s => s.horse.style))}</p>

      <div className="calls" role="group" aria-label="Point in the race">
        {calls.map((c, i) => (
          <button key={c.key} className="callbtn" aria-pressed={i === callIdx} onClick={() => setCallIdx(i)}>{c.label}</button>
        ))}
      </div>

      <svg className="track" viewBox="-228 -120 456 240" role="img" aria-label={`Track map at ${call.label}`}>
        <path d={loopPath(0)} fill="none" stroke={turf ? '#D5E2D8' : '#E7DCCD'} strokeWidth={BAND} strokeLinejoin="round" />
        <path d={loopPath(-BAND / 2)} fill="#F8FAFC" stroke="#94A3B8" strokeWidth={1.5} />
        <path d={loopPath(BAND / 2)} fill="none" stroke="#94A3B8" strokeWidth={1.5} />
        {poles.map(p => { const a = pathPoint(p.t, BAND / 2), b = pathPoint(p.t, BAND / 2 + 7), c = pathPoint(p.t, BAND / 2 + 17); return (
          <g key={p.t}><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#94A3B8" strokeWidth={1.5} /><text x={c.x} y={c.y} fontSize={10} fill="#64748B" textAnchor="middle" dy="3">{p.l}</text></g>) })}
        <line x1={g0.x} y1={g0.y} x2={g1.x} y2={g1.y} stroke="#64748B" strokeWidth={2} strokeDasharray="3 2" />
        <line x1={w0.x} y1={w0.y} x2={w1.x} y2={w1.y} stroke="#1E3A8A" strokeWidth={3} />
        <text x={pathPoint(0, BAND / 2 + 17).x} y={pathPoint(0, BAND / 2 + 17).y} fontSize={10} fill="#1E3A8A" textAnchor="middle" dy="3" fontWeight={600}>wire</text>
        <text x={0} y={-4} fontSize={12} fill="#64748B" textAnchor="middle">{call.label}</text>
        <text x={0} y={12} fontSize={10} fill="#94A3B8" textAnchor="middle">{call.run === 0 ? 'in the gate' : `${call.run % 1 === 0 ? call.run : call.run.toFixed(2)} furlongs run`}</text>
        {[...placed].reverse().map(({ i, x, y }) => {
          const h = scored[i].horse; const [bg, fg] = CLOTH[h.pp] ?? ['#888', '#fff']; const lead = i === leader && call.run > 0
          return (
            <g key={h.pp} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
              <circle r={8.5} fill={bg} stroke={lead ? '#1E3A8A' : 'rgba(15,23,42,.5)'} strokeWidth={lead ? 2.2 : 1} />
              <text textAnchor="middle" dy="3" fontSize={h.pp >= 10 ? 9 : 10} fontWeight={600} fill={fg}>{h.pp}</text>
            </g>)
        })}
      </svg>

      {strip && (
        <svg className="strip" viewBox={`0 0 ${strip.W} ${strip.rows * 24 + 26}`} role="img" aria-label="Close-up of the pack, lengths behind the leader">
          <line x1={10} y1={strip.rows * 24 + 8} x2={strip.W - 10} y2={strip.rows * 24 + 8} stroke="#CBD5E1" strokeWidth={1.5} />
          <text x={strip.W - 16} y={strip.rows * 24 + 21} fontSize={10} fill="#64748B" textAnchor="middle">leader</text>
          <text x={16} y={strip.rows * 24 + 21} fontSize={10} fill="#64748B" textAnchor="start">{strip.span.toFixed(0)} lengths back</text>
          {strip.items.map(({ i, x, row }) => {
            const h = scored[i].horse; const [bg, fg] = CLOTH[h.pp] ?? ['#888', '#fff']
            return (
              <g key={h.pp} transform={`translate(${x.toFixed(1)} ${(row * 24 + 13).toFixed(1)})`}>
                <circle r={10} fill={bg} stroke={i === leader ? '#1E3A8A' : 'rgba(15,23,42,.5)'} strokeWidth={i === leader ? 2.2 : 1} />
                <text textAnchor="middle" dy="4" fontSize={11} fontWeight={600} fill={fg}>{h.pp}</text>
              </g>)
          })}
        </svg>
      )}

      <div className="simlist">
        {mode === 'run' && <button className="ghost small" onClick={() => setSeed(s => s + 1)}>Run it again</button>}
        <ol>
          {order.map((i, k) => {
            const h = scored[i].horse; const [bg, fg] = CLOTH[h.pp] ?? ['#888', '#fff']
            return (
              <li key={h.pp}>
                <span className="rk">{k + 1}</span>
                <span className="cloth sm" style={{ background: bg, color: fg }}>{h.pp}</span>
                <span className="sname2">{h.name}{h.style && <em className="sty" title={STYLE_NAME[h.style]}>{h.style}</em>}</span>
                <span className="gap">{call.run === 0 ? '' : fmtL(rel[i])}</span>
                <span className="swin">{(summary.win[i] * 100).toFixed(summary.win[i] >= 0.1 ? 0 : 1)}%</span>
              </li>)
          })}
        </ol>
        <p className="note">The last column is each horse's win chance across {summary.runs.length.toLocaleString()} simulated runs. Lengths are behind the leader at this point.</p>
      </div>
      <p className="note">Built from each horse's recent early-position and late-gain tendencies, its model rating and the pace matchup. It is a pace scenario on a generic one-mile oval, not a prediction of exact trips.</p>
    </section>
  )
}
