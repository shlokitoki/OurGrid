"""Build the Delhi (Lajpat Nagar) scene (public/delhi.json) and its patient data file (public/care-delhi.json).

Footprints and streets are real OpenStreetMap data (ODbL). Every patient, device, battery,
street risk and outcome is fictional.

    python3 engine/map_delhi.py
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
BBOX = (77.2380, 28.5640, 77.2460, 28.5700)
SOURCE = 'https://api.openstreetmap.org/api/0.6/map?bbox=%s,%s,%s,%s' % BBOX
CENTER = ((BBOX[0] + BBOX[2]) / 2, (BBOX[1] + BBOX[3]) / 2)
HOMES = 300
EXTENT = 330

# Fictional patients for the heat-wave story. Hours of safe power = backup Wh x 0.85 / device W.
# backup: 'charged', 'unconfirmed' (counts half until a check-in confirms it), 'uncharged', 'old' or 'none'.
# street: 'outage' = the street that loses power, 'high', 'mid' or 'low' risk.
# backup is a home inverter battery; 'old' inverters hold about 40%. sponsor: a funded battery (Wh).
PATIENTS = [
    dict(age=74, device='oxygen', backup_wh=0, backup='none', street='outage', responds=True, delivery=1500),
    dict(age=68, device='oxygen', backup_wh=1200, backup='old', street='outage', responds=False, delivery=1500),
    dict(age=81, device='bipap', backup_wh=900, backup='unconfirmed', street='high', responds=True),
    dict(age=77, device='dialysis', backup_wh=1500, backup='old', street='high', responds=True, delivery=1500),
    dict(age=65, device='oxygen', backup_wh=1500, backup='unconfirmed', street='outage', responds=False),
    dict(age=79, device='ventilator', backup_wh=1200, backup='unconfirmed', street='high', responds=True),
    dict(age=72, device='bipap', backup_wh=1200, backup='unconfirmed', street='mid', responds=True),
    dict(age=83, device='oxygen', backup_wh=2400, backup='unconfirmed', street='mid', responds=True),
    dict(age=69, device='heart_pump', backup_wh=900, backup='charged', street='mid', responds=True),
    dict(age=76, device='bipap', backup_wh=1800, backup='charged', street='low', responds=True),
    dict(age=71, device='ventilator', backup_wh=2400, backup='charged', street='low', responds=True),
    dict(age=88, device='oxygen', backup_wh=4800, backup='charged', street='low', responds=True),
    dict(age=66, device='bipap', backup_wh=2400, backup='charged', street='mid', responds=True),
    dict(age=80, device='heart_pump', backup_wh=1500, backup='charged', street='low', responds=True),
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
    for f in features:
        if f['kind'] == 'road' and not f['name']:
            f['name'] = 'lane-%d' % f['id']  # most Delhi lanes are unnamed in OSM; key risk by way
    named = [f for f in features if f['kind'] == 'road' and f['highway'] in ('residential', 'service', 'tertiary', 'living_street')]
    houses = sorted((f for f in features if f['kind'] == 'building' and f['buildingType'] in ('yes', 'house', 'residential', 'apartments')),
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
    others = [f for f in features if f['kind'] == 'building' and f.get('homeIndex') is None]
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
                   place='Lajpat Nagar, New Delhi', source=SOURCE, retrieved=date.today().isoformat(),
                   license='Map data © OpenStreetMap contributors, ODbL 1.0 https://opendatacommons.org/licenses/odbl/1-0/')
    (ROOT / 'public' / 'delhi.json').write_text(json.dumps(map_doc, separators=(',', ':')))
    care = dict(
        place='Lajpat Nagar, New Delhi', utility='', disclaimer='Illustrative simulation with fictional patients. No real health data.',
        devices=DEVICES, streets=street_risk, outage=dict(street=outage_street, start=99), patients=patients,
        ordinary=dict(warnings=[]), trees='round', places=dict(cooling='Home-care nurses', depot='Sponsor depot'),
        scoring=dict(efficiency=0.85, unconfirmed=0.5, tiers=dict(red_hours=4, green_hours=12, red_risk=0.6), floor_hours=0.5),
    )
    (ROOT / 'public' / 'care-delhi.json').write_text(json.dumps(care, indent=1))
    print('features', len(features), 'homes', len(houses), 'outage street', outage_street, counts[outage_street], 'high', high_street,
          'cooling', cooling.get('buildingType'), cooling['center'], 'depot', depot)


if __name__ == '__main__':
    main()
