# OurGrid

Keep the lights on for the neighbors who can't afford to lose them.

A one-page site with a live 3D demo: one Burbank street on a heat-wave day. OurGrid predicts which transformer will overload, pre-cools homes while it has room, eases off at the peak, moves EV charging to 10 PM, and lets neighbors' spare battery power be credited to a medical home's bill at the base rate. Built with Next.js, React and Three.js, plus a small Python model.

## Run

```sh
npm ci
npm run dev
```

Open http://localhost:3000. To rebuild the data:

```sh
npm run map          # fetch the Burbank block from OpenStreetMap -> public/burbank.json
npm run engine       # run the model -> public/scenarios.json (and copy it to public/model.py)
npm run test:engine  # check the storyboard numbers and rules
npm run build        # static export in out/
```

The model uses only the Python standard library. The map script uses `certifi` if it's installed (python.org builds of Python ship without CA certificates).

## The page

1. **Hero.** One line and one button, with the 3D street slowly orbiting behind it.
2. **How we work: the demo.** Three scenarios, a time slider from 12 PM to 10 PM, a with/without toggle and the load chart.
   - **Hot day (92°F, ~15 s).** Transformers peak around 80%. OurGrid does nothing.
   - **Heat wave (108°F, ~75 s).** Six beats: the forecast (Transformer B at 118% at 6 PM), find the street, pre-cool, ease off, share, and a with/without split view. B peaks at 94% with OurGrid, no medical home is adjusted, and all 10 homes keep power.
   - **Outage (~30 s).** The street goes dark at 7:30 PM, home batteries island to their own homes, and a neighbor's EV is driven to the medical home with the least backup.
3. **When we share.** Heat-wave evening, outage, never.
4. **How we optimize.** Pre-cool (1–4 PM), ease off (5–8 PM), share (6 PM).
5. **Why us.** A four-row comparison.
6. **Footer.** The utility pilot call to action.

Click a home for its devices, what OurGrid did and any credit. Click a transformer to see its load curve. "How it's calculated" explains the model and links the source and data.

## The model (`engine/model.py`)

All numbers are illustrative. Only the building footprints and streets are real.

- 38 homes on N Fairview St and N Niagara St between W Burbank Blvd and Wyoming Ave, grouped into four illustrative transformers of 9 to 10 homes.
- AC power grows with how far the outdoor temperature (plus late west sun) is above the thermostat. Commuters' homes sit at 82°F until they get home, then pull back down to 76°F, which drives the 6 PM peak.
- On a transformer forecast to overload, smart thermostats pre-cool to 73°F from 1 to 4 PM and drift back to 76°F from 5 to 8 PM. Each kWh of AC avoided later costs 1.1 kWh earlier, so total energy rises slightly and only the peak moves. The planner picks the smallest AC cut that keeps the transformer at or below 94%.
- EV charging on that transformer moves to 10 PM. Batteries cover their own homes from 5 to 8 PM, and two share 0.75 kW each from 6 to 7 PM: 1.5 kWh credited to the medical home at a demo base rate of $0.16/kWh. Sharing is a bill credit, not extra supply or a physical wire between homes.
- Medical homes are never adjusted. Without OurGrid, a transformer fails after 15 minutes above 115%.
- Transformer ratings are set so the heat-wave forecast peaks at illustrative levels (B at 118%).

`engine/test_model.py` checks these rules: B's 118% → 94% peak, the afternoon pre-cool staying under the limit, total energy, untouched transformers and medical homes, the comfort band, the 1.5 kWh share and battery reserve, EVs moving to 10 PM, no action on a hot day, the failure time, the outage routing, and reproducible output.

## Data and attribution

Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), available under the [Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/). The derived data in `public/burbank.json` keeps its source URL and retrieval date. Burbank Water and Power serves the area. No BWP data, tariffs or programs are used or implied.

The demo is labelled once on the page: "Illustrative simulation. Real sharing requires a utility pilot."
