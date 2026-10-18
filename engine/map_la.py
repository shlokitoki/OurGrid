"""Build the North Hollywood scene (public/noho.json) and its patient data file (public/care-la.json).

Footprints and streets are real OpenStreetMap data (ODbL). Every patient, device, battery,
street risk and outcome is fictional.

    python3 engine/map_la.py
"""
import json
import math
import random
import ssl
import urllib.request
import xml.etree.ElementTree as ET
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BBOX = (-118.3800, 34.1800, -118.3700, 34.1870)
SOURCE = 'https://api.openstreetmap.org/api/0.6/map?bbox=%s,%s,%s,%s' % BBOX
CENTER = ((BBOX[0] + BBOX[2]) / 2, (BBOX[1] + BBOX[3]) / 2)
HOMES = 300
EXTENT = 330

# Fictional patients for the heat-wave story. Hours of safe power = backup Wh x 0.85 / device W.
# backup: 'charged', 'unconfirmed' (counts half until a check-in confirms it), 'uncharged', 'old' or 'none'.
# street: 'outage' = the street that loses power, 'high', 'mid' or 'low' risk.
PATIENTS = [
    # Tier 1 at ranking: under 4 h on a high-risk street.
    dict(age=81, device='oxygen', backup_wh=0, backup='none', street='outage', responds=True, delivery=2000, ladder='swap'),
    dict(age=77, device='dialysis', backup_wh=1000, backup='uncharged', street='outage', responds=True, delivery=2000, ladder='move'),
    dict(age=84, device='oxygen', backup_wh=1000, backup='charged', street='outage', responds=True, delivery=1000, ladder='cylinders'),
    dict(age=79, device='ventilator', backup_wh=1000, backup='old', street='high', responds=True, swap=1000),
    dict(age=88, device='heart_pump', backup_wh=500, backup='unconfirmed', street='high', responds=True),
    # Tier 2: 4-12 h. Two never reply, so a care coordinator calls.
    dict(age=76, device='bipap', backup_wh=1500, backup='unconfirmed', street='outage', responds=False),
    dict(age=82, device='bipap', backup_wh=1500, backup='unconfirmed', street='high', responds=False),
    dict(age=75, device='oxygen', backup_wh=6000, backup='unconfirmed', street='mid', responds=True),
    dict(age=90, device='ventilator', backup_wh=2000, backup='unconfirmed', street='mid', responds=True),
    dict(age=78, device='heart_pump', backup_wh=900, backup='unconfirmed', street='mid', responds=True),
    dict(age=83, device='bipap', backup_wh=1500, backup='unconfirmed', street='low', responds=True),
    dict(age=80, device='oxygen', backup_wh=3000, backup='charged', street='low', responds=True),
    # Tier 3: 12 h or more.
    dict(age=86, device='bipap', backup_wh=3000, backup='charged', street='outage', responds=True),
    dict(age=77, device='heart_pump', backup_wh=2000, backup='charged', street='high', responds=True),
    dict(age=79, device='ventilator', backup_wh=4000, backup='charged', street='mid', responds=True),
    dict(age=92, device='bipap', backup_wh=2000, backup='charged', street='mid', responds=True),
    dict(age=76, device='heart_pump', backup_wh=1500, backup='charged', street='low', responds=True),
    dict(age=85, device='oxygen', backup_wh=10000, backup='charged', street='low', responds=True),
    dict(age=81, device='ventilator', backup_wh=3000, backup='charged', street='low', responds=True),
    dict(age=78, device='bipap', backup_wh=2500, backup='charged', street='low', responds=True),
]
DEVICES = {
    'oxygen': dict(label='Oxygen concentrator', watts=350, criticality=2),
    'ventilator': dict(label='Ventilator', watts=110, criticality=3),
    'heart_pump': dict(label='Heart pump', watts=60, criticality=3),
    'dialysis': dict(label='Home dialysis', watts=450, criticality=2),
    'bipap': dict(label='BiPAP', watts=90, criticality=1),
}
RISK = {'outage': 0.6, 'high': 0.6, 'mid': 0.3, 'low': 0.1}


def project(lon, lat):
    return [(lon - CENTER[0]) * 111320 * math.cos(math.radians(CENTER[1])), -(lat - CENTER[1]) * 111320]


def fetch():
    request = urllib.request.Request(SOURCE, headers={'User-Agent': 'OurGridHackathonDemo/1.0'})
    try:
        import certifi
        context = ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        context = ssl.create_default_context()
    with urllib.request.urlopen(request, timeout=90, context=context) as response:
        return ET.fromstring(response.read())


def classify(tags):
    if 'building' in tags:
        return 'building'
    highway = tags.get('highway')
    if highway:
        return 'path' if highway in ('footway', 'path', 'steps', 'cycleway', 'pedestrian') else 'road'
    if tags.get('leisure') in ('park', 'playground', 'pitch') or tags.get('landuse') in ('grass', 'recreation_ground'):
        return 'park'
    return None


def segment_distance(p, a, b):
    dx, dz = b[0] - a[0], b[1] - a[1]
    t = max(0, min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz or 1)))
    return math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz)


