// Illustrative scoring and story timeline, computed in the browser from public/care-la.json.
export type Device = {label: string; watts: number; criticality: number};
export type Patient = {
  id: string; home: number; street: string; risk: number; group: string; age: number; device: string;
  backup_wh: number; backup: 'charged' | 'unconfirmed' | 'uncharged' | 'old' | 'none'; responds: boolean;
  delivery?: number; swap?: number; ladder?: 'swap' | 'cylinders' | 'move';
};
export type Care = {
  place: string; utility: string; disclaimer: string; devices: Record<string, Device>; streets: Record<string, number>;
  outage: {street: string; start: number}; patients: Patient[]; ordinary: {warnings: {id: string; note: string}[]};
  scoring: {efficiency: number; unconfirmed: number; tiers: {red_hours: number; green_hours: number; red_risk: number}; floor_hours: number};
};
export type Mode = 'with' | 'without';
export type Tier = 'red' | 'amber' | 'green';

// Time is hours from midnight on the day before the heat wave.
export const DAY_BEFORE = 16;           // 4 PM, the forecast
export const CYLINDER_HOURS = 12;        // oxygen tanks need no electricity
export const OLD_FACTOR = 0.4;           // a three-year-old battery holds about 40%
export const outageEnd = (care: Care) => care.outage.start + 12;

export type Beat = {key: string; caption: string; seconds: number; from: number; to: number; split?: boolean};
export const HEAT_BEATS: Beat[] = [
  {key: 'forecast', caption: "Tomorrow's heat will knock out power on some streets.", seconds: 9, from: 16, to: 16},
  {key: 'rank', caption: 'Every older patient, ranked by hours of safe power left.', seconds: 9, from: 16, to: 16.4},
  {key: 'checkin', caption: 'Automated check-ins reach the riskiest homes first.', seconds: 11, from: 16.4, to: 18.9},
  {key: 'escalate', caption: 'No reply? A real person calls within two hours.', seconds: 9, from: 18.9, to: 20.9},
  {key: 'backup', caption: 'Charged batteries delivered before the peak, not after.', seconds: 11, from: 32.3, to: 35.6},
  {key: 'outage', caption: 'The outage hits. Every countdown starts.', seconds: 7, from: 42.0, to: 42.6},
  {key: 'ladder', caption: '', seconds: 22, from: 42.6, to: 48.2},
  {key: 'result', caption: 'Same street. Same outage. Help arrived in the right order.', seconds: 12, from: 48.2, to: 54.15, split: true},
];
export const LADDER = [
  {key: 'swap', label: '50% left', action: 'Swap the battery', caption: 'Half battery left? We swap it.'},
  {key: 'cylinders', label: '~2 h left', action: 'Oxygen tanks arrive', caption: 'Two hours left? Oxygen tanks that need no power.'},
  {key: 'move', label: '~1 h left', action: 'Move to a cooling center', caption: 'One hour left? We move them somewhere with power.'},
  {key: '911', label: 'Last resort', action: 'Call 911', caption: '911 is the last step, not the first.'},
];

const watts = (care: Care, p: Patient) => care.devices[p.device].watts;
export const hoursFor = (care: Care, p: Patient, wh: number) => wh * care.scoring.efficiency / watts(care, p);

/** When each patient's events happen in the world with OurGrid. */
export type Timeline = {
  rankOrder: string[]; checkin: Record<string, number>; reply: Record<string, number>; call: Record<string, number>; reached: Record<string, number>;
  arrive: Record<string, number>; ladder: Record<string, number>; trips: Trip[];
};
export type Trip = {vehicle: 'van' | 'oxygen' | 'car'; from: {home?: number; place?: 'depot' | 'cooling'}; to: {home?: number; place?: 'depot' | 'cooling'}; depart: number; arrive: number};

export function initialHours(care: Care, p: Patient) {
  const factor = {charged: 1, unconfirmed: care.scoring.unconfirmed, uncharged: 0, none: 0, old: OLD_FACTOR}[p.backup];
  return hoursFor(care, p, p.backup_wh) * factor;
}

export function tierOf(care: Care, p: Patient, hours: number): Tier {
  const t = care.scoring.tiers;
  if (hours < t.red_hours && p.risk >= t.red_risk) return 'red';
  return hours >= t.green_hours ? 'green' : 'amber';
}

export function priority(care: Care, p: Patient, hours: number) {
  return p.risk * care.devices[p.device].criticality / Math.max(hours, care.scoring.floor_hours);
}

