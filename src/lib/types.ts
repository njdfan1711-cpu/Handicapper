export type Factor = 'speed' | 'class' | 'distance' | 'connections' | 'equipment' | 'workouts'
export type Weights = Record<Factor, number>
export interface PP { date: string; track: string; dist: string; cls: string; rr: number | null; spd: number | null; fin: number | null; eq: string }
export interface Work { date: string; f: number; trk: string; time: string; rank: number; of: number }
export interface Horse {
  pp: number; name: string; ml: string | null; age: number | null; sex: string | null; weight: number | null
  jockey: string | null; jWin: number | null; trainer: string | null; tWin: number | null; sire: string | null
  features: Record<Factor, number | null>; lowConf: string[]; pps: PP[]; works: Work[]
}
export interface Race { n: number; title: string; grade: string | null; distSurface: string; cr: number; par: string; purse: string | null; horses: Horse[] }
export interface Card { meta: { track: string; date: string; source: string }; weights: Weights; temperature: number; races: Race[] }
