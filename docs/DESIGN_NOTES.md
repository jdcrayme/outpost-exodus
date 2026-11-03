# OUTPOST // EXODUS — Design Notes

Working design record for the Sierra *Outpost* (1994) first-levels recreation.
This file records the aesthetic charter, the decisions already baked into the
build, and the roadmap items we have agreed on — with the reasoning — so future
sessions can pick up the thread without re-deriving it.

---

## 1. Aesthetic charter — "the screens of the Discovery"

The guiding brief, refined from the original "in the style of HAL 9000":

> **In the style of the screens of the Discovery from *2001: A Space Odyssey*.
> Data heavy, with clean lines, elegant arcs and beautiful math.**

HAL's red eye is **not** the motif. HAL exists as a *voice channel* — a green
waveform on the comm panel and typewritten dialogue — nothing more.

Concrete rules derived from that brief:

- **Ivory vector lines on near-black** (`ink` = `#e8e6dc`) for all structure and
  hull geometry. **Phosphor green** (`phos` = `#7beba6`) exclusively for live,
  computed, or measured data. Amber for caution. Red for genuine alerts only.
- **Everything is drawn, not painted** — canvas starfields and orbit maps, SVG
  trajectory plots and blueprints, procedural Web Audio. No raster art, no image
  assets, no sprites. The machine renders itself.
- **Engineering-document furniture everywhere**: graph-paper underlays,
  graduated tick rulers, dimension lines with extension lines and arrowheads,
  title blocks (DWG number, REV letter, scale), leader-line callouts, station
  (STA) coordinates. The interface should read like a TRW systems diagram that
  happens to be alive.
- **Real math on display**: Kepler-solved transfer arcs, the vis-viva equation
  typeset in KaTeX, Lissajous figures as neural patterns, conic sections.
  Numbers on screen must be *true to the simulation behind them*.
- **Determinism over storage**: everything regenerates from fixed seeds
  (`mulberry32` + `hashString` in `src/lib/mission/engine.ts`). Same star,
  same planets, same crew — forever.
- Lettering is a single family: **IBM Plex Mono** (self-hosted), wide-tracked,
  set like plotter annotation. Display text is the same mono at weight 600.

Animation pacing rule of thumb (learned the hard way): instrument displays move
*slowly*. Orbital motion on charts ~0.1× of what feels natural in a game UI;
starfield auto-rotation ~0.2×. The Discovery's displays drift; they never race.

---

## 2. Current state of the mission sequence

`INTRO → BOOT → STAR → EQUIP → TRANSIT → PLANET → PROFILE` (state machine in
`src/app/page.tsx`):

0. **INTRO** — title card: the 2096–2098 impact prologue (the old boot prelude,
 relocated) fades in line by line over a drifting starfield; the OUTPOST //
 EXODUS logo is drawn as vector geometry — planet limb, amber corona bloom,
 traced rim light. Skippable (button, key, or click).
1. **BOOT** — cold-start diagnostics: the boot log scrolls in line by line, then
   rolls up out of the way as HALCYON's neural pattern stabilizes on a
   Lissajous scope and the initiate button appears.
2. **STAR** — destination select: 16-star catalog, interactive 3D local
   neighborhood (drag to rotate), dossier with transit solution.
3. **EQUIP** — payload manifest over a **general-arrangement blueprint**
   (see §3).
4. **TRANSIT** — conic transfer arc, Kepler-solved ship marker, live vis-viva
   plate, streaming telemetry.
5. **PLANET** — VLBI survey: system chart, candidate world list, landing
   dossier with gauges. No probe = blind landing (mass and orbit only).
6. **PROFILE** — final mission profile; HALCYON signs off with his waveform.

---

## 3. DONE — Blueprint loadout (general arrangement screen, REV E)

**Goal**: restore what the original game's loadout screen did — modules
appearing and disappearing *on the ship*, giving a sense of scale — without
abandoning the vector/instrument language. REV E rebuilds the ship itself
from a fusion-ark reference: debris shield, cargo ring along the front of the
spine, distributed sleeper bays, deployable radiators, fuel in the back.

**Implementation** (`src/screens/equipment/ShipBlueprint.tsx` +
`src/lib/mission/ship.ts`):

