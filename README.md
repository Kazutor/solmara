# SOLMARA — Streets of the Sun Coast

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Kazutor/solmara/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Kazutor/solmara/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original top-down open-world crime game set in the invented sun-soaked
city of **Solmara**. No part of it comes from any commercial game: the city,
districts, characters, vehicles, story, art, sounds and music are all
original, drawn and synthesized by the game's own code.

## The story

Rico Vega is back in Solmara with empty pockets and a long list of people to
pay back. Across five missions — from stealing a first set of wheels to the
Marina Bay vault job — Rico works for Luz, the fixer of Neon Row, while the
SCPD (Solmara City Police Department) closes in.

## The city

Solmara is a 4800×3600 open world with six districts: **Palm Heights**,
**Old Town**, **Neon Row**, **Harbor Park**, **The Docks** and **Marina Bay**.
It has a road grid with sidewalks and crosswalks, a park with a pond, a plaza
fountain, a beach with animated water, dock warehouses, billboards and palm
trees. Traffic follows the lanes and stops for the car ahead; pedestrians
stroll the sidewalks and flee from gunfire.

## Vehicles

Five original models: the **Viento** sedan, the **Cometa GT** sports car, the
**Bison** van, the **SolCab** taxi and the **SCPD Interceptor** police car.
Walk up to any car and press **E** to steal it — its driver bails out and
runs. Cars take damage, catch fire and explode.

## Wanted level

Stealing cars, shooting and hurting pedestrians raise your heat from 0 to 5
stars. Police cars chase and ram you; at 3 stars and above, foot cops get out
and shoot. Lay low out of sight and the heat cools, or hold **F** on the
**QuickFix** garage forecourt ($150) to repair your car and clear up to 2
stars.

## Missions

1. **First Wheels** — steal a car.
2. **The Courier** — deliver a package to Neon Row in 90 seconds.
3. **Dockside Heat** — fight four guards at the docks and grab the case.
4. **Hot Pursuit** — survive a 45-second chase, then lose the police.
5. **The Payday** — hit the Marina Bay vault and reach the getaway marker.

Missions can be replayed from the Missions menu, and Free Roam lets you
explore Solmara with no objectives. Progress saves in `localStorage` after
every completed mission.

## Combat and collectibles

Pistol with infinite ammo, plus an SMG pickup with 120 rounds. Mouse aim,
tracers, muzzle flash, explosions and burning cars. Pickups for health,
armor, cash and SMG ammo, plus **10 hidden Solmara Stars** worth $150 each.

## Controls

| Input | Action |
| --- | --- |
| W A S D / arrows | Walk / drive |
| Mouse | Aim |
| Click | Shoot |
| E | Steal / exit car |
| Space | Handbrake |
| F (hold, at QuickFix) | Repair and clear wanted stars ($150) |
| Esc / P | Pause |
| M | Mute |

## HUD

Wanted stars, health and armor bars, cash, current district, speed, a live
minimap (mission marker in gold, police blips in blue), an off-screen
objective arrow and a crosshair.

## How to run

```sh
node serve.ts
```

Then open <http://localhost:8080> in desktop Chrome. The game is plain
static files under `game/` — Canvas 2D and synthesized WebAudio only, no
libraries, no build step, no network requests at runtime.

## Screenshots

Deterministic staged scenes are available through URL queries, so the
screenshots are reproducible:

- `?shot=start` — title screen over the city
- `?shot=play` — driving the Cometa GT on a courier run, wanted level 2
- `?shot=chase` — a 4-star police chase
- `?shot=end` — mission complete screen

## Files

- `game/index.html` — page and menus
- `game/style.css` — menu styling
- `game/js/util.js` — seeded RNG, math, saves
- `game/js/audio.js` — synthesized sound and music
- `game/js/world.js` — the city: districts, roads, buildings
- `game/js/state.js` — game state, car models, spawning
- `game/js/entities.js` — movement, traffic, police, combat
- `game/js/missions.js` — story and the five missions
- `game/js/render.js` — canvas drawing of the city and effects
- `game/js/hud.js` — HUD, minimap, objective arrow
- `game/js/main.js` — boot, input, camera, game loop, shot modes

<sub>Entered on [make.fun](https://make.fun/?ref=5v28zqbf&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
