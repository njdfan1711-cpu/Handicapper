import fs from 'fs'
import { scoreRace, ability } from '../src/lib/score'
import { SIM, simulateMany } from '../src/lib/sim'
import type { CardsFile, Weights } from '../src/lib/types'
const data = JSON.parse(fs.readFileSync('src/data/cards.json', 'utf8')) as CardsFile
const results = JSON.parse(fs.readFileSync('tools/results.json', 'utf8')) as Record<string, Record<string, number[]>>
const norm = (w: Weights) => { const s = Object.values(w).reduce((a, b) => a + b, 0); return Object.fromEntries(Object.entries(w).map(([k, v]) => [k, v / s])) as Weights }
function evaluate(label: string, tweak: () => void, wOverride?: Partial<Weights>) {
  const saved = { ...SIM }; tweak()
  const w = norm({ ...data.weights, ...wOverride } as Weights)
  let n = 0, llM = 0, llS = 0, llMl = 0, llAvg = 0, hitS = 0, hitM = 0, hitMl = 0, top3S = 0, top3Ml = 0
  for (const card of data.cards) for (const race of card.races) {
    const order = results[card.id][String(race.n)]; if (!order?.length) continue
    const active = race.horses.filter(h => !race.scratched.includes(h.pp))
    const sc = scoreRace(active, w, data.temperature)
    const wi = active.findIndex(h => h.pp === order[0]); if (wi < 0) continue
    const known = active.map(h => h.earlyLen).filter((x): x is number => x !== null)
    const mean = known.length ? known.reduce((a, b) => a + b, 0) / known.length : 6
    const sim = simulateMany(sc.map(s => ({ ability: ability(s, w), earlyLen: s.horse.earlyLen ?? mean })), 3000, 99)
    const eps = 0.003, ps = sim.win.map(x => Math.max(x, eps)); const tS = ps.reduce((a, b) => a + b, 0)
    const pm = sc.map(s => s.prob), ml = sc.map(s => s.mlProb ?? 0)
    const avg = pm.map((p, i) => (p + ps[i] / tS) / 2)
    llM += -Math.log(pm[wi]); llS += -Math.log(ps[wi] / tS); llMl += -Math.log(Math.max(ml[wi], 1e-6)); llAvg += -Math.log(avg[wi]); n++
    const rank = (arr: number[]) => arr.map((_, i) => i).sort((a, b) => arr[b] - arr[a]).indexOf(wi) + 1
    hitS += rank(sim.win) === 1 ? 1 : 0; hitM += rank(pm) === 1 ? 1 : 0; hitMl += rank(ml) === 1 ? 1 : 0
    top3S += rank(sim.win) <= 3 ? 1 : 0; top3Ml += rank(ml) <= 3 ? 1 : 0
  }
  console.log(`${label.padEnd(34)} n=${n} | log-loss: model ${(llM / n).toFixed(3)} sim ${(llS / n).toFixed(3)} ML ${(llMl / n).toFixed(3)} avg(model,sim) ${(llAvg / n).toFixed(3)} | top pick wins: model ${hitM} sim ${hitS} ML ${hitMl} | in top 3: sim ${top3S} ML ${top3Ml}`)
  Object.assign(SIM, saved)
}
evaluate('default sim', () => {})
evaluate('no pace effects (ability only)', () => { SIM.fade = 0; SIM.gain = 0; SIM.lone = 0 })
evaluate('stronger pace effects', () => { SIM.fade = 1.8; SIM.gain = 1.4; SIM.lone = 2.4 })
evaluate('less noise (3 lengths)', () => { SIM.noiseFinal = 3 })
evaluate('speed-heavy ability', () => {}, { speed: 0.6, class: 0.1, distance: 0.0, connections: 0.3, equipment: 0, workouts: 0, pace: 0 } as Partial<Weights>)
