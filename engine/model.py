"""OurGrid: illustrative heat-wave model for one Burbank block (writes public/scenarios.json).

Every number here is illustrative. Homes, devices, temperatures and transformer ratings
are fictional; only the building footprints are real (OpenStreetMap). The rules:

- AC power grows with how far the outdoor temperature (plus late-afternoon west sun)
  is above the thermostat setpoint. Commuters' homes sit at 82°F until they get home,
  then the AC works harder for a while to pull the house back down to 76°F.
- Easing off cuts a share r of a home's AC power from 5 to 8 PM. That energy is paid
  back, with a 10% penalty, as extra AC from 1 to 5 PM (more where the transformer has
  room): pre-cooling. Total energy rises
  slightly; only the peak moves. Indoor temperature follows 76 -> 73°F (1-4 PM), holds,
  then drifts back to 76°F by 8 PM.
- On an at-risk transformer, batteries cover their own homes from 5 to 8 PM and two of
  them share 0.75 kW each from 6 to 7 PM; EV charging moves to 10 PM.
- The planner picks the smallest r that keeps the transformer at or below 94%.
- Medical homes are never adjusted. Transformer ratings are set so the heat-wave
  forecast peaks at the illustrative values in TARGET_PEAK.

    python3 engine/model.py
"""
import json
import math
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SEED = 42
STEP = 0.25                                   # hours
HOURS = [12 + i * STEP for i in range(61)]   # 12 PM to 3 AM, so shifted EV charging is counted
CHART_END = 40                                # index of 10 PM; the chart shows 12 PM to 10 PM
BASE_RATE = 0.16                              # demo base rate, $/kWh (not a real tariff)
NORMAL_F, PRECOOL_F, AWAY_F, MEDICAL_F = 76.0, 73.0, 82.0, 75.0
PRECOOL, HOLD, EASE = (13.0, 16.0), (16.0, 17.0), (17.0, 20.0)
PAYBACK = 1.10                                # kWh of pre-cooling per kWh of AC avoided later
MAX_EASE = 0.85
EV_KW, EV_LATER = 3.8, 22.0                   # a 16 A home charger; moved charging starts at 10 PM
BATTERY = dict(kwh=13.5, kw=5.0, reserve=0.2, efficiency=0.95)  # solar-charged by noon; backup mode without OurGrid
SHARE = dict(start=18.0, end=19.0, kw_each=0.75)
TARGET_PEAK = {'A': 0.93, 'B': 1.18, 'C': 0.95, 'D': 0.88}
TARGET_WITH = 0.94
FAILURE = dict(over=1.15, minutes=15)         # an overloaded transformer fails after 15 min above 115%
OUTAGE = dict(start=19.5, arrive=19.85, temp=98, ev_kwh=10.0, ev_kw=1.9)  # a neighbour's EV lends 10 kWh to one medical home
DISCLAIMER = 'Illustrative simulation. Real sharing requires a utility pilot.'


def outdoor(hour, peak):
    """Afternoon temperature curve that peaks at 4 PM."""
    if hour <= 16:
        return peak - 0.55 * (16 - hour) ** 2
    return peak - 0.9 * (hour - 16) ** 1.6


def west_sun(hour):
    """Extra effective heat (°F) from low western sun, strongest around 5 PM."""
    return 6.0 * max(0.0, math.sin(math.pi * (hour - 13) / 8)) if 13 <= hour <= 21 else 0.0


def evening(hour):
    return math.exp(-((hour - 18.5) / 1.7) ** 2)


def in_window(hour, window):
    return window[0] <= hour < window[1]


