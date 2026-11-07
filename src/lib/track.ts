// A one-mile oval measured in furlongs, run counterclockwise. t is the distance along the oval from the finish wire.
export const C = 8
export const PX = 110            // pixels per furlong
export const R = 70              // centerline turn radius in pixels
export const HALF = 110          // half the straight length in pixels
export const BAND = 80           // track width in pixels
const WIRE_X = HALF - 0.25 * PX  // the wire sits 1.75 furlongs into the stretch

export function pathPoint(tIn: number, off: number) {
  const t = ((tIn % C) + C) % C
  const r = R + off
  if (t < 0.25) return { x: WIRE_X + t * PX, y: r }
  if (t < 2.25) { const th = Math.PI / 2 - ((t - 0.25) / 2) * Math.PI; return { x: HALF + r * Math.cos(th), y: r * Math.sin(th) } }
  if (t < 4.25) return { x: HALF - (t - 2.25) * PX, y: -r }
  if (t < 6.25) { const th = -Math.PI / 2 - ((t - 4.25) / 2) * Math.PI; return { x: -HALF + r * Math.cos(th), y: r * Math.sin(th) } }
  return { x: -HALF + (t - 6.25) * PX, y: r }
}
export const tStartFor = (distF: number) => ((-distF % C) + C) % C

export interface Call { key: string; label: string; run: number }
const DEFS = [
  { k: 'wire', l: 'Under the wire', off: 8 }, { k: 'turn1', l: 'First turn', off: 6.75 }, { k: 'back', l: 'Backstretch', off: 4.75 },
  { k: 'turn2', l: 'Far turn', off: 2.75 }, { k: 'q', l: 'Quarter pole', off: 2 }, { k: 'str', l: 'Stretch', off: 1 },
]
export function callsFor(D: number): Call[] {
  const tmp: Call[] = []
  for (const d of DEFS) {
    const hits: number[] = []
    for (let k = 0; ; k++) { const run = D - d.off - C * k; if (run < 0.4) break; hits.push(run) }
    hits.sort((a, b) => a - b).forEach((run, i) => tmp.push({ key: `${d.k}${i}`, label: hits.length > 1 ? `${d.l} (${['1st', '2nd', '3rd'][i]})` : d.l, run }))
  }
  tmp.sort((a, b) => a.run - b.run)
  return [{ key: 'start', label: 'Start', run: 0 }, ...tmp, { key: 'fin', label: 'Finish', run: D }]
}

export function loopPath(off: number) {
  const r = R + off
  return `M ${-HALF} ${r} L ${HALF} ${r} A ${r} ${r} 0 0 0 ${HALF} ${-r} L ${-HALF} ${-r} A ${r} ${r} 0 0 0 ${-HALF} ${r} Z`
}
