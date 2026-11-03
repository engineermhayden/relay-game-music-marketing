import math
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from game.simulation import new_world, add_player, step, action, public_state
from game.levels import LEVELS

class SimulationTests(unittest.TestCase):
    def setUp(self):
        self.world = new_world(42, 100)
        add_player(self.world, 'one', 'Pilot One')
        self.p = self.world['players']['one']
        self.p['seen'] = 100

    def test_seed_repeatability_and_room_isolation(self):
        other = new_world(42, 100)
        self.assertEqual(self.world['shards'], other['shards'])
        self.world['shards'][0]['taken'] = True
        self.assertFalse(other['shards'][0]['taken'])

    def test_movement_is_normalized_and_step_bounded(self):
        self.p['input'] = [1,1]
        step(self.world, 50, 100)
        self.assertAlmostEqual(math.hypot(self.p['x'], self.p['z']), .9)

    def test_stale_input_stops(self):
        self.p['input'] = [1,0]
        step(self.world, .1, 101)
        self.assertEqual(self.p['x'], 0)

    def test_collect_once_and_share_energy(self):
        shard = self.world['shards'][0]
        self.p.update(x=shard['x'], z=shard['z'])
        action(self.world, 'one', 'interact', 101)
        self.assertEqual(self.world['energy'], 1)
        self.assertTrue(shard['taken'])
        action(self.world, 'one', 'interact', 101.1)
        self.assertEqual(self.world['energy'], 1)

    def test_remote_interaction_cannot_charge_relay(self):
        self.world['energy'] = 9
        action(self.world, 'one', 'interact', 101)
        self.assertEqual(self.world['relays'][0]['charge'], 0)

    def test_win_requires_three_relays_and_return(self):
        self.world['shards'] = []
        self.world['energy'] = 9
        now = 101
        for r in self.world['relays']:
            self.p.update(x=r['x'], z=r['z'])
            for _ in range(3):
                action(self.world, 'one', 'interact', now)
                now += 1
        self.assertEqual(self.world['status'], 'active')
        self.assertEqual(self.world['energy'], 0)
        self.p.update(x=0,z=0)
        action(self.world, 'one', 'interact', now)
        self.assertEqual(self.world['status'], 'won')
        score = self.world['score']
        action(self.world, 'one', 'interact', now+2)
        self.assertEqual(self.world['score'], score)

    def test_deadline_ends_mission(self):
        step(self.world,.1,821)
        self.assertEqual(self.world['status'],'lost')

    def test_eight_pilots_and_rejoin(self):
        for i in range(7): add_player(self.world,str(i),'Pilot')
        add_player(self.world,'one','Renamed')
        self.assertEqual(len(self.world['players']),8)
        with self.assertRaises(ValueError): add_player(self.world,'ninth','Overflow')

    def test_no_input_in_public_snapshot(self):
        p = public_state(self.world,100)['players'][0]
        self.assertNotIn('input',p)
        self.assertNotIn('seen',p)

    def test_every_destination_can_be_completed_solo(self):
        for level in LEVELS:
            with self.subTest(level=level):
                state = new_world(42, 100, level=level)
                add_player(state, 'one', 'Solo')
                player = state['players']['one']
                now = 101
                # Traverse to each real collectible; no artificial energy grants.
                for shard in state['shards']:
                    if state['energy'] >= 9: break
                    player.update(x=shard['x'], z=shard['z'])
                    action(state, 'one', 'interact', now)
                    now += 1
                for relay in state['relays']:
                    player.update(x=relay['x'], z=relay['z'])
                    attempts = 0
                    while relay['charge'] < 3 and attempts < 20:
                        action(state, 'one', 'interact', now)
                        now += 1
                        attempts += 1
                    self.assertEqual(relay['charge'], 3)
                player.update(x=0, z=0)
                action(state, 'one', 'interact', now)
                self.assertEqual(state['status'], 'won')
                self.assertEqual(len(public_state(state, now)['sentinels']), LEVELS[level]['sentinelCount'])

    def test_heat_pulses_and_rescue(self):
        state = new_world(42, 100, level='ember')
        add_player(state, 'one', 'Pilot')
        p = state['players']['one']
        p.update(x=-9, z=-2, shield=50, seen=105)
        step(state, .1, 105)
        self.assertGreater(p['shield'], 50)
        p.update(seen=107)
        step(state, .1, 107)
        self.assertLess(p['shield'], 50)
        p.update(shield=1)
        step(state, .1, 107.1)
        self.assertEqual((p['x'], p['z'], p['shield']), (0, 0, 100))

    def test_frost_slows_but_does_not_trap_pilots(self):
        state = new_world(42, 100, level='glacier')
        add_player(state, 'one', 'Pilot')
        p = state['players']['one']
        p.update(x=-10, z=-3, input=[1,0], seen=100)
        step(state, .1, 100)
        self.assertAlmostEqual(p['x'] + 10, 4.5 * .55 * .1)
        p.update(x=0, z=0)
        step(state, .1, 100)
        self.assertAlmostEqual(p['x'], .45)

    def test_circuit_rejects_out_of_order_relay_without_spending_energy(self):
        state = new_world(42, 100, level='tempest')
        add_player(state, 'one', 'Pilot')
        state['shards'] = []
        state['energy'] = 3
        relay = state['relays'][1]
        state['players']['one'].update(x=relay['x'], z=relay['z'])
        self.assertIn('Circuit locked', action(state, 'one', 'interact', 101))
        self.assertEqual(state['energy'], 3)
        self.assertEqual(relay['charge'], 0)

    def test_legacy_snapshot_keeps_verdant_rules(self):
        del self.world['level']
        self.assertEqual(len(public_state(self.world, 100)['sentinels']), 3)
        step(self.world, .1, 100)

if __name__ == '__main__': unittest.main()
