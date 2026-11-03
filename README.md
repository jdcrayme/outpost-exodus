# OUTPOST // EXODUS — Mission Start Sequence

A recreation of the three mission-start screens from Sierra's **Outpost** (1994) —
destination star select, seed-ship payload manifest, and VLBI probe planet survey —
styled after the **instrument displays of the Discovery One** from *2001: A Space
Odyssey*: data-heavy, clean lines, elegant arcs, beautiful math.

The visual language: ivory vector lines plotted on near-black, phosphor-green for
live and computed data, amber for caution, red reserved for genuine alerts. Fine
engineering graph-paper grids, circular needle gauges, oscilloscope waveforms and
Lissajous figures. HAL is present as a **voice channel** — a green waveform on the
comm panel — not as a red eye.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · custom
HUD primitives (canvas / SVG / Web Audio — no component library)

## Quick start

Requires Node.js 20+ (npm is enough) or Bun 1.1+.

```bash
npm install      # or: bun install
npm run dev      # or: bun run dev
```

Then open **http://localhost:3000**.

> Audio is synthesized live with the Web Audio API (no sound files). Browsers block
> auto-playing audio, so click the page once to let the synthesizer come online.

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload on port 3000 |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |

## Deploy to Vercel

The app is fully client-side — no environment variables, no database, no API keys.
The fastest route:

1. Push this repository to GitHub, GitLab, or Bitbucket.
2. Go to [vercel.com/new](https://vercel.com/new) and **Import** the repository.
3. Vercel auto-detects Next.js; the included `vercel.json` pins the install
   (`npm ci`) and build (`npm run build`) commands, and `.node-version` pins
   Node 22. Click **Deploy** — nothing else to configure.

Or from the terminal: `npm i -g vercel && vercel` (run inside this directory),
then `vercel --prod` when you're happy with the preview.

## Mission sequence

The app is a single state machine, owned by `src/app/page.tsx`:

`INTRO → BOOT → STAR → EQUIP → TRANSIT → PLANET → PROFILE`

0. **INTRO** — title card: the 2096–2098 impact prologue fades in over a drifting
   starfield, then the OUTPOST // EXODUS logo blooms in — skippable
1. **BOOT** — cold-start diagnostics: the boot log scrolls in, then rolls up as the
   9000's neural pattern stabilizes on a scope and the initiate button appears
2. **STAR** — destination star select from the catalog
3. **EQUIP** — seed-ship payload manifest with mass/power budget
4. **TRANSIT** — transit plot: conic transfer arc, Kepler-solved ship marker, live
   vis-viva equation (typeset with KaTeX) and streaming telemetry
5. **PLANET** — VLBI probe planet survey; choose a landing site
6. **PROFILE** — final mission profile; HAL signs off with his waveform

## Project layout

```
src/
  app/                  # layout.tsx, page.tsx — page.tsx owns the mission state machine
  screens/              # one folder per phase screen, private widgets colocated:
                        #   intro/           — title card: impact prologue + vector
                        #                     logo + drifting starfield (skippable)
                        #   boot/           — cold-start diagnostics
                        #   star-select/    — StarSelect + Starfield3D (3D local neighborhood)
                        #   equipment/      — EquipmentScreen + ShipBlueprint
                        #                     (general-arrangement loadout drawing:
                        #                     Whipple shield, cargo ring, 12
                        #                     distributed cold-sleep bays,
                        #                     radiators, aft fuel; 3 camera
                        #                     presets, 207 berth dots,
                        #                     true-scale human, title block)
                        #   transit/        — TransitScreen + TransitPlot
                        #                     (Kepler-solved arc, live vis-viva plate)
                        #   planet-select/  — PlanetSelect + OrbitMap (system chart)
                        #   profile/        — final mission profile
  components/common/    # instrument widgets shared across screens:
                        #   HudPanel — panel chrome (HudButton, DataRow, Gauge) + ArcGauge
                        #   Lissajous — the 9000's neural pattern display
                        #   PlanetScan — VLBI surface scan
                        #   TypeLine/CrtOverlay — typewriter dialogue / CRT overlay
                        #   PhaseDial — header mission-phase ring
                        #   Waveform — HAL's voice channel oscilloscope
  lib/mission/          # pure data + math, no React:
                        #   stars.ts      — star catalog
                        #   equipment.ts  — payload manifest
                        #   engine.ts     — deterministic seeded planet generation
                        #   astro.ts      — conic sections, Kepler solver, vis-viva
                        #   hal.ts        — HAL dialogue lines
                        #   audio.ts      — Web Audio synthesizer
public/fonts/           # self-hosted IBM Plex Mono
docs/DESIGN_NOTES.md    # design charter, decisions, and roadmap record
```

## Notes

- Everything is drawn at runtime — canvas starfields and orbit maps, an SVG trajectory
  plot, procedural audio. No image or audio assets, no API keys, works fully offline.
- The interface layer lives in `src/app/globals.css` (`ink` = ivory structure,
  `phos` = phosphor live data) plus the instrument components above.
