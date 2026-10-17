# GraceGrid AI

A light, interactive hackathon dashboard: Next.js, React, Three.js, and a reproducible Python/SciPy decision engine.

## Run

```sh
npm ci
npm run dev
```

Open http://localhost:3000. To regenerate the scenario solutions:

```sh
python3 -m pip install -r engine/requirements.txt
npm run engine
npm run test:engine
cp engine/simulator.py public/simulator.py
npm run build
```

`out/` is a deployable Next.js static export. The hosted app uses 32 exact, precomputed SciPy/HiGHS solutions (16 combinations of four incident flags × two modes). No Python server is required in the browser. Changing a scenario selects the matching verified solution. The model source is downloadable from the methodology dialog.

## The demo

The site opens on a light, animated neighborhood mesh. **View Launch** plays a typewriter hook and rhetorical question, then reveals six benefits one by one before fading in the GraceGrid logo at 75% opacity and the closing tagline. Clicking anywhere enters the dashboard; its header can reopen the launch page. Reduced-motion visitors go directly to the final launch frame.

The overview introduces the problem, response, and proof in three compact panels. **Run live demo** plays a paced 13-step, roughly 52-second story: normal load; a 150 kW spike; a zoom to an opted-in EV charger slowing; a second zoom to voluntarily deferred TV/game-console use; safe battery dispatch; a fictional critical-needs home below its no-export floor; a request in the Mueller neighborhood portal; four neighbors approving 0.5 kW each; a separate energy/bill-credit ledger; battery communication loss; recalculation; dispatcher escalation; and a persistent closing message. A segmented motion bar on the 3D model shows the current stage and its elapsed pace. Viewers can pause, resume, replay, or jump between stages.

The care-home example is GG-046 (24% state of charge, 55% no-export floor), assigned a **fictional** older resident and oxygen concentrator. The four closest eligible verified neighbors each earmark 0.5 kW of battery dispatch *already included* in the optimized support plan. Over the 15-minute window that is 0.125 kWh per neighbor, 0.5 kWh total. This exchange adds no capacity or discharge to the optimizer result. The portal lets a viewer submit the simulated request, approve each offer, switch between kWh credits and an illustrative bill credit at $0.16/kWh, reset, and export the ledger. The receiving home has the matching simulated debit. The demo rate is not an actual Base Power or utility tariff; no money or electricity is transferred.

Animated arcs on the 3D map show **illustrative grid capacity and matched allocations**, not physical wires or guaranteed delivery to a particular house. The simulator models reduced net grid demand, not metered residential exports. Real peer sales, delivery assurances, medical backup, and billing would require a utility program and human oversight. The closing claim about lower bills is a potential benefit dependent on actual time-of-use tariffs and load timing.

The main controls also allow **Grid overload**, **Storm warning** (70% reserve floor), **Communication loss** (50 unverified batteries), **Battery failures** (25 failed units), and combinations. Inspect homes in the 3D map or searchable Fleet table, approve simulated actions, acknowledge dispatcher escalation, and download JSON evidence. Everyday mode requests a 28 kW peak reduction.

## Accounting and constraints

- 100 seeded households; random seed 42.
- Capacity reference: 39.2 kWh per unit, from [Base Core specifications](https://www.basepowercompany.com/specs/core). All other energy values, health, critical status, device status and consents are fictional.
- Stored energy = capacity × state of health × state of charge.
- Decision horizon: 15 minutes. Discharge efficiency: 95%. No cumulative time simulation.
- Essential consumption is never eligible for deferral. EV and household reductions require consent. Battery dispatch requires separate consent and verified telemetry.
- Discharge is capped by power, energy above reserve, and the home's remaining total demand. No metered battery exports are modeled. Battery energy consumed = dispatch kW × 0.25 h ÷ 0.95.
- Battery communication loss does not disable the separately modeled, verified EV and voluntary-demand channels.
- If a storm reserve target exceeds present charge, the battery retains all existing energy and cannot dispatch. The model does not claim it can create missing reserve energy.
- Objective: meet as much support as feasible, then minimize modeled disruption using EV deferral, voluntary reductions, and eligible batteries in that order.
- The baseline sheds fixed 10-home circuits in ID order until support is met. Proposed interruptions apply the same rule to remaining net load after coordinated support. Circuits are synthetic. Estimated interruptions are scenario comparisons, never executed commands.
- Median backup hours = post-dispatch energy × 95% ÷ essential load, across verified batteries only. Changes in the verified population can change the median.
- For overload alone, baseline 30 interrupted homes versus 0 proposed; with battery communication loss, baseline 30 versus 10 proposed. These are model estimates, not measured real-world impacts.

## Geographic data and attribution

The 100 household markers sit on real residential building footprints in Mueller, Austin, around Ruiz Street, Page Street, and Robert Browning Street. House elevations, roof treatments, and trees are stylized. Participation, equipment ownership, and energy data are entirely fictional.

Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), available under the [Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/). The derived geographic data is distributed in `public/neighborhood.json` under ODbL 1.0, including its source URL and retrieval date. No USDA or USGS imagery was used.

## Verification

`engine/test_simulator.py` checks all 32 scenarios for consent, exclusion of unverified and failed capacity, protected reserves, energy accounting, demand limits, reproducibility, and the neighbor allocation as a subset of existing safe dispatch. The launch sequence and entry/replay handoff were checked in a browser, as were the earlier dashboard flows: EV/TV close-ups, four progressive approvals, ledger settlement, scenario comparison, and the final fade-in.
