# OUTPOST // EXODUS — Mission Start Sequence

A recreation of the three mission-start screens from Sierra's **Outpost** (1994) —
destination star select, seed-ship payload manifest, and VLBI probe planet survey —
in the visual style of HAL 9000 from *2001: A Space Odyssey*.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui

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

## Mission sequence

The app is a single state machine, owned by `src/app/page.tsx`:

`BOOT → STAR → EQUIP → TRANSIT → PLANET → PROFILE`

1. **BOOT** — cold-start diagnostics; HAL's eye comes online
2. **STAR** — destination star select from the catalog
3. **EQUIP** — seed-ship payload manifest with mass/power budget
4. **TRANSIT** — transit plot: conic transfer arc, Kepler-solved ship marker, live
   vis-viva equation (typeset with KaTeX) and streaming telemetry
5. **PLANET** — VLBI probe planet survey; choose a landing site
6. **PROFILE** — final mission profile

## Project layout

```
src/
  app/                  # layout.tsx, page.tsx — page.tsx owns the mission state machine
  components/mission/   # the screens and widgets (StarSelect, EquipmentScreen,
                        #   PlanetSelect, TransitPlot, HalEye, OrbitMap, …)
  components/ui/        # shadcn/ui primitives — copied in, fully owned, edit freely
  lib/mission/          # pure data + math, no React:
                        #   stars.ts      — star catalog
                        #   equipment.ts  — payload manifest
                        #   engine.ts     — deterministic seeded planet generation
                        #   astro.ts      — conic sections, Kepler solver, vis-viva
                        #   hal.ts        — HAL dialogue lines
                        #   audio.ts      — Web Audio synthesizer
  hooks/
public/fonts/           # self-hosted Michroma + IBM Plex Mono
```

## Notes

- Everything is drawn at runtime — canvas starfields and orbit maps, an SVG trajectory
  plot, procedural audio. No image or audio assets, no API keys, works fully offline.
- `src/lib/db.ts`, `prisma/`, and the `db:*` scripts are unused template scaffolding;
  this app is entirely client-side. If your editor flags `db.ts`, run
  `npm run db:generate` — or just ignore it.
