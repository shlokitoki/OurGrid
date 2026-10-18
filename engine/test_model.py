import json
import unittest
from pathlib import Path

import model

ROOT = Path(__file__).resolve().parents[1]


class ModelTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.doc = model.build()
        cls.heat = cls.doc['scenarios']['heat_wave']
        cls.hot = cls.doc['scenarios']['hot_day']
        cls.end = cls.doc['chart_end'] + 1
        cls.hours = cls.doc['hours']
        cls.homes = cls.doc['homes']
        cls.groups = {t['id']: t['homes'] for t in cls.doc['transformers']}

    def test_block(self):
        self.assertTrue(36 <= len(self.homes) <= 44)
        self.assertEqual(sorted(self.groups), ['A', 'B', 'C', 'D'])
        for members in self.groups.values():
            self.assertTrue(8 <= len(members) <= 12)

    def test_heat_wave_story(self):
        b = self.heat['transformers']['B']
        six = self.hours.index(18.0)
        self.assertEqual(self.heat['at_risk'], ['B'])
        self.assertAlmostEqual(max(b['without'][:self.end]), 118, delta=0.5)
        self.assertEqual(b['without'].index(max(b['without'][:self.end])), six)
        self.assertLessEqual(max(b['with'][:self.end]), 94.5)
        self.assertGreater(b['before_share'][six], b['with'][six])
        self.assertEqual(self.heat['summary']['medical_adjusted'], 0)

    def test_only_the_peak_moves(self):
        b = self.heat['transformers']['B']
        afternoon = [k for k, h in enumerate(self.hours) if 13 <= h < 16]
        self.assertTrue(all(b['with'][k] > b['without'][k] for k in afternoon))
        self.assertTrue(all(b['with'][k] < 100 for k in afternoon))
        energy = self.heat['energy_kwh']
        self.assertGreaterEqual(energy['with'], energy['without'])
        self.assertLess(energy['with'], energy['without'] * 1.02)

    def test_other_transformers_untouched(self):
        for t in 'ACD':
            loads = self.heat['transformers'][t]
            self.assertEqual(loads['with'], loads['without'])
            self.assertLess(max(loads['without'][:self.end]), 100)
            for i in self.groups[t]:
                self.assertEqual(self.heat['homes'][i]['load']['with'], self.heat['homes'][i]['load']['without'])

    def test_medical_homes_never_adjusted(self):
        for scenario in (self.heat, self.hot):
            for home, row in zip(self.homes, scenario['homes']):
                if home['medical']:
                    self.assertEqual(row['t_in']['with'], row['t_in']['without'])
                    self.assertEqual(set(row['mode']), {'n'})
                    self.assertNotIn('battery', row)

    def test_comfort_band(self):
        for home, row in zip(self.homes, self.heat['homes']):
            if set(row['mode']) - {'n'}:
                evening = [t for t, h in zip(row['t_in']['with'], self.hours) if 16 <= h < 20]
                self.assertTrue(all(72.9 <= t <= 76.01 for t in evening), home['id'])

    def test_sharing(self):
        share = self.heat['share']
        self.assertEqual(len(share['suppliers']), 2)
        self.assertAlmostEqual(share['kwh'], 1.5, places=2)
        self.assertAlmostEqual(share['credit_usd'], round(1.5 * self.doc['base_rate'], 2))
        self.assertTrue(self.homes[share['recipient']]['medical'])
        for i in share['suppliers']:
            soc = self.heat['homes'][i]['soc']
            self.assertGreaterEqual(min(soc), model.BATTERY['reserve'] - 1e-6)

    def test_evs_move_to_ten(self):
        for i in self.groups['B']:
            row = self.heat['homes'][i]
            if 'ev' in row:
                first = next(h for h, kw in zip(self.hours, row['ev']['with']) if kw > 0)
                self.assertGreaterEqual(first, model.EV_LATER)
                self.assertAlmostEqual(sum(row['ev']['with']), sum(row['ev']['without']), delta=0.2)

    def test_hot_day_no_action(self):
        self.assertEqual(self.hot['at_risk'], [])
        for loads in self.hot['transformers'].values():
            self.assertEqual(loads['with'], loads['without'])
            self.assertLess(max(loads['without'][:self.end]), 90)

    def test_failure_without(self):
        failure = self.heat['failure']['B']
        self.assertIsNotNone(failure)
        self.assertTrue(17.75 < failure < 18.5)
        self.assertTrue(all(v is None for t, v in self.heat['failure'].items() if t != 'B'))

    def test_outage(self):
        outage = self.doc['scenarios']['outage']
        o = outage['outage']
        start = self.hours.index(o['start'])
        for loads in outage['transformers'].values():
            self.assertTrue(all(v == 0 for v in loads['with'][start:]))
            self.assertEqual(loads['with'], loads['without'])
        hours = {m['index']: m['hours'] for m in o['medical']}
        self.assertEqual(o['recipient'], min(hours, key=hours.get))
        self.assertTrue(self.homes[o['donor']]['ev'])
        self.assertFalse(self.homes[o['donor']]['medical'])
        self.assertTrue(all(self.homes[i]['battery'] for i in o['islanded']))
        recipient = next(m for m in o['medical'] if m['index'] == o['recipient'])
        end = self.doc['chart_end']
        self.assertEqual(recipient['without'][end], 0)
        self.assertGreater(recipient['with'][end], 0)
        self.assertEqual(o['summary']['covered_with'], o['summary']['medical'])
        self.assertLess(o['summary']['covered_without'], o['summary']['medical'])

    def test_reproducible_and_written(self):
        self.assertEqual(json.dumps(model.build(), sort_keys=True), json.dumps(self.doc, sort_keys=True))
        written = json.loads((ROOT / 'public' / 'scenarios.json').read_text())
        self.assertEqual(json.dumps(written, sort_keys=True), json.dumps(self.doc, sort_keys=True))


if __name__ == '__main__':
    unittest.main()