def make_homes(map_data):
    rng = random.Random(SEED)
    footprints = sorted((f for f in map_data['features'] if 'homeIndex' in f), key=lambda f: f['homeIndex'])
    homes, count = [], {}
    for f in footprints:
        t = f['transformer']
        count[t] = count.get(t, 0) + 1
        homes.append(dict(
            index=f['homeIndex'], id='%s-%02d' % (t, count[t]), transformer=t, side=f['side'],
            thermostat=rng.random() < 0.85, ev=rng.random() < 0.25, battery=rng.random() < 0.12, medical=None,
            away=rng.random() < 0.45, arrival=round(rng.uniform(16.75, 18.0) * 4) / 4,
            ac_kw=rng.uniform(2.6, 3.4), base_kw=rng.uniform(0.9, 1.3),
            ev_kwh=rng.uniform(9, 15), ev_plug=round(rng.uniform(17.5, 19.0) * 4) / 4,
        ))
    # Transformer B carries the story: a medical home, two battery neighbours, five commuters (two with EVs).
    b = [h for h in homes if h['transformer'] == 'B']
    west = sorted((h for h in b if h['side'] == 'west'), key=lambda h: h['index'])
    medical = west[len(west) // 2]
    others = sorted((h for h in b if h is not medical), key=lambda h: abs(h['index'] - medical['index']))
    for h in b:
        h.update(thermostat=True, battery=False, ev=False, away=False)
    medical.update(medical=dict(need='Oxygen concentrator', resident='Fictional older resident', backup_kwh=1.2, essential_kw=0.7))
    for h in others[:2]:
        h.update(battery=True, ac_kw=1.6, base_kw=0.7)           # newer, efficient homes with solar and a battery
    for h, arrival in zip(others[2:7], (17.0, 17.25, 17.5, 17.75, 18.0)):
        h.update(away=True, arrival=arrival)                     # commuters: AC set back to 82°F until they get home
    for h, plug in zip(others[2:4], (20.0, 20.25)):
        h.update(ev=True, ev_plug=plug)                          # two of them plug in an EV after dinner
    others[-1]['thermostat'] = False
    # Two more medical homes elsewhere on the block (used by the outage scenario).
    for tid, backup, battery in (('A', 3.0, False), ('C', 12.0, True)):
        h = next(h for h in homes if h['transformer'] == tid and not h['ev'])
        h.update(medical=dict(need='Medical device', resident='Fictional resident', backup_kwh=backup, essential_kw=0.6),
                 away=False, battery=battery)
    return homes


def baseline(home, peak):
    """Without OurGrid: indoor temperature, AC, base load and EV for every step."""
    rows = []
    for hour in HOURS:
        temp = outdoor(hour, peak) + west_sun(hour)
        home_now = not home['away'] or hour >= home['arrival']
        if home['medical']:
            setpoint, t_in = MEDICAL_F, MEDICAL_F
        elif not home_now:
            setpoint, t_in = AWAY_F, AWAY_F
        else:
            setpoint = NORMAL_F
            since = hour - home['arrival'] if home['away'] else 9
            t_in = max(NORMAL_F, AWAY_F - (AWAY_F - NORMAL_F) * since / 2)  # pulled back down over two hours
        heat = max(0.0, temp - NORMAL_F) / 30
        ac = home['ac_kw'] * max(0.0, temp - setpoint) / 30
        if home['away'] and hour >= home['arrival']:
            ac += home['ac_kw'] * 0.6 * heat * math.exp(-(hour - home['arrival']) / 1.2)  # pulling the house back down
        ac = min(ac, home['ac_kw'] * 1.5)
        base = home['base_kw'] * (0.5 + 0.7 * evening(hour)) if home_now else 0.3
        rows.append(dict(t_in=t_in, ac=ac, base=base, ev=0.0))
    if home['ev']:
        charge(rows, home['ev_kwh'], home['ev_plug'])
    return rows


def charge(rows, kwh, start):
    for row, hour in zip(rows, HOURS):
        row['ev'] = 0.0
        if kwh > 0 and hour >= start:
            row['ev'] = min(EV_KW, kwh / STEP)
            kwh -= row['ev'] * STEP


def managed(home, rows, r, battery, share_kw, ev_start, fill):
    """With OurGrid on an at-risk transformer: pre-cool and ease off, move the EV, run the battery.

    fill: weight per step for spreading the pre-cooling payback over 1-5 PM (more where the transformer has room).
    """
    rows = [dict(row) for row in rows]
    if r > 0 and home['thermostat'] and not home['medical']:
        saved = 0.0
        for row, hour in zip(rows, HOURS):
            if in_window(hour, EASE):
                saved += row['ac'] * r * STEP
                row['ac'] *= 1 - r
        payback = saved * PAYBACK
        start = rows[HOURS.index(PRECOOL[0])]['t_in']
        for k, (row, hour) in enumerate(zip(rows, HOURS)):
            if in_window(hour, PRECOOL):
                row['t_in'] = start + (PRECOOL_F - start) * (hour + STEP - PRECOOL[0]) / (PRECOOL[1] - PRECOOL[0])
                row['mode'] = 'p'
            elif in_window(hour, HOLD):
                row['t_in'], row['mode'] = PRECOOL_F, 'h'
            if k in fill:
                row['ac'] += payback * fill[k] / STEP
            elif in_window(hour, EASE):
                row['t_in'] = PRECOOL_F + (NORMAL_F - PRECOOL_F) * (hour - EASE[0]) / (EASE[1] - EASE[0])
                row['mode'] = 'e'
    if ev_start is not None:
        charge(rows, home['ev_kwh'], ev_start)
    soc = 1.0
    for row, hour in zip(rows, HOURS):
        row.setdefault('mode', 'n')
        load = row['ac'] + row['base'] + row['ev']
        row['battery'] = row['share'] = 0.0
        if battery and in_window(hour, EASE):
            above = (soc - BATTERY['reserve']) * BATTERY['kwh'] * BATTERY['efficiency']
            want = load + (share_kw if in_window(hour, (SHARE['start'], SHARE['end'])) else 0.0)
            row['battery'] = min(want, BATTERY['kw'], max(0.0, above) / STEP)
            row['share'] = max(0.0, row['battery'] - load)
            soc -= row['battery'] / BATTERY['efficiency'] * STEP / BATTERY['kwh']
        row['soc'] = soc
    return rows


def finish(rows):
    for row in rows:
        row.setdefault('mode', 'n')
        row.setdefault('battery', 0.0)
        row.setdefault('share', 0.0)
        row['load'] = row['ac'] + row['base'] + row['ev']
        row['grid'] = row['load'] - row['battery']
    return rows


def failure_time(series):
    """First time a transformer has been above FAILURE['over'] for FAILURE['minutes'], at 1-minute resolution."""
    run = 0
    for minute in range(int((HOURS[CHART_END] - HOURS[0]) * 60) + 1):
        position = minute / 60 / STEP
        i = min(int(position), len(series) - 2)
        value = series[i] + (series[i + 1] - series[i]) * (position - i)
        run = run + 1 if value > FAILURE['over'] else 0
        if run >= FAILURE['minutes']:
            return round(HOURS[0] + minute / 60, 3)
    return None


def run_scenario(homes, transformers, peak, ratings=None, may_act=True):
    base = {h['index']: baseline(h, peak) for h in homes}
    without = {i: finish([dict(row) for row in rows]) for i, rows in base.items()}
    total = lambda rows, t: [sum(rows[i][k]['grid'] for i in transformers[t]) for k in range(len(HOURS))]
    if ratings is None:
        ratings = {t: max(total(without, t)) / TARGET_PEAK[t] for t in transformers}
    forecast = {t: [v / ratings[t] for v in total(without, t)] for t in transformers}
    at_risk = [t for t in transformers if may_act and max(forecast[t][:CHART_END + 1]) > 1.0]

    def plan(t, r, share=True):
        members = transformers[t]
        steps = [k for k, hour in enumerate(HOURS) if PRECOOL[0] <= hour < HOLD[1]]
        room = {k: max(0.02, TARGET_WITH - 0.04 - forecast[t][k]) for k in steps}
        fill = {k: v / sum(room.values()) for k, v in room.items()}
        batteries = [i for i in members if homes[i]['battery'] and not homes[i]['medical']]
        evs = [i for i in members if homes[i]['ev'] and not homes[i]['medical']]
        sharers = batteries[:2]
        return {i: finish(managed(homes[i], base[i], r, i in batteries, SHARE['kw_each'] if share and i in sharers else 0.0,
                                  EV_LATER + 0.5 * evs.index(i) if i in evs else None, fill)) for i in members}, sharers

    with_, before_share, ease, sharers = dict(without), dict(without), {}, []
    evening_steps = range(HOURS.index(EASE[0]), CHART_END + 1)
    for t in at_risk:
        level = lambda r: max(total({**without, **plan(t, r)[0]}, t)[k] for k in evening_steps) / ratings[t]
        low, high = 0.0, MAX_EASE
        for _ in range(40):
            mid = (low + high) / 2
            low, high = (mid, high) if level(mid) > TARGET_WITH else (low, mid)
        ease[t] = round(high, 4)
        rows, sharers = plan(t, ease[t])
        with_.update(rows)
        before_share.update(plan(t, ease[t], share=False)[0])

    pct = lambda rows, t: [round(v / ratings[t] * 100, 1) for v in total(rows, t)]
    loads = {t: {'without': pct(without, t), 'with': pct(with_, t), 'before_share': pct(before_share, t)} for t in transformers}
    r1 = lambda xs: [round(x, 1) for x in xs]
    r2 = lambda xs: [round(x, 2) for x in xs]
    home_rows = []
    for h in homes:
        a, b = without[h['index']], with_[h['index']]
        row = {'t_in': {'without': r1(x['t_in'] for x in a), 'with': r1(x['t_in'] for x in b)},
               'load': {'without': r2(x['grid'] for x in a), 'with': r2(x['grid'] for x in b)},
               'mode': ''.join(x['mode'] for x in b)}
        if h['ev']:
            row['ev'] = {'without': r1(x['ev'] for x in a), 'with': r1(x['ev'] for x in b)}
        if any(x['battery'] for x in b):
            row['battery'] = r2(x['battery'] for x in b)
            row['soc'] = r2(x['soc'] for x in b)
        if any(x['share'] for x in b):
            row['share'] = r2(x['share'] for x in b)
        home_rows.append(row)
    energy = {k: round(sum(x['load'] for rows in source.values() for x in rows) * STEP, 1)
              for k, source in (('without', without), ('with', with_))}
    result = dict(peak_temp_f=peak, outdoor_f=r1(outdoor(x, peak) for x in HOURS), at_risk=at_risk, ease=ease,
                  transformers=loads, homes=home_rows, energy_kwh=energy,
                  failure={t: failure_time([v / 100 for v in loads[t]['without']]) for t in transformers})
    if at_risk:
        t = at_risk[0]
        share_kwh = round(sum(x['share'] for i in sharers for x in with_[i]) * STEP, 2)
        medical = next(i for i in transformers[t] if homes[i]['medical'])
        result['share'] = dict(transformer=t, suppliers=sharers, recipient=medical, start=SHARE['start'], end=SHARE['end'],
                               kwh=share_kwh, credit_usd=round(share_kwh * BASE_RATE, 2))
        result['summary'] = dict(transformer=t, peak_without=round(max(loads[t]['without'][:CHART_END + 1])),
                                 peak_with=round(max(loads[t]['with'][:CHART_END + 1])),
                                 medical_adjusted=sum(1 for i in transformers[t] if homes[i]['medical'] and home_rows[i]['mode'].strip('n')),
                                 homes=len(transformers[t]), kept_power_with=len(transformers[t]),
                                 kept_power_without=0 if result['failure'][t] else len(transformers[t]))
    return result, ratings


def outage_scenario(homes, transformers, ratings, centers):
    """The street loses power at OUTAGE['start']. Batteries island to their own homes; nothing moves over the
    downed lines. A neighbour's EV is driven to the medical home with the least backup left."""
    result, _ = run_scenario(homes, transformers, OUTAGE['temp'], ratings, may_act=False)
    k0 = HOURS.index(OUTAGE['start'])
    for loads in result['transformers'].values():
        for key in loads:
            loads[key] = loads[key][:k0] + [0.0] * (len(HOURS) - k0)
    for row in result['homes']:
        for key in row['load']:
            row['load'][key] = row['load'][key][:k0] + [0.0] * (len(HOURS) - k0)
    medical = [h for h in homes if h['medical']]
    full = {h['index']: h['medical']['backup_kwh'] / h['medical']['essential_kw'] for h in medical}
    recipient = min(medical, key=lambda h: full[h['index']])
    distance = lambda h: math.dist(centers[h['index']], centers[recipient['index']])
    donor = min((h for h in homes if h['ev'] and not h['medical']), key=distance)
    gain = OUTAGE['ev_kwh'] / recipient['medical']['essential_kw']
    left = lambda i, hour, extra: round(max(0.0, full[i] + extra - max(0.0, hour - OUTAGE['start'])), 2)
    result['outage'] = dict(
        start=OUTAGE['start'], arrive=OUTAGE['arrive'], recipient=recipient['index'], donor=donor['index'],
        ev_kwh=OUTAGE['ev_kwh'], ev_kw=OUTAGE['ev_kw'],
        islanded=[h['index'] for h in homes if h['battery']],
        medical=[dict(index=h['index'], hours=round(full[h['index']], 2),
                      without=[left(h['index'], hour, 0) for hour in HOURS],
                      **{'with': [left(h['index'], hour, gain if h is recipient and hour >= OUTAGE['arrive'] else 0) for hour in HOURS]})
                 for h in medical],
        summary=dict(medical=len(medical), covered_with=len(medical),
                     covered_without=sum(1 for h in medical if full[h['index']] >= HOURS[CHART_END] - OUTAGE['start']),
                     recipient_hours=round(full[recipient['index']], 1), recipient_hours_with=round(full[recipient['index']] + gain, 1)))
    result['failure'] = {t: None for t in transformers}
    return result


def build():
    map_data = json.loads((ROOT / 'public' / 'burbank.json').read_text())
    homes = make_homes(map_data)
    transformers = {t['id']: t['homes'] for t in map_data['transformers']}
    centers = {f['homeIndex']: f['center'] for f in map_data['features'] if 'homeIndex' in f}
    heat_wave, ratings = run_scenario(homes, transformers, 108)
    hot_day, _ = run_scenario(homes, transformers, 92, ratings)
    outage = outage_scenario(homes, transformers, ratings, centers)
    public = [{k: h[k] for k in ('index', 'id', 'transformer', 'thermostat', 'ev', 'battery', 'medical', 'away')} for h in homes]
    return dict(
        seed=SEED, hours=HOURS, chart_end=CHART_END, base_rate=BASE_RATE, disclaimer=DISCLAIMER,
        transformers=[dict(id=t['id'], street=t['street'], homes=t['homes'], rating_kva=round(ratings[t['id']], 1)) for t in map_data['transformers']],
        homes=public,
        settings=dict(normal_f=NORMAL_F, precool_f=PRECOOL_F, away_f=AWAY_F, medical_f=MEDICAL_F, precool=PRECOOL, hold=HOLD, ease=EASE,
                      payback=PAYBACK, ev_kw=EV_KW, ev_later=EV_LATER, battery=BATTERY, share=SHARE, failure=FAILURE, target_with=TARGET_WITH, outage=OUTAGE),
        scenarios=dict(heat_wave=heat_wave, hot_day=hot_day, outage=outage),
    )


if __name__ == '__main__':
    doc = build()
    (ROOT / 'public' / 'scenarios.json').write_text(json.dumps(doc, separators=(',', ':')))
    for name, s in doc['scenarios'].items():
        peaks = {t: (max(v['without'][:CHART_END + 1]), max(v['with'][:CHART_END + 1])) for t, v in s['transformers'].items()}
        print(name, 'peaks', peaks, 'ease', s['ease'], 'failure', s['failure'], 'energy', s['energy_kwh'])
        print('   ', s.get('share'), s.get('summary'))
