"""Build public/burbank.json from OpenStreetMap: one Burbank block, about 40 homes, 4 transformers.

Footprints and streets are real OSM geometry (ODbL). Which homes are "in the demo",
their transformer grouping and the pole positions are illustrative choices.

    python3 engine/map_burbank.py
"""
import json
import math
import ssl
import urllib.request
import xml.etree.ElementTree as ET
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BBOX = (-118.3488, 34.1738, -118.3380, 34.1810)  # west, south, east, north
SOURCE = 'https://api.openstreetmap.org/api/0.6/map?bbox=%s,%s,%s,%s' % BBOX
CENTER = (-118.3433, 34.1778)  # provisional; the output is re-centred on the selected homes
STREETS = {'Fairview': 'North Fairview Street', 'Niagara': 'North Niagara Street'}
NORTH_EDGE, SOUTH_EDGE = 'Wyoming Avenue', 'Burbank Boulevard'
HOMES_PER_SIDE = 10
EXTENT = 290  # metres from the block centre to keep context buildings


def project(lon, lat):
    x = (lon - CENTER[0]) * 111320 * math.cos(math.radians(CENTER[1]))
    z = -(lat - CENTER[1]) * 111320  # z grows to the south
    return [x, z]


def fetch():
    request = urllib.request.Request(SOURCE, headers={'User-Agent': 'OurGridHackathonDemo/1.0'})
    try:
        import certifi  # python.org builds ship without system CA certificates
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
    if tags.get('natural') == 'water':
        return 'water'
    return None


def cross(lines, value, along):
    """Where a polyline crosses x=value (along=1 returns z) or z=value (along=0 returns x)."""
    other = 1 - along
    for points in lines:
        for a, b in zip(points, points[1:]):
            if min(a[other], b[other]) <= value <= max(a[other], b[other]) and a[other] != b[other]:
                return a[along] + (b[along] - a[along]) * (value - a[other]) / (b[other] - a[other])
    return None


