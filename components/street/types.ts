export type StreetFeature = {
  id: number; kind: string; name: string; points: number[][]; center: number[]; buildingType?: string;
  homeIndex?: number; transformer?: string; side?: 'east' | 'west'; streetX?: number;
};
export type StreetTransformer = {id: string; street: string; pole: number[]; homes: number[]};
export type StreetMap = {
  center: number[]; bounds: number[]; features: StreetFeature[]; transformers: StreetTransformer[];
  place: string; source: string; retrieved: string; license: string;
};

export type Medical = {need: string; resident: string; backup_kwh: number; essential_kw: number};
export type ModelHome = {index: number; id: string; transformer: string; thermostat: boolean; ev: boolean; battery: boolean; medical: Medical | null; away: boolean};
export type Pair<T> = {without: T; with: T};
export type HomeSeries = {
  t_in: Pair<number[]>; load: Pair<number[]>; mode: string;
  ev?: Pair<number[]>; battery?: number[]; soc?: number[]; share?: number[];
};
export type TransformerSeries = {without: number[]; with: number[]; before_share: number[]};
export type Scenario = {
  peak_temp_f: number; outdoor_f: number[]; at_risk: string[]; ease: Record<string, number>;
  transformers: Record<string, TransformerSeries>; homes: HomeSeries[]; energy_kwh: Pair<number>;
  failure: Record<string, number | null>;
  share?: {transformer: string; suppliers: number[]; recipient: number; start: number; end: number; kwh: number; credit_usd: number};
  summary?: {transformer: string; peak_without: number; peak_with: number; medical_adjusted: number; homes: number; kept_power_with: number; kept_power_without: number};
};
export type Model = {
  seed: number; hours: number[]; chart_end: number; base_rate: number; disclaimer: string;
  transformers: {id: string; street: string; homes: number[]; rating_kva: number}[];
  homes: ModelHome[];
  settings: {normal_f: number; precool_f: number; ev_later: number; share: {start: number; end: number; kw_each: number}};
  scenarios: Record<string, Scenario>;
};
