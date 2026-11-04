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

## 4. Crew manifest — DONE (REV D, portraits) · wake-order — ROADMAP

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
- **Portraits** (REV D, `src/lib/mission/portraits.ts` + `Portrait.tsx`):
  the member seed read as a mustered photograph — one `FaceSpec` per member
  (every layer decision, scale-independent), painted as a 48×48 dossier
  plate and a dedicated 16×16 roster thumbnail. Layer stack: role collar,
  the only synthetic color (phos pips for the core eight, phos bar for
  seniors, amber braid for the watch) · six head silhouettes · **skin as
  real color** — a uniform draw along a seven-anchor human ramp (deep
  brown → pale), shaded by a light model (lit T-zone, shadowed jaw and
  neck, rim one step lighter) · eyes ×5 with sclera, a weighted iris
  gamut (browns common; hazel, blue, green, grey rarer) and pupil ·
  brows in hair-darkened ink · nose and mouth in tones mixed from the
  skin · 18 presentation-lean hair styles × a weighted human color table
  (black and browns common, blonde, auburn, ginger) with a floored
  lighter rim and age-scaled grey salt · age lines driven by the
  record's age · phos cryo sensor marks at the temples (cohort members
  only). Each layer draws from its own RNG stream keyed off the member
  seed — re-curating the hair library can never reshuffle eyes.
  REV history, kept honest: REV B painted tone as 1-bit Bayer dither
  density and read all-white at a glance; REV C recalibrated the curve
  (measurable spread, still white to the eye); REV D admits the physical
  limit — a 48×48 plate at 2× is below the fusion threshold where
  dither reads as tone, so tone comes from pigment now. The §7
  art-direction question is re-resolved: **the instrument stays 1-bit
  ivory-on-black; the photograph is the one color object on the ship**
  (the collar pips and cryo marks remain the only synthetic colors).
  At 16 px the thumbnail paints solid tones (shading reads as mud at
  icon scale). Doctrine asserted at module load: spec determinism,
  painter purity (sampled), role→collar totality, cryo consistency,
  ≥150 distinct faces (207 observed). The dossier plate reveals
  top-to-bottom with a phosphor read cursor (draw-on language, respects
  reduced motion); roster rows carry the thumbnail.

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

## 5. ROADMAP — The survey campaign & the orbital-first doctrine

The mission is not a landing with support infrastructure; it is an
**orbital industrial colonization** that may — optionally, later — put a
branch office down a gravity well. The survey campaign exists to tell us
which well, and whether.

### 5.1 Campaign waves — what is sent, and when

| Wave | When | What | Data it returns |
| --- | --- | --- | --- |
| 0 — Precursors | 2060s–90s, Earth-launched (canon) | Gram-scale laser sail swarms + precursor interferometry | the coarse system data on the STAR screen — this is where "known worlds" come from; mass/orbit only |
| 1 — The courier | 2098, ship-launched at Jovian departure | The VLBI probe (120 t on a ~380 t torch stage, 0.135 c — it has its OWN exhaust and magsail) | survey-grade imagery from a captured orbit, arriving ~25–30 yr ahead of the ship; its laser downlink overtakes us years before arrival |
| 2 — The micro-swarm | launched from the ship during transit (years 3–10) | The table below — small coasters, one instrument each | one dossier layer per probe, resolving on approach |
| 3 — Arrival infrastructure | system entry, before any surface contact | SEED-robotics: relay constellation, ISRU survey crawlers on the chosen moon/asteroid | the comms/power backbone for everything after |

What Wave-2 colonists actually want, mapped to real instrument classes:

| Probe | Instrument analog | Buys | Feeds |
| --- | --- | --- | --- |
| Orbital mapper | MRO / HiRISE camera + radar altimeter | topography, slopes, boulder fields | landing-site safety |
| Atmosphere entry profiler | aeroshell spectrometer train | composition, pressure/wind profile, dust loading | EDL risk, agriculture options |
| Deep penetrator | Deep Space 2 impactor | subsurface ice, thermal gradient | water inventory |
| Volatiles orbiter | neutron spectrometer | hydrogen distribution | ISRU siting |
| Radiation/magnetometer orbiter | particle + magnetometer suite | belt mapping | regolith shielding depth |
| Relay satellite | comms | surface ops radius | colony automation |

