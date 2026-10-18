import type {Model, Scenario} from './types';

export type Mode = 'with' | 'without';
export type Beat = {key: string; caption: string; seconds: number; from: number; to: number; dayBefore?: boolean; split?: boolean};

// Six beats, about 75 seconds. Each has one caption of 12 words or fewer.
export const HEAT_BEATS: Beat[] = [
  {key: 'forecast', caption: 'Tomorrow, Transformer B overloads at 6 PM.', seconds: 10, from: 12, to: 12, dayBefore: true},
  {key: 'street', caption: 'Only these 10 homes. The medical home is never touched.', seconds: 11, from: 12, to: 12.75},
  {key: 'precool', caption: 'Cool homes early, while the transformer has room.', seconds: 14, from: 12.75, to: 16.75},
  {key: 'easeoff', caption: 'Homes warm 2–3°F. EVs wait until 10 PM.', seconds: 13, from: 16.75, to: 17.95},
  {key: 'share', caption: "Spare battery power relieves the street and the medical home's bill.", seconds: 13, from: 17.95, to: 19.25},
  {key: 'result', caption: 'Same street. Same heat. The lights stay on.', seconds: 14, from: 17.9, to: 19.75, split: true},
];

export const START = 12;
export const END = 22;
export const COIN_LANDS = 18.08; // the share's credit lands on the medical home's roof

export type View = {
  scenario: string;
  time: number;
  mode: Mode;
  beat: string | null;   // current storyboard beat, or null when exploring freely
  split: number | null;  // 0-1 position of the with/without divider, or null
  focus: string | null;  // transformer the story is about
  selectedHome: number | null;
};

export function sample(series: number[], hours: number[], time: number) {
  const step = hours[1] - hours[0];
  const position = Math.max(0, Math.min(series.length - 1, (time - hours[0]) / step));
  const i = Math.min(Math.floor(position), series.length - 2);
  return series[i] + (series[i + 1] - series[i]) * (position - i);
}

export function stepAt(hours: number[], time: number) {
  const step = hours[1] - hours[0];
  return Math.max(0, Math.min(hours.length - 1, Math.floor((time - hours[0]) / step + 1e-6)));
}

export function clock(time: number) {
  const minutes = Math.round(time * 60) % (24 * 60);
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export function hourLabel(time: number) {
  const h = Math.round(time) % 24;
  return `${((h + 11) % 12) + 1} ${h < 12 ? 'AM' : 'PM'}`;
}

/** When a transformer has failed in this view (without OurGrid, past its failure time). */
export function failed(scenario: Scenario, transformer: string, mode: Mode, time: number) {
  const at = scenario.failure[transformer];
  return mode === 'without' && at !== null && at !== undefined && time >= at;
}

export function gaugeValue(model: Model, scenario: Scenario, transformer: string, mode: Mode, time: number, beat: string | null) {
  const series = scenario.transformers[transformer];
  if (failed(scenario, transformer, mode, time)) return 0;
  if (mode === 'without') return sample(series.without, model.hours, time);
  // During the share beat the gauge shows the level before sharing until the credit lands, then drops.
  if (beat === 'share' && time < COIN_LANDS) return sample(series.before_share, model.hours, time);
  return sample(series.with, model.hours, time);
}

export type Glow = 'cool' | 'warm' | null;
export type HomeState = {
  dark: boolean; glow: Glow; temp: number; ev: 'none' | 'moon' | 'charging'; battery: 'idle' | 'cover' | 'share';
  medical: boolean; credited: boolean;
};

export function homeState(model: Model, scenario: Scenario, index: number, mode: Mode, time: number): HomeState {
  const home = model.homes[index];
  const series = scenario.homes[index];
  const k = stepAt(model.hours, time);
  const dark = failed(scenario, home.transformer, mode, time);
  const flag = mode === 'with' ? series.mode[k] : 'n';
  const glow: Glow = dark ? null : flag === 'p' || flag === 'h' ? 'cool' : flag === 'e' ? 'warm' : null;
  let ev: HomeState['ev'] = 'none';
  if (series.ev) {
    const kw = series.ev[mode][k];
    const moved = mode === 'with' && series.ev.with.findIndex(v => v > 0) > series.ev.without.findIndex(v => v > 0);
    if (kw > 0 && !dark) ev = 'charging';
    else if (moved && time >= model.settings.share.start - 1 && time < model.settings.ev_later) ev = 'moon';
  }
  let battery: HomeState['battery'] = 'idle';
  if (mode === 'with' && series.battery && !dark) {
    if ((series.share?.[k] ?? 0) > 0) battery = 'share';
    else if (series.battery[k] > 0) battery = 'cover';
  }
  const share = scenario.share;
  const credited = mode === 'with' && !!share && share.recipient === index && time >= COIN_LANDS;
  return {dark, glow, temp: sample(series.t_in[mode], model.hours, time), ev, battery, medical: !!home.medical, credited};
}
