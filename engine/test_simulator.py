"""Safety, consent, energy accounting, and comparison checks for every scenario."""
import unittest
from simulator import generate_fleet, solve, HORIZON, EFFICIENCY
class SafetyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fleet=generate_fleet()
        cls.results=[solve(cls.fleet,m,mode) for mode in ['everyday','emergency'] for m in range(16)]
    def test_fleet(self):
        self.assertEqual(len(self.fleet),100)
        self.assertEqual(len(set(h['id'] for h in self.fleet)),100)
        self.assertTrue(all(h['capacity_kwh']==39.2 for h in self.fleet))
    def test_constraints(self):
        for s in self.results:
            self.assertAlmostEqual(s['reduction_kw']+s['unmet_kw'],s['target_kw'],places=6)
            self.assertAlmostEqual(s['ev_kw']+s['voluntary_kw']+s['battery_kw'],s['reduction_kw'],places=6)
            self.assertEqual(s['reserve_violations'],0)
            for h,a in zip(self.fleet,s['actions']):
                if a['status']!='Verified' or not h['battery_consent']:self.assertEqual(a['battery_kw'],0)
                if not h['voluntary_consent']:self.assertEqual(a['voluntary_kw'],0)
                if h['critical']:self.assertEqual(a['voluntary_kw'],0)
                self.assertLessEqual(a['ev_kw']+a['voluntary_kw'],h['load_kw']-h['essential_kw']+1e-6)
                self.assertLessEqual(a['battery_kw']+a['ev_kw']+a['voluntary_kw'],a['load_kw']+1e-6)
                self.assertAlmostEqual(a['post_energy_kwh'],a['energy_kwh']-a['battery_kw']*HORIZON/EFFICIENCY,places=6)
    def test_demo_story(self):
        normal=solve(self.fleet,0); spike=solve(self.fleet,1); comm=solve(self.fleet,5)
        self.assertEqual(normal['reduction_kw'],0)
        self.assertAlmostEqual(spike['unmet_kw'],0)
        self.assertGreater(comm['unmet_kw'],0)
        self.assertGreater(spike['avoided'],comm['avoided'])
        self.assertEqual(comm['unverified'],50)
        self.assertAlmostEqual(spike['total_load_kw']-normal['total_load_kw'],185)
        self.assertAlmostEqual(spike['grid_capacity_kw'],normal['grid_capacity_kw'])
        self.assertAlmostEqual(spike['total_load_kw']-spike['grid_capacity_kw'],150)
    def test_determinism(self):
        self.assertEqual(generate_fleet(),self.fleet)
        self.assertEqual(solve(self.fleet,5),solve(self.fleet,5))
if __name__=='__main__':unittest.main()