**Design hook — every wave costs payload mass on the equipment screen**:
certainty vs cargo is the trade. Wave-2 results can **contradict the courier**
(the atmosphere the courier read at 0.8 atm reads 0.3 atm on entry) — probes
buy *certainty*, not just data. Land blind and every unknown becomes a
colony-start risk event drawn from the seed.

### 5.2 Where the hardware goes — destinations by what they're for

The system survey isn't "scan the planet"; it's an infrastructure survey.
Specialized assets go to specialized places:

- **Gas giant (if present)** — the volatiles & fuel depot: He-3 skimming for
  the next generation of ships, radiation-belt mapping (hazard), icy moons
  (water, organics). A cold Jupiter like ε Ind b is a gift: it shepherds the
  small bodies into reachable families.
- **Asteroid belts / debris disks** (ε Eri is the archetype) — metals,
  feedstock, low-Δv industry. The first factory goes here, not on the planet.
- **Icy moons & comets** — water and propellant. Every kilogram of shielding
  and reaction mass that doesn't come up a gravity well.
- **The scorched inner world** — beamed-power site: thin atmosphere, brutal
  insolation, nobody lives there, and it can beam power anywhere in-system.
- **L4/L5 & high orbits of the HZ world** — the relay constellation, staging
  depots, the quarantine station (see 5.5).
- **The HZ world itself** — last, not first. Sealed bio-assay before any
  open-cycle contact (the abiotic-O₂ branch, engine.ts REV F).

### 5.3 The orbital-first doctrine

The user-facing thesis: **stay out of the well until the well is worth it.**
Surface-to-orbit costs 8–9 km/s every round trip; asteroid rendezvous from
interplanetary arrival costs a fraction of that, and nothing you build in
orbit falls down. Consequences for the game:

- The SEED lander stays mandatory for the *surface branch* but the
  **PLANET screen becomes a DESTINATION screen**: a world, a moon, or an
  orbit is a valid target.
- **The Exodus never lands.** She is the founding orbital asset — the
  reactor, the machine shop, the genetic archive, and the only hull rated
  for the interstellar medium. Parking her in a graveyard orbit is doctrine.
- Surface packages become *exports* from orbital industry, not imports
  from orbit: the first thing the asteroid factory builds is the landing
  gear for everything after it.

### 5.4 Spacers — the crew who refuse the well

Some fraction of the 207 will elect never to make planetfall even when it's
available: the shipyard crews, the refinery watch, the relay maintainers —
and their children, who will be multigenerational by simple arithmetic
(Proxima-class transits are 60–140 yr; the colony's second generation is
born in orbit regardless). Design consequences:

- The crew manifest gains an **allocation question** (surface vs orbital
  cohort split), sharing UI language with the payload budget.
- Population genetics quietly favors the split: two semi-isolated
  populations (orbital + surface) exchange migrants and keep a much larger
  effective population than either alone.
- HALCYON gets a line about it, because of course he does.

### 5.5 What the player is managing (the tradeoff graph)

- **Certainty vs mass** — probes and assay capability against tonnes of
  colony. (Live today: VLBI, science lander.)
- **Redundancy vs margin** — shipshop + torpor reserve batteries vs more
  of everything else; the transit-events system prices the choice.
- **Surface vs orbital** — where the industrial mass goes (5.3).
- **Present vs future** — He-3 from the gas giant only matters if someone
  builds the second ship. The endgame question: does this colony launch
  its own Exodus?
- **Quarantine vs speed** — the abiotic-O₂ world: assay it slowly with a
  bio-cabinet, or accept the risk and settle fast.

### 5.6 How the plan changes by system (the payoff)

| System archetype | Example | The plan bends toward |
| --- | --- | --- |
| Flare M dwarf | Proxima, Wolf 359 | orbital + terminator-string outposts; shielding mass over lander mass; SPS over surface solar |
| Quiet M/K dwarf | Ross 128, Lacaille 9352, ε Ind | cheap surface branch possible; still assay-first (abiotic O₂ risk is highest here) |
| G-twin | τ Cet, α Cen A | the textbook surface-first case — if the debris disk cooperates |
| Young dusty K dwarf | ε Eri | asteroid industry first; dust-hardened relays; the best factory site in the catalog |
| Giant-bearing system | ε Ind, ε Eri | volatiles economy; He-3 option; radiation-belt survey before anything else |
| No viable world at all | (possible) | pure orbital colony — the free-fort; the PLANET screen's honest answer is "none of these, take the belt" |