- A **side elevation of the Exodus drawn as an engineering general-arrangement
  drawing** in SVG, 1 user unit = 1 metre, 225 m overall. Sections fore → aft:
  - **Whipple debris shield** — three-plate stack, 26 m tall, on standoff
    struts ahead of the command sphere. Two faint dashed lines draw the
    **debris shadow cone** it casts down the spine; every berth lives inside
    it. At 0.1 c a paint flech is a bomb — the shield is the reason there is
    a front of the ship at all.
  - **Command sphere** (3 watch berths) directly behind the shield.
  - **Cargo ring** — 44 container cells in four rows (D2/D1/V1/V2) racked
    around the forward spine, **deliberately outboard of the shadow**: the
    cargo is the outermost sacrificial mass between the shield and everything
    that matters. (The reference's "solar panels" are read as radiators —
    solar flux is ~nothing at interstellar distances; physics upgrade.)
  - **Twelve cold-sleep bays** strung along the centreline inside the shadow
    cone — **one cohort (17 souls) per bay**, staggered clock positions,
    alternating A/B power buses, 0.95 m of open truss between neighbours: no
    single catastrophe — strike, fire, bus loss — reaches a second bay.
    12 × 17 = 204 sleepers + 3 watch = 207, asserted against `CREW_COUNT` in
    `ship.ts` so the drawing and the mission log can never drift apart.
  - **Deployable radiators** — 2×2 wing on hinge masts amidships (retract for
    burn), amber tip lights.
  - **Aft fuel** — six copper D-He³/deuterium spheres on a tank truss plus two
    **departure drop-stages** (dashed jettison marks: they go at the Jovian
    assist, tying the drawing to the astrodynamics in `astro.ts`).
  - Neutron shadow shield, fusion drive, three bells.
- **Stowage is data**: `src/lib/mission/ship.ts` holds the architecture —
  `STOWAGE` (per item: rack cells like `D1-06`, a strongback dock at a STA,
  or fitted-to-bays), `BAYS`, `RACK` — with module-level arithmetic checks
  (3 + 12×17 = 207, rack addresses validated). The planned hangar view and
  crew manifest (§4) consume the same table.
- **Camera** — three viewBox presets, **FULL SHIP / CARGO RING / CRYO BAYS**,
  tweened imperatively with rAF (950 ms, eased; instant under
  prefers-reduced-motion). The screen opens on the establish shot; the first
  loadout action pushes in to the cargo ring (where the work is); the
  segmented control in the status line is always available. A **LOD layer**
  (cargo stamps, per-bay telemetry, plumbing labels) fades in whenever the
  camera is in close.
- **The 204 berth dots remain individually countable** — 17 per bay (9 + 8),
  twelve bays, 3 watch berths in the sphere, with a slow scan sweep cycling
  down the chain. A colony you can count is worth more than any render.
- Containerized cargo stows as **highlighted cells with stamped codes**;
  landers, the SPS, the reactor and the VLBI probe keep their **procedural
  silhouettes** at strongback docks (probe on a launch cradle at the bow).
  The cold-sleep reserve battery renders as **per-bay packs plus a redundant
  phos bus** through the whole chain — redundancy you can see.
- Hover (drawing ↔ manifest, cross-highlighted) shows station data in the
  status line — rack address or STA, mass, reliability, power; hovering a bay
  shows its cohort, souls, cryo setpoint and bus. Clicking docked hardware
  dismounts it.
- **Scale**: 1.76 m human figure at true scale next to a 0–5–10 m bar.
- **Title block**: DWG OE-104-GA · **REV E**, live ticking mass readout, CREW
  207 · 12 BAYS × 17.
- Mass readouts **tick** like fuel gauges (rAF-eased counters) rather than snap.

**Why silhouettes, not 3D models or sprites** (decision record):

- Sprite/raster art fights the established vector language; 3D needs an asset
  pipeline and lighting model we deliberately don't have.
- A line-art elevation reads as "engineering document", which is the brand.
- The door is *not* closed on 3D: if we add a rotating "hangar view" later, the
  drop-in spec is **GLB/GLTF, one mesh per module class, <5k tris, origin at
  the docking interface, 1 unit = 1 m**. The blueprint and the hangar view
  would share the same MOUNTS table.

---

## 4. ROADMAP — Crew manifest, cohorts & procedural portraits

**Concept**: the 207 colonists are frozen in **cohorts with skill
distributions**; waking a cohort is a game mechanic (they consume power, food,
life support while awake).

- **Command crew (3)** wakes automatically at system entry.
- Geology/heavy-industry cohorts stay frozen until probe data or landfall
  demands them; medical and command-adjacent skills wake earlier.
