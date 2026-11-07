export type Factor = 'speed' | 'class' | 'distance' | 'connections' | 'equipment' | 'workouts' | 'pace'
export type Weights = Record<Factor, number>
export type Style = 'E' | 'E/P' | 'P' | 'S'
export interface PP { date: string; track: string; dist: string; cls: string; rr: number | null; spd: number | null; fin: number | null; eq: string }
export interface Work { date: string; f: number; trk: string; time: string; rank: number; of: number }
export interface Horse {
  pp: number; name: string; ml: string | null; age: number | null; sex: string | null; weight: number | null
  jockey: string | null; jWin: number | null; trainer: string | null; tWin: number | null; sire: string | null
  features: Partial<Record<Factor, number | null>>; workoutsRel: number; lowConf: string[]
  style: Style | null; earlyLen: number | null; lateGain: number | null; paceRuns: number
  pps: PP[]; works: Work[]
}
export interface Race {
  n: number; title: string; grade: string | null; distSurface: string; distF: number; surface: 'turf' | 'dirt'
  cr: number; par: string; purse: string | null; scratched: number[]; horses: Horse[]
}
export interface CardData { id: string; meta: { track: string; date: string; source: string }; races: Race[] }
export interface CardsFile { weights: Weights; temperature: number; cards: CardData[] }