---

## 6. Conventions & file map

| Token / file | Meaning |
| --- | --- |
| `ink` `#e8e6dc` | ivory structure lines |
| `phos` `#7beba6` | phosphor live data |
| `hal-mono` / `hal-display` | IBM Plex Mono body / weight-600 annotation |
| `src/app/globals.css` | instrument layer: grid-paper, CRT overlay, draw-on, blueprint classes (`bp-*`) |
| `src/lib/mission/engine.ts` | `mulberry32`, `hashString`, seeded system generation |
| `src/lib/mission/events.ts` | seeded transit failures — equipment-dependent outcomes (REV F) |
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

---

## 8. REALISM PASS — REV F (implemented)

The 2026 realism audit, implemented and verified (`scripts/verify-revf.ts`).
The charter bar — "honest to mission-design sketch level" — was applied to
the whole transit chain. Numbers below are computed, not quoted.

### 8.1 The ship can now stop — magsail architecture (`astro.ts`)

The old model cruised at 0.1 c and simply… arrived. The 12.4 % propellant
reserve only buys 7,471 km/s (0.025 c); stopping on it alone needs an
exhaust velocity of 0.47 c. **Fix (Zubrin/Andrews):** a magsail — ram drag
against the ISM, propellantless. `a = a₀(v/v₀)²` ⇒ `v(t) = v₀/(1+t/τ′)`;
a₀ = 0.25 m/s² at 0.1 c (≈1,900 km superconducting loop on our 62 kt
burnout mass), deployed **0.77 ly out**, braking 29,979 → 4,000 km/s over
**24.7 yr**, then the fusion reserve finishes the capture burn with ~44 %
margin. Braking the last factor of ten in speed would take another century —
documented as the honest architecture. New phases: `MAGSAIL`, `CAPTURE`.

New canon transit totals (TJI 2.7 + torch 2.0 + cruise + brake 24.7 + 0.3):

Proxima 63.6 yr · Barnard 80.7 · Wolf 359 99.7 · ε Eri 125.9 ·
τ Cet 140.2 (was 45.2 / 62.4 / 81.3 / 107.2 / 121.9 — the brake is the
difference; the crew sleeps through it).

### 8.2 The torch is sustained, not impulsive

An 18-day 0.1 c burn ⇒ ~2 GN thrust, ~34 PW jet power, ~1,200 km² of
radiator: nonsense. **Fix:** `BURN_YEARS = 2.0` (Daedalus-class staging) ⇒
jet power ~0.9 TW, thermal rejection ~34 km² of 1,450 K droplet curtain.
The blueprint radiators are redrawn as droplet curtains with drafting-break
symbols and honest area labels (GA drawing REV E → REV F).

This also settles the Sundiver question: **a perihelion Oberth dive was
considered and rejected** — Oberth multiplies impulsive burns and does
nothing for a two-year torch. The Jovian flyby keeps its real job: bending
the escape asymptote 115.8° toward a high-declination target (the assist's
worth is direction, not the 5.7 km/s).

### 8.3 Cold sleep is torpor — 281 K, not 4 K

4.1 K against 300 K bay walls is Carnot COP 0.014 (72 W per watt removed)
and km² of 4 K radiator: thermodynamic fantasy. **Fix:** therapeutic torpor
at ~281 K (+8 °C) — SpaceWorks-NIAC-style hypothermia with periodic wake
cycles. The sailors' jargon stays ("cold sleep"); every *measurement* on
screen now says TORPOR and reads 281.x K. `ship.ts` documents the physics.

### 8.4 Relativistic & light-lag plate @ 0.1 c

