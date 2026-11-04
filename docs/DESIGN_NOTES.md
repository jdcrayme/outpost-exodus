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

`INTRO → BOOT → STAR → EQUIP → CREW → TRANSIT → PLANET → PROFILE` (state machine in
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
4. **CREW** — the roster of record, arranged by cohort (see §4): the
   cold-sleep chain drawing navigates; the dossier rides the right rail.
5. **TRANSIT** — conic transfer arc, Kepler-solved ship marker, live vis-viva
   plate, streaming telemetry.
6. **PLANET** — VLBI survey: system chart, candidate world list, landing
   dossier with gauges. No probe = blind landing (mass and orbit only).
7. **PROFILE** — final mission profile; HALCYON signs off with his waveform.

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
  (3 + 12×17 = 207, rack addresses validated). The crew manifest (§4,
  done) and the planned hangar view consume the same table.
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

## 4. Crew manifest — DONE (REV C, portraits) · wake-order — ROADMAP

**Concept** (realized): the 207 colonists are frozen in **cohorts with skill
distributions**; the manifest is a reading room, not an editor.

**Implementation** (`src/lib/mission/crew.ts` + `src/screens/crew/`):

- **Coverage doctrine**: every cohort carries all eight civilizational
  functions (physician, agronomist, fabricator, power engineer, geologist,
  teacher, ecologist, geneticist) — berth 01 is the cohort senior, berths
  02–09 the core eight (shuffled per cohort), berths 10–17 a weighted fill
  pool. **Asserted at module load**, not assumed: count, per-cohort coverage,
  senior-on-berth-01, roster-wide name uniqueness — a bad pool throws at
  import, it cannot silently mis-muster.
- **Address-keyed determinism**: every member's seed derives from their berth
  address (`C-04:07`), so flavour fields (name, age, origin, record) can be
  re-curated without reshuffling faces or coverage. Only the seed is stored;
  everything regenerates. Same crew — forever (charter §1).
- **The screen** (phase 03, between payload and transit): a **cold-sleep
  chain strip** (DWG OE-105-CS, same frame as the GA drawing — the strip is
  just the origin shifted) that is the cohort navigator — hover a bay for
  station data in the status line, click it to jump to its cohort panel;
  watch + twelve cohort panels; a right-rail **dossier** with record of
  service, skill axes (the trade's mastery axis in phos), and the mustered
  **portrait plate** with the face code hex line beneath — the same 32
  bits, read two ways (the Elite (1984) homage, grown up; the pre-portrait
  8×4 registration strip is retired). Bus B renders
  only when the reserve battery is aboard — same rule as the GA drawing.
- Crew stats strip: average age, F/M, coverage ×12 — all computed from the
  roster, asserted at load.
- **Portraits** (REV C, `src/lib/mission/portraits.ts` + `Portrait.tsx`):
  the member seed read as a mustered photograph — one `FaceSpec` per member
  (every layer decision, scale-independent), painted as a 48×48 dossier
  plate and a dedicated 16×16 roster thumbnail. Layer stack: role collar,
  the only color (phos pips for the core eight, phos bar for seniors,
  amber braid for the watch) · six head silhouettes · skin as Bayer-4
  dither density with photographic lighting (lit T-zone, shadowed jaw;
  tone from the full human range uniformly — nothing keys off name, origin
  or region) · solid two-tone feature glyphs in polarity ink with an
  opposite-ink halo (light faces get open eyes — solid dark pads read as
  sockets) · 18 presentation-lean hair styles with age-scaled salt
  stipple and a guaranteed hair/skin tone separation · age lines driven
  by the record's age · phos cryo sensor marks at the temples (cohort
  members only). Each layer draws from its own RNG stream keyed off the
  member seed — re-curating the hair library can never reshuffle eyes.
  REV C tonal calibration: the first cut mapped tone→density linearly and
  rimmed every head in solid ivory, which washed the whole roster white —
  at 2× pixel fusion a 35–50% ivory dither on black reads light, and the
  darkest face on the sheet still measured ~35% ivory. Now the uniform
  tone draw passes through a perceptual transfer curve (u^1.45, range
  0.08–0.92) so the full range reads; rims dither one step brighter than
  their field instead of solid ivory; the T-zone lift on dark faces is
  0.35 (was 0.7); and hair/skin separation pushes hair *down* (near-black
  hair against brown skin reads by texture — REV B's upward push painted
  a light cap on every dark face). At 16 px the thumbnail quantizes to
  flat two-tone icons (dither reads as static below ~32 px; 2×2
  polarity-quantized eye blocks; the cut sits at 0.45 so the icons split
  ~45/55). Doctrine
  asserted at module load: spec determinism, painter purity (sampled),
  role→collar totality, cryo consistency, ≥150 distinct faces (207
  observed). The dossier plate reveals top-to-bottom with a phosphor
  read cursor (draw-on language, respects reduced motion); roster rows
  carry the thumbnail. The §7 art-direction question is resolved: the
  file stays 1-bit ink-on-black; color appears only on the uniform.

**Still roadmap**:

- **Wake-order as a resource-timing puzzle**: command crew (3) wakes
  automatically at system entry (HALCYON holds mid-transit); geology and
  heavy-industry cohorts stay frozen until probe data or landfall demands
  them. Each thaw carries a **failure risk scaled by years in transit** —
  waking people is a medical procedure, not an alarm clock. Shares the
  budget UI language with the payload screen.
- Open question stands: schedule wakes **during transit** (planner on the
  transit screen) or resolve as events after arrival — or both.

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
| `src/lib/mission/ship.ts` | ship architecture — `STOWAGE`, `BAYS`, `RACK`; shared by the blueprint, the crew manifest, and the future hangar view |
| `src/lib/mission/crew.ts` | the 207-soul roster — coverage-guaranteed cohorts, address-keyed seeds, load-time assertions |
| `src/lib/mission/portraits.ts` | procedural mustered photographs — `FaceSpec`, 48/16 painters, load-time doctrine |
| `src/screens/crew/` | crew manifest — `BayChain` navigator strip, `CrewDossier` + `Portrait` plates, roster rows with thumbnails |
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
- Multiplayer/archive hook: publish the final mission profile as a shareable
  seed string?
