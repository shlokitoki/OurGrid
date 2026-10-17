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

The overview now introduces the problem, response, and proof in three compact panels. **Run live demo** plays an eight-step, approximately 30-second story: a balanced neighborhood; a 150 kW shortfall from an evening spike; 31.81 kW of opted-in EV deferral; 26.14 kW of pre-consented household reduction; 92.05 kW of verified battery support; 50 battery links going silent; a recalculated plan; and dispatcher review of the remaining 14.64 kW. The counter, impact comparison, roof colors, and demand chart update with each step. You can pause or jump between steps.

Animated arcs on the 3D map show **illustrative released capacity**, not actual wires or the direction of physical electricity flow. The camera moves toward an example EV, voluntary-response home, safely dispatched battery, and failed connection. The neighborhood uses real Mueller, Austin building footprints with fictional household data.

The main scenario controls also allow **Grid overload**, **Storm warning** (70% reserve floor), **Communication loss** (50 unverified batteries), **Battery failures** (25 failed units), and combinations. Inspect a home in 3D or in the searchable Fleet table; approve simulated actions, acknowledge dispatcher escalation, and download full JSON evidence. Everyday mode requests a 28 kW peak reduction. No price or monetary savings are claimed without a tariff or rebound model.

## Accounting and constraints

- 100 seeded households; random seed 42.
- Capacity reference: 39.2 kWh per unit, from [Base Core specifications](https://www.basepowercompany.com/specs/core). All other energy values, health, critical status, device status and consents are fictional.
- Stored energy = capacity × state of health × state of charge.
- Decision horizon: 15 minutes. Discharge efficiency: 95%. No cumulative time simulation.
- Essential consumption is never eligible for deferral. EV and household reductions require consent. Battery dispatch requires separate consent and verified telemetry.
- Discharge is capped by power, energy above reserve, and the home's remaining total demand. No battery exports are modeled. Battery energy consumed = dispatch kW × 0.25 h ÷ 0.95.
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

`engine/test_simulator.py` checks all 32 scenarios for consent, exclusion of unverified and failed capacity, protected reserves, energy accounting, demand limits, reproducibility, and the demo narrative. The page was checked in a browser at desktop and mobile sizes, including scenario combinations, household selection, consent details, approval and escalation.
