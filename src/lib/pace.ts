import type { Style } from './types'
export type Scenario = 'lone' | 'honest' | 'contested'
const TABLE: Record<Scenario, Record<Style, number>> = {
  lone: { E: 1.0, 'E/P': 0.5, P: 0.0, S: -0.5 },
  honest: { E: -0.1, 'E/P': 0.1, P: 0.3, S: 0.1 },
  contested: { E: -1.0, 'E/P': -0.5, P: 0.4, S: 0.8 },
}
export function paceScenario(styles: (Style | null)[]): { scenario: Scenario; n: number; leaders: number } {
  const n = styles.reduce<number>((s, x) => s + (x === 'E' ? 1 : x === 'E/P' ? 0.5 : 0), 0)
  const leaders = styles.filter(x => x === 'E').length
  return { scenario: n <= 1.5 ? 'lone' : n < 3 ? 'honest' : 'contested', n, leaders }
}
export function paceScores(styles: (Style | null)[]) {
  const { scenario } = paceScenario(styles)
  return { scenario, scores: styles.map(s => (s === null ? null : TABLE[scenario][s])) }
}
export function scenarioText(styles: (Style | null)[]) {
  const { scenario, leaders } = paceScenario(styles)
  if (scenario === 'contested') return `Contested pace: ${leaders} horses like the lead, so closers get a boost.`
  if (scenario === 'lone') return leaders === 0 ? 'No clear speed: whoever goes to the front should get an easy lead.' : 'Lone speed: one horse should get an easy lead.'
  return 'Honest pace: a normal early pace with no big edge for any style.'
}
export const STYLE_NAME: Record<Style, string> = { E: 'Early speed', 'E/P': 'Early to mid-pack', P: 'Mid-pack presser', S: 'Closer' }