def main():
    root = fetch()
    nodes = {n.attrib['id']: (float(n.attrib['lon']), float(n.attrib['lat'])) for n in root.findall('node')}
    features, lines = [], {}
    for way in root.findall('way'):
        tags = {t.attrib['k']: t.attrib['v'] for t in way.findall('tag')}
        refs = [n.attrib['ref'] for n in way.findall('nd')]
        if not refs or any(r not in nodes for r in refs):
            continue
        points = [project(*nodes[r]) for r in refs]
        if tags.get('highway') and tags.get('name'):
            lines.setdefault(tags['name'], []).append(points)
        kind = classify(tags)
        if kind:
            features.append(dict(id=int(way.attrib['id']), kind=kind, name=tags.get('name', ''), points=points,
                                 buildingType=tags.get('building')))
    for f in features:
        f['center'] = [sum(p[0] for p in f['points']) / len(f['points']), sum(p[1] for p in f['points']) / len(f['points'])]

    # Front houses on each side of both streets, strictly inside the Burbank Blvd / Wyoming Ave block.
    homes = []
    for key, name in STREETS.items():
        street = lines[name]
        sx_mid = cross(street, 0, 0)  # street x near the provisional centre
        z_north = cross(lines[NORTH_EDGE], sx_mid, 1) + 14
        z_south = cross(lines[SOUTH_EDGE], sx_mid, 1) - 38  # skip the commercial frontage
        mid_z = (z_north + z_south) / 2
        candidates = {-1: [], 1: []}
        for f in features:
            if f['kind'] != 'building' or f['buildingType'] not in ('house', 'detached'):
                continue
            cx, cz = f['center']
            sx = cross(street, cz, 0)
            if sx is None or not z_north < cz < z_south:
                continue
            for side in (-1, 1):
                if 12 < (cx - sx) * side < 34:
                    candidates[side].append((abs(cz - mid_z), f, sx))
        for side in candidates:
            candidates[side].sort(key=lambda c: c[0])
        # Up to 2 x HOMES_PER_SIDE per street; a short side gives its spare places to the other side.
        take = {side: min(HOMES_PER_SIDE, len(c)) for side, c in candidates.items()}
        for side in take:
            take[side] = min(len(candidates[side]), 2 * HOMES_PER_SIDE - take[-side])
        assert sum(take.values()) >= 2 * HOMES_PER_SIDE - 2, (key, {s: len(c) for s, c in candidates.items()})
        for side, c in candidates.items():
            for _, f, sx in sorted(c[:take[side]], key=lambda c: c[1]['center'][1]):
                homes.append(dict(street=key, side=side, feature=f, street_x=sx, mid_z=mid_z))

    # Re-centre everything on the selected homes.
    ox = sum(h['feature']['center'][0] for h in homes) / len(homes)
    oz = sum(h['feature']['center'][1] for h in homes) / len(homes)
    shift = lambda p: [round(p[0] - ox, 2), round(p[1] - oz, 2)]
    for f in features:
        f['points'] = [shift(p) for p in f['points']]
        f['center'] = shift(f['center'])
    for points_list in lines.values():
        for points in points_list:
            points[:] = [shift(p) for p in points]
    for h in homes:
        h['street_x'] -= ox
        h['mid_z'] -= oz
    features = [f for f in features if f['kind'] != 'building' or (abs(f['center'][0]) < EXTENT and abs(f['center'][1]) < EXTENT)]

    # Two transformers per street: the north and south halves of its homes, both sides.
    transformers, index = [], 0
    for tid, key, north in (('A', 'Fairview', True), ('B', 'Fairview', False), ('C', 'Niagara', True), ('D', 'Niagara', False)):
        street_homes = sorted((h for h in homes if h['street'] == key), key=lambda h: h['feature']['center'][1])
        half = len(street_homes) // 2
        group = street_homes[:half] if north else street_homes[half:]
        group.sort(key=lambda h: (h['side'], h['feature']['center'][1]))
        zs = [h['feature']['center'][1] for h in group]
        pole_z = (min(zs) + max(zs)) / 2
        pole_x = cross(lines[STREETS[key]], pole_z, 0) + 7.5  # east parkway
        t = dict(id=tid, street=STREETS[key].replace('North ', 'N ').replace(' Street', ' St'),
                 pole=[round(pole_x, 2), round(pole_z, 2)], homes=[])
        for h in group:
            f = h['feature']
            f.update(homeIndex=index, transformer=tid, side='east' if h['side'] > 0 else 'west', streetX=round(h['street_x'], 2))
            t['homes'].append(index)
            index += 1
        transformers.append(t)

    selected = [f for f in features if 'homeIndex' in f]
    xs = [p[0] for f in selected for p in f['points']]
    zs = [p[1] for f in selected for p in f['points']]
    doc = dict(center=[round(CENTER[0] + ox / (111320 * math.cos(math.radians(CENTER[1]))), 6), round(CENTER[1] - oz / 111320, 6)],
               bounds=[round(min(xs) - 70, 1), round(min(zs) - 70, 1), round(max(xs) + 70, 1), round(max(zs) + 70, 1)],
               features=features, transformers=transformers,
               place='N Fairview St and N Niagara St between W Burbank Blvd and Wyoming Ave, Burbank, CA',
               source=SOURCE, retrieved=date.today().isoformat(),
               license='Map data © OpenStreetMap contributors, ODbL 1.0 https://opendatacommons.org/licenses/odbl/1-0/')
    (ROOT / 'public' / 'burbank.json').write_text(json.dumps(doc, separators=(',', ':')))
    print('features', len(features), 'homes', len(selected), 'bounds', doc['bounds'])
    for t in transformers:
        print(t['id'], t['street'], 'pole', t['pole'], 'homes', len(t['homes']))


if __name__ == '__main__':
    main()