export function timeline(care: Care): Timeline {
  const ranked = [...care.patients].sort((a, b) => priority(care, b, initialHours(care, b)) - priority(care, a, initialHours(care, a)));
  const t: Timeline = {rankOrder: ranked.map(p => p.id), checkin: {}, reply: {}, call: {}, reached: {}, arrive: {}, ladder: {}, trips: []};
  // Check-ins go out to Tier 1 and 2 in priority order; replies come back within the hour.
  ranked.filter(p => tierOf(care, p, initialHours(care, p)) !== 'green').forEach((p, i) => {
    t.checkin[p.id] = 16.6 + i * 0.13;
    if (p.responds) t.reply[p.id] = t.checkin[p.id] + 0.45 + (i % 3) * 0.2;
  });
  // Non-responders: a care coordinator calls within two hours of the check-in.
  care.patients.filter(p => !p.responds).forEach((p, i) => {t.call[p.id] = 19.2 + i * 0.5; t.reached[p.id] = t.call[p.id] + 0.45;});
  // Next morning: one van delivers charged batteries and swaps the old one, in priority order.
  let clock = 32.5, at: Trip['from'] = {place: 'depot'};
  for (const p of ranked.filter(p => p.delivery || p.swap)) {
    t.trips.push({vehicle: 'van', from: at, to: {home: p.home}, depart: clock, arrive: clock + 0.55});
    t.arrive[p.id] = clock + 0.55;
    clock += 0.8;
    at = {home: p.home};
  }
  t.trips.push({vehicle: 'van', from: at, to: {place: 'depot'}, depart: clock, arrive: clock + 0.5});
  // During the outage: swap at 50%, oxygen tanks at ~2 h left, move at ~1 h left.
  const start = care.outage.start;
  for (const p of care.patients) {
    if (!p.ladder) continue;
    const hours = protectedHours(care, p);
    const when = p.ladder === 'swap' ? start + hours / 2 : p.ladder === 'cylinders' ? start + hours - 2 : start + hours - 1;
    t.ladder[p.id] = when;
    if (p.ladder === 'move') t.trips.push({vehicle: 'car', from: {home: p.home}, to: {place: 'cooling'}, depart: when, arrive: when + 0.45});
    else t.trips.push({vehicle: p.ladder === 'cylinders' ? 'oxygen' : 'van', from: {place: 'depot'}, to: {home: p.home}, depart: when - 0.5, arrive: when});
  }
  return t;
}

/** Backup hours once OurGrid has confirmed, charged and delivered (before the outage). */
export function protectedHours(care: Care, p: Patient) {
  if (p.swap) return hoursFor(care, p, p.swap);
  const own = p.backup === 'none' ? 0 : p.backup_wh;
  return hoursFor(care, p, own + (p.delivery ?? 0));
}

/** Backup hours that actually exist without OurGrid (nobody checks, charges or delivers). */
export function unprotectedHours(care: Care, p: Patient) {
  if (p.backup === 'none' || p.backup === 'uncharged' || (!p.responds && p.backup === 'unconfirmed' && p.group === 'outage')) return 0;
  return hoursFor(care, p, p.backup_wh) * (p.backup === 'old' ? OLD_FACTOR : 1);
}

export type Status = 'none' | 'sent' | 'confirmed' | 'flagged' | 'calling' | 'delivered' | 'tanks' | 'moved' | 'swapped' | 'ambulance' | 'alert' | 'checking' | 'warning' | 'scheduled';
export type PatientState = {hours: number; tier: Tier; status: Status; countdown: number | null; full: number; dark: boolean; moved: boolean; note?: string};