New telemetry (`astro.ts` + transit screen): **ship proper time** τ = ∫dt/γ
(Proxima saves 0.19 yr of crew aging — τ and T+ now differ on the dial);
**β**; **Sol beacon Doppler** — the 8.4 GHz Earth archive beacon received
at 7.60 GHz during cruise, drifting back up as the magsail bites; one-way
light time growing from hours to decades (stat row + `fmtRange` in LY).

### 8.5 Proper motion & the intercept lead (`stars.ts`)

All 16 stars now carry real Gaia DR3 / Hipparcos proper motions (mas/yr).
The ship aims **ahead of the visual position**: Barnard's Star (10.39″/yr,
90 km/s tangential) moves 1,647 AU between launch and intercept — lead
angle 0.25°; Lacaille 9352 3,150 AU (0.27°); τ Cet 1,068 AU. Star dossier
rows (PROPER MOTION · INTERCEPT LEAD), the **PLOT 03-D intercept inset** on
the transit plate (visual cross vs intercept ring, offset honestly labelled
~×10³), and HALCYON's aim-ahead line for stars with >500 AU of lead.

### 8.6 The decades are not kind — transit events (`events.ts`)

Seeded, deterministic from star + manifest: Whipple-stack grain strikes,
torpor-bay bus brownouts (absorbed **iff** the reserve battery is aboard),
radiator curtain ruptures (remanufactured **iff** the shipshop is aboard),
cargo-cell strikes (feedstock reclaimed iff…), HALCYON core transients, ISM
density fronts. New equipment: **SHIPBOARD REMANUFACTURING SHOP** (85 t,
rack V1-10/11, stamp RMS) — spares are dead mass, feedstock is alive.
Manifest is now 2,160 t vs 1,760 t capacity. Also new: **Whipple-shield
erosion budget** telemetry (v³-weighted dose, τ = 300 yr: 89 % margin at
Proxima, 69 % at τ Cet).

### 8.7 Abiotic O₂ — the ambiguous garden world (`engine.ts`)

Free O₂ around late-K/M dwarfs can be pre-main-sequence water-loss residue
(Luger & Barnes 2015), not biology. Breathable worlds around <0.75 M☉ now
carry `abioticRisk`; the dossier shows the quarantine box; the prognosis
carries a BIO-SIGNATURE RESOLVE factor (+2 with the science lander's
bio-cabinet, −6 without); HALCYON refuses to shake hands with anything.
Flare class now gates oxygen (quiet stars keep atmospheres; flare stars
rarely do). In the current seed: ε Eri IV is a true biotic garden (71/100,
−1 °C); 61 Cyg III is the ambiguous one (43/100, free O₂, origin unresolved).

### 8.8 Greenhouse & albedo calibration (`engine.ts`)

Equilibrium temperature now uses albedo 0.3 (254.6 K at 1 AU — was 278.6,
which is the albedo-zero value) and greenhouse ΔT = 33·√p K (Earth: +15 °C
exactly; Mars ~3 K at 6 mbar), collapsing outside the HZ. The old model put
Earth at 9.7 °C and needed the ≥48 suitability fudge to rescue frozen
worlds; the new one lands HZ worlds between −40 and +32 °C on its own.

### 8.9 Verified

`npx tsc --noEmit` clean; `npm run build` clean; module-load assertions
pass (bay arithmetic, rack addresses, portraits doctrine);
`scripts/verify-revf.ts` confirms: phase boundaries, magsail velocity
curve, proper-time integration, beacon Doppler, shield margin, intercept
geometry, per-star viable candidates (16/16 ≥ 48), and the KE line (29.8×
the 2098 impactor — HALCYON rounds to thirty).

Visual QA (dev tooling, `playwright-core` dev dep): `scripts/smoke-visual.mjs`
clicks INTRO→BOOT→STAR→EQUIP→CREW→TRANSIT→PLANET→PROFILE against
`next start` and screenshots every changed screen;
`scripts/check-labels.mjs` asserts every blueprint text label's `getBBox()`
fits the viewBox; `scripts/check-geometry.mjs` asserts the radiator panels
never intersect the aft tanks/stages/labels in screen space (0 overlaps).
Screenshots were reviewed by VLM for collisions — three real layout bugs
were found and fixed this way (radiator stubs crossing the drop-stages,
the intercept-inset label placements, the thermal-rejection label site).
