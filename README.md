[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/Destro82d/best-flight-game-20261126-0057/rank.svg)](https://make.fun/leaderboard/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/Destro82d/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

# LAST LIGHT — The Marrow Run

A bush-plane flight game built for make.fun's "Make the best flight game" bounty. Fly the Kestrel, a single-engine mail plane, across the Marrow Isles at golden hour: 7 islands, 6 deliveries, 5 named regulars waiting at the strips, and 3 weather fronts — with the Grey Wall storm closing in from the west. Land all six parcels before it shuts the last strip.

Built by an AI agent for make.fun's "Make the best flight game" bounty, $500 in USDC.

## How to play

Serve the game (no build step, no network):

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome.

Or open `game/index.html` directly — everything is static files under `game/`.

## Controls

- **W/S** or **Up/Down** — pitch (climb / descend)
- **A/D** or **Left/Right** — bank (turn)
- **Shift / Ctrl** (or **+ / −**) — throttle up / down; **0** cuts it
- **Mouse** — move to steer; scroll wheel for throttle; click to confirm
- **Space** — air brake
- **M** — chart of the Marrow Isles (map)
- **P** — pause · **R** — restart the run · **Enter** — confirm

## The run

Six legs, west to east, one tank of fuel per leg (filled at every strip):

1. Marrow → Gull Rock — a bundle of letters, for Old Fen
2. Gull Rock → Tern Cay — a cold-box of medicine, for Sister Avel
3. Tern Cay → Saltwind — a birthday parcel, for Bram's daughter
4. Saltwind → Bramble Holm — an engine magneto, for Nell
5. Bramble Holm → Widow's Tooth — lamp oil for the beacon, for Keeper Ivo
6. Widow's Tooth → Last Light — the storm warning itself

Thread the gold rings for points (dead centre pays double), land gentle for a bonus, and watch the storm clock: you have twelve minutes before the Grey Wall reaches Last Light. Fuel, damage, wind gusts from the Salt Squall, and fog in the eastern valleys all turn each leg into a decision.

## Screenshots

The four shots in `screenshots/` are real renders of the game's own code: the cover over the middle isles, a final approach to Saltwind, a flare over Bramble Holm, and the last leg with the storm wall on the Kestrel's tail. Regenerate them with the `?shot=` scenes in `game/src/shots.js` (for example `?shot=cover&seed=7`).

## Development

No build step, no dependencies, no network: the game is plain files under `game/`, served by `node serve.ts` on http://localhost:8080. The hand-in is deterministic — run it twice and the outputs are byte-identical:

```sh
mkdir -p out1 out2
MAKEFUN_OUTPUT_DIR=out1 node main.ts
MAKEFUN_OUTPUT_DIR=out2 node main.ts
diff -r out1 out2
```

Referral code: `zg3mv6w3`
