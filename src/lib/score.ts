import type { Factor, Horse, Weights } from './types'
import { paceScores } from './pace'

export const FACTORS: Factor[] = ['speed', 'class', 'distance', 'connections', 'equipment', 'workouts', 'pace']
export const FACTOR_LABEL: Record<Factor, string> = {
  speed: 'Speed figures', class: 'Class', distance: 'Distance fit',
  connections: 'Jockey / trainer', equipment: 'Equipment', workouts: 'Workouts', pace: 'Pace fit',
}

function zscores(vals: (number | null)[]): number[] {
  const xs = vals.filter((v): v is number => v !== null)
  if (xs.length < 2) return vals.map(() => 0)
  const m = xs.reduce((a, b) => a + b, 0) / xs.length
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length) || 1
  return vals.map(v => (v === null ? 0 : (v - m) / sd))
}

export interface Scored { horse: Horse; score: number; prob: number; z: Record<Factor, number>; mlProb: number | null }

export function mlToProb(ml: string | null): number | null {
  if (!ml) return null
  const m = ml.match(/^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/)
  if (!m) return null
  return 1 / (1 + Number(m[1]) / Number(m[2]))
}

export function scoreRace(horses: Horse[], w: Weights, temp: number): Scored[] {
  const z = {} as Record<Factor, number[]>
  const pace = paceScores(horses.map(h => h.style)).scores
  for (const f of FACTORS) z[f] = zscores(f === 'pace' ? pace : horses.map(h => h.features[f] ?? null))
  const wt = (f: Factor) => w[f] ?? 0
  // Workouts count most when a horse has little race history (workoutsRel: 1, 0.5 or 0.25).
  const raw = horses.map((h, i) => FACTORS.reduce((s, f) => s + wt(f) * z[f][i] * (f === 'workouts' ? h.workoutsRel : 1), 0))
  const ex = raw.map(s => Math.exp(s / temp))
  const tot = ex.reduce((a, b) => a + b, 0)
  const mlRaw = horses.map(h => mlToProb(h.ml))
  const mlTot = mlRaw.reduce<number>((a, b) => a + (b ?? 0), 0)
  return horses.map((horse, i) => ({
    horse, score: raw[i], prob: ex[i] / tot,
    z: Object.fromEntries(FACTORS.map(f => [f, z[f][i]])) as Record<Factor, number>,
    mlProb: mlRaw[i] === null || mlTot === 0 ? null : (mlRaw[i] as number) / mlTot,
  }))
}

// Overall ability for the simulation: the weighted factors without pace (pace is simulated instead of scored).
export function ability(s: Scored, w: Weights): number {
  let num = 0, den = 0
  for (const f of FACTORS) {
    if (f === 'pace') continue
    const wf = w[f] ?? 0
    num += wf * s.z[f] * (f === 'workouts' ? s.horse.workoutsRel : 1)
    den += wf
  }
  return den ? num / den : 0
}

// Plackett-Luce: probability of an exact finishing order from per-horse win probabilities.
export function topCombos(probs: number[], k: number, limit: number) {
  const n = probs.length
  const out: { idx: number[]; p: number }[] = []
  const used = new Array<boolean>(n).fill(false)
  const path: number[] = []
  const rec = (p: number, rem: number) => {
    if (path.length === k) { out.push({ idx: [...path], p }); return }
    for (let i = 0; i < n; i++) {
      if (used[i]) continue
      used[i] = true; path.push(i)
      rec(p * probs[i] / rem, rem - probs[i])
      path.pop(); used[i] = false
    }
  }
  if (n >= k) rec(1, 1)
  return out.sort((a, b) => b.p - a.p).slice(0, limit)
}