- Each thaw carries a small **failure risk scaled by years in transit** —
  waking people is a medical procedure, not an alarm clock.
- Wake-order becomes a resource-timing puzzle sharing the same budget UI as the
  payload screen.

**Generation approach** (Elite 1984 homage — 2⁴⁸ faces from a fixed seed):

- `crew.ts` in `lib/mission/`, seeded from the mission: name (curated
  multi-region lists), age, role, 5–6 skill axes, cohort/bay assignment,
  one-line service record. **Store only the seed**; regenerate on demand.
- **The bay layout is already drawn** (REV E): `BAYS` in `ship.ts` (12 bays ×
  17 souls, alternating buses, staggered clock positions) is the join key for
  cohort/bay assignment — the manifest plugs straight into the drawing.
- **Portraits: layered procedural pixel art, 48×48, nearest-neighbor upscale**:
  head shape × skin tone × hair × eyes × age lines × uniform collar with role
  pips. One rendering function per layer — style is consistent by construction.
- Each colonist's dossier shows their **face code in hex** (the seed), a direct
  nod to Elite's commander faces.
- Effort estimate: manifest ~½ day; portrait layer curation ~1 day.

---

## 5. ROADMAP — In-system probe campaign

**Concept**: after the flyby probe's coarse data, allocate **dedicated mapping
and sampler probes** during transit (gives the long-transit screen something to
do); their data layers resolve on approach.

What colonists actually want, mapped to real instrument classes:

| Probe | Instrument analog | Buys | Feeds |
| --- | --- | --- | --- |
| Orbital mapper | MRO / HiRISE camera + radar altimeter | topography, slopes, boulder fields | landing-site safety |
| Atmosphere entry profiler | aeroshell spectrometer train | composition, pressure/wind profile, dust loading | EDL risk, agriculture options |
| Deep penetrator | Deep Space 2 impactor | subsurface ice, thermal gradient | water inventory |
| Volatiles orbiter | neutron spectrometer | hydrogen distribution | ISRU siting |
| Radiation/magnetometer orbiter | particle + magnetometer suite | belt mapping | regolith shielding depth |
| Relay satellite | comms | surface ops radius | colony automation |

**Design hook — probes cost payload mass on the equipment screen**: certainty
vs cargo is the trade. And probe results can **contradict the flyby estimate**
(the atmosphere measured at 0.8 atm on flyby reads 0.3 atm on entry) — probes
buy *certainty*, not just data. Land blind and every unknown becomes a
colony-start risk event drawn from the seed.

---

## 6. Conventions & file map

| Token / file | Meaning |
| --- | --- |
| `ink` `#e8e6dc` | ivory structure lines |
| `phos` `#7beba6` | phosphor live data |
| `hal-mono` / `hal-display` | IBM Plex Mono body / weight-600 annotation |
| `src/app/globals.css` | instrument layer: grid-paper, CRT overlay, draw-on, blueprint classes (`bp-*`) |
| `src/lib/mission/engine.ts` | `mulberry32`, `hashString`, seeded system generation |
| `src/lib/mission/equipment.ts` | payload catalog + capacities |
| `src/lib/mission/ship.ts` | ship architecture — `STOWAGE`, `BAYS`, `RACK`; shared by the blueprint and the future hangar view/crew manifest |
| `src/screens/intro/` | title card — prologue beats, vector logo, drifting starfield; pacing constants at the top of `IntroScreen.tsx` |
| `src/screens/equipment/ShipBlueprint.tsx` | GA drawing + camera presets + `useTickNumber` |
| `src/components/common/` | shared instrument widgets (HudPanel bank, Lissajous, PlanetScan, TypeLine); one folder per screen under `src/screens/` |

UI text is uppercase mono with wide tracking; warnings never shout in red
unless they are real; every panel has a code (`SEC.ORB`, `OE-104-GA`...) —
the ship is a document, and documents have drawing numbers.

---

## 7. Open questions

- Should waking cohorts be scheduled **during transit** (planner on the transit
  screen) or resolved as events after arrival — or both (plan vs. reality)?
- Do probe results get their own screen between PLANET and PROFILE, or layer
  into the existing dossier?
- Portrait art direction: pure 1-bit ink-on-black (matches the charter) vs
  limited phosphor/amber accents on 48×48?
- Multiplayer/archive hook: publish the final mission profile as a shareable
  seed string?