export function patientState(care: Care, t: Timeline, p: Patient, mode: Mode, time: number): PatientState {
  const start = care.outage.start;
  const onOutage = p.street === care.outage.street;
  const dark = onOutage && time >= start;
  if (mode === 'without') {
    const hours = time < start ? initialHours(care, p) : unprotectedHours(care, p);
    const left = onOutage && time >= start ? Math.max(0, hours - (time - start)) : null;
    const status: Status = left === 0 ? 'ambulance' : time >= DAY_BEFORE + 0.2 && time < start ? 'alert' : 'none';
    return {hours, tier: tierOf(care, p, hours), status, countdown: left, full: hours, dark, moved: false};
  }
  // Before the outage: what OurGrid knows and has done so far.
  const confirmed = (t.reply[p.id] ?? Infinity) <= time || (t.reached[p.id] ?? Infinity) <= time;
  const arrived = (t.arrive[p.id] ?? Infinity) <= time;
  let wh = p.backup === 'none' ? 0 : p.backup_wh;
  let factor = {charged: 1, unconfirmed: care.scoring.unconfirmed, uncharged: 0, none: 0, old: OLD_FACTOR}[p.backup];
  if (confirmed && (p.backup === 'unconfirmed' || p.backup === 'charged')) factor = 1;
  let hours = hoursFor(care, p, wh) * factor;
  if (arrived) hours = protectedHours(care, p);
  let status: Status = 'none';
  if (t.checkin[p.id] !== undefined && time >= t.checkin[p.id]) status = 'sent';
  if (t.call[p.id] !== undefined && time >= t.call[p.id]) status = 'calling';
  if (confirmed) status = (p.delivery || p.swap) ? 'flagged' : 'confirmed';
  if (arrived) status = p.swap ? 'swapped' : 'delivered';
  if (time < start || !onOutage) return {hours, tier: tierOf(care, p, hours), status, countdown: null, full: hours, dark, moved: false};
  // During the outage: the countdown and the escalation ladder.
  const full = protectedHours(care, p);
  let left = full - (time - start);
  const step = t.ladder[p.id];
  let moved = false;
  if (step !== undefined && time >= step) {
    if (p.ladder === 'swap') {left = full * 2 - (time - step); status = 'swapped';}
    if (p.ladder === 'cylinders') {left = left + CYLINDER_HOURS; status = 'tanks';}
    if (p.ladder === 'move') {moved = time >= step + 0.45; status = 'moved';}
  }
  left = Math.max(0, left);
  return {hours: left, tier: tierOf(care, p, left), status, countdown: moved ? null : left, full: step !== undefined && time >= step && p.ladder !== 'move' ? Math.max(full, left) : full, dark, moved};
}

export function ladderLit(t: Timeline, care: Care, time: number) {
  return LADDER.map(step => step.key !== '911' && Object.entries(t.ladder).some(([id, at]) => care.patients.find(p => p.id === id)?.ladder === step.key && time >= at));
}

export function numbers(care: Care) {
  const tier1 = care.patients.filter(p => tierOf(care, p, initialHours(care, p)) === 'red');
  const chargedBefore = tier1.filter(p => p.backup === 'charged' || p.backup === 'unconfirmed').length;
  const silent = care.patients.filter(p => !p.responds).length;
  const calls = care.patients.filter(p => p.street === care.outage.street && unprotectedHours(care, p) < 12).length;
  return {
    charged: {before: Math.round(chargedBefore / tier1.length * 100), after: 100},
    reached: {count: silent, of: silent},
    calls911: {without: calls, with: 0},
  };
}

export function clockLabel(care: Care, time: number, scenario = 'heat') {
  const day = scenario === 'ordinary' ? 'Ordinary day' : time < 24 ? 'Day before' : 'Heat day';
  const minutes = Math.round((time % 24) * 60);
  const h = Math.floor(minutes / 60) % 24, m = minutes % 60;
  const text = `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  const since = time - care.outage.start;
  return {day, time: text, outage: since >= 0 && scenario === 'heat' ? `Outage +${Math.floor(since)} h ${String(Math.round((since % 1) * 60)).padStart(2, '0')} m` : null};
}

export function temperature(time: number) {
  const hour = time % 24;
  const peak = time < 24 ? 96 : 106;
  const t = hour <= 16 ? peak - 0.5 * (16 - hour) ** 2 : peak - 0.8 * (hour - 16) ** 1.5;
  return Math.round(Math.max(72, t));
}

// Ordinary day: no heat warning. A sweep checks every backup and schedules replacements.
export const ORDINARY_BEATS: Beat[] = [
  {key: 'sweep', caption: 'On ordinary days, OurGrid finds dead batteries before an emergency does.', seconds: 11, from: 34, to: 35},
  {key: 'scheduled', caption: 'Replacements scheduled. Every emergency plan is up to date.', seconds: 9, from: 35, to: 35.6},
];

export function ordinaryState(care: Care, p: Patient, time: number): PatientState {
  const order = [...care.patients].sort((a, b) => a.home - b.home).findIndex(q => q.id === p.id);
  const checked = time >= 34.05 + order * 0.045;
  const warning = care.ordinary.warnings.find(w => w.id === p.id);
  const full = hoursFor(care, p, p.backup === 'none' ? 0 : p.backup_wh);
  const hours = warning ? full * (warning.note.includes('years') ? OLD_FACTOR : 0) : full;
  const status: Status = !checked ? 'none' : warning ? (time >= 35.1 + care.ordinary.warnings.indexOf(warning) * 0.08 ? 'scheduled' : 'warning') : 'confirmed';
  return {hours, tier: warning && checked ? 'red' : hours >= 12 ? 'green' : 'amber', status, countdown: null, full, dark: false, moved: false, note: warning?.note};
}
