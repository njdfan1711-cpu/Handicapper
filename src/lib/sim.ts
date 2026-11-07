// Pace-scenario simulation. Each run draws early speed and finishing ability with noise, applies pace pressure
// (speed duels hurt front-runners and help closers; a lone leader gets an easy lead), and returns lengths behind
// the leader at the first call and at the finish. Positions in between are interpolated.
export interface SimHorse { ability: number; earlyLen: number }
export const SIM = { lengthsPerAbility: 4, noiseFinal: 4, noiseEarly: 1.6, duel: 2, fade: 0.9, gain: 0.7, lone: 1.2, nSims: 1500 }
export const LENGTH_F = 8.33 / 660  // one length in furlongs

export function mulberry32(seed: number) {
  let a = seed | 0
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(Math.max(r(), 1e-12))) * Math.cos(2 * Math.PI * r())

export interface SimRun { L1: number[]; F: number[] }
export function runOnce(h: SimHorse[], rng: () => number): SimRun {
  const early = h.map(x => -x.earlyLen + gauss(rng) * SIM.noiseEarly)
  const mx = Math.max(...early)
  const L1 = early.map(e => Math.max(0, mx - e))
  const near = L1.filter(l => l <= SIM.duel).length
  const pressure = Math.min(4, Math.max(0, near - 1))
  const M = h.map((x, i) => {
    let adj = 0
    if (pressure > 0) adj = pressure * SIM.gain * Math.min(L1[i] / 8, 1) - pressure * SIM.fade * Math.exp(-L1[i] / 2.5)
    else if (L1[i] === 0) adj = SIM.lone
    return x.ability * SIM.lengthsPerAbility + adj + gauss(rng) * SIM.noiseFinal
  })
  const best = Math.max(...M)
  return { L1, F: M.map(m => best - m) }
}

export function simulateMany(h: SimHorse[], n = SIM.nSims, seed = 20260101) {
  const rng = mulberry32(seed)
  const runs: SimRun[] = []
  const win = new Array<number>(h.length).fill(0)
  const avgFinish = new Array<number>(h.length).fill(0)
  for (let s = 0; s < n; s++) {
    const r = runOnce(h, rng); runs.push(r)
    const order = r.F.map((f, i) => [f, i]).sort((a, b) => a[0] - b[0]).map(x => x[1])
    win[order[0]]++
    order.forEach((idx, pos) => { avgFinish[idx] += pos + 1 })
  }
  return { runs, win: win.map(w => w / n), avgFinish: avgFinish.map(a => a / n) }
}

export function behindAt(f: number, f1: number, L1: number, F: number) {
  if (f <= f1) return L1 * Math.pow(Math.max(f, 0) / f1, 0.8)
  const t = Math.min(1, (f - f1) / (1 - f1))
  return L1 + (F - L1) * t * t * (3 - 2 * t)
}
export function relBehind(f: number, f1: number, run: SimRun) {
  const b = run.L1.map((L, i) => behindAt(f, f1, L, run.F[i]))
  const m = Math.min(...b)
  return b.map(x => x - m)
}
export function avgRelBehind(f: number, f1: number, runs: SimRun[], cap = 600) {
  const use = runs.slice(0, cap); const acc = new Array<number>(use[0].L1.length).fill(0)
  for (const r of use) relBehind(f, f1, r).forEach((x, i) => { acc[i] += x })
  const avg = acc.map(a => a / use.length)
  const m = Math.min(...avg)
  return avg.map(x => x - m)   // re-center so the horse expected to be in front shows as the leader
}