def main():
    root = fetch()
    nodes = {n.attrib['id']: (float(n.attrib['lon']), float(n.attrib['lat'])) for n in root.findall('node')}
    features = []
    for way in root.findall('way'):
        tags = {t.attrib['k']: t.attrib['v'] for t in way.findall('tag')}
        refs = [n.attrib['ref'] for n in way.findall('nd')]
        kind = classify(tags)
        if not kind or not refs or any(r not in nodes for r in refs):
            continue
        points = [project(*nodes[r]) for r in refs]
        center = [sum(p[0] for p in points) / len(points), sum(p[1] for p in points) / len(points)]
        if kind == 'building' and (abs(center[0]) > EXTENT or abs(center[1]) > EXTENT):
            continue
        features.append(dict(id=int(way.attrib['id']), kind=kind, name=tags.get('name', ''), points=points, center=center,
                             buildingType=tags.get('building'), highway=tags.get('highway'), amenity=tags.get('amenity')))
    named = [f for f in features if f['kind'] == 'road' and f['name'] and f['highway'] == 'residential']
    houses = sorted((f for f in features if f['kind'] == 'building' and f['buildingType'] in ('house', 'detached')),
                    key=lambda f: math.hypot(*f['center']))[:HOMES]
    for i, f in enumerate(houses):
        f['homeIndex'] = i
        f['street'] = min(named, key=lambda r: min(segment_distance(f['center'], a, b) for a, b in zip(r['points'], r['points'][1:])))['name']
    # Fictional risk by street: the street with the most homes is the one that loses power.
    counts = {}
    for f in houses:
        counts[f['street']] = counts.get(f['street'], 0) + 1
    ranked = sorted(counts, key=lambda s: -counts[s])
    outage_street, high_street = ranked[0], ranked[1]
    mids, lows = ranked[2:5], ranked[5:]
    street_risk = {s: 0.6 if s in (outage_street, high_street) else 0.3 if s in mids else 0.1 for s in ranked}

    rng = random.Random(7)
    pools = {'outage': [f for f in houses if f['street'] == outage_street], 'high': [f for f in houses if f['street'] == high_street],
             'mid': [f for f in houses if f['street'] in mids], 'low': [f for f in houses if f['street'] in lows]}
    for pool in pools.values():
        pool.sort(key=lambda f: f['center'][1])
    patients, used = [], set()
    for n, p in enumerate(PATIENTS):
        pool = [f for f in pools[p['street']] if f['homeIndex'] not in used]
        # Spread patients along their street rather than clustering them.
        home = pool[(len(pool) * (2 * sum(1 for q in PATIENTS[:n] if q['street'] == p['street']) + 1)) // (2 * sum(1 for q in PATIENTS if q['street'] == p['street']) + 1) % len(pool)]
        used.add(home['homeIndex'])
        patients.append(dict(id='P%02d' % (n + 1), home=home['homeIndex'], risk=street_risk[home['street']], **{**p, 'group': p['street'], 'street': home['street']}))
    rng.shuffle(patients)  # the list order shouldn't give the ranking away
    patients.sort(key=lambda q: q['id'])

    # A cooling centre (the largest non-house building) and the agency depot (edge of the map, on the busiest road).
    others = [f for f in features if f['kind'] == 'building' and f['buildingType'] not in ('house', 'detached', 'garage', 'shed')]
    area = lambda f: abs(sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(f['points'], f['points'][1:]))) / 2
    cooling = max((f for f in others if math.hypot(*f['center']) < 280), key=area)
    roads = [f for f in features if f['kind'] == 'road' and f['highway'] in ('primary', 'secondary', 'tertiary', 'residential')]
    depot = max((p for r in roads for p in r['points'] if math.hypot(*p) < 290), key=lambda p: math.hypot(*p))

    for f in features:
        f['points'] = [[round(x, 2), round(z, 2)] for x, z in f['points']]
        f['center'] = [round(f['center'][0], 2), round(f['center'][1], 2)]
        for key in ('highway', 'amenity'):
            if not f.get(key):
                f.pop(key, None)
    map_doc = dict(center=list(CENTER), features=features, cooling=dict(id=cooling['id'], center=cooling['center']),
                   depot=[round(depot[0], 2), round(depot[1], 2)],
                   place='North Hollywood, Los Angeles (around Bessemer St and Fulcher Ave)', source=SOURCE, retrieved=date.today().isoformat(),
                   license='Map data © OpenStreetMap contributors, ODbL 1.0 https://opendatacommons.org/licenses/odbl/1-0/')
    (ROOT / 'public' / 'noho.json').write_text(json.dumps(map_doc, separators=(',', ':')))
    care = dict(
        place='North Hollywood, Los Angeles', utility='LADWP', disclaimer='Illustrative simulation with fictional patients. No real health data.',
        devices=DEVICES, streets=street_risk, outage=dict(street=outage_street, start=42 + 10 / 60), patients=patients,
        trees='palm', places=dict(cooling='Cooling center', depot='Agency depot'),
        ordinary=dict(warnings=[dict(id='P01', note='No backup on file'), dict(id='P02', note='Not charged in 30 days'), dict(id='P04', note='3 years old'), dict(id='P17', note='3 years old')]),
        scoring=dict(efficiency=0.85, unconfirmed=0.5, tiers=dict(red_hours=4, green_hours=12, red_risk=0.6), floor_hours=0.5),
    )
    (ROOT / 'public' / 'care-la.json').write_text(json.dumps(care, indent=1))
    print('features', len(features), 'homes', len(houses), 'outage street', outage_street, counts[outage_street], 'high', high_street,
          'cooling', cooling.get('buildingType'), cooling['center'], 'depot', depot)


if __name__ == '__main__':
    main()
