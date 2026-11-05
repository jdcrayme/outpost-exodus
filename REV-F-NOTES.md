# REV F — Realism Pass (integration notes)

This tree is the full outpost-exodus source with the REV F realism pass applied
(commits `cdd45db` and `4dc2225` on top of upstream `fa677d1`).

## What changed

**Physics — `src/lib/mission/astro.ts`**
- Magsail braking architecture (Zubrin/Andrews): a₀ ≈ 0.25 m/s² ISM ram drag,
  deployed 0.765 ly out; 29,979 → 4,000 km/s over 24.7 yr, fusion reserve
  finishes capture. New `MAGSAIL` + `CAPTURE` phases; all transit totals
  recomputed (Proxima 45.2 → 63.6 yr, Tau Ceti 121.9 → 140.2 yr).
- Torch burn stretched 0.05 → 2.0 yr (jet power 34 PW → 0.9 TW; radiators
  1,200 km² → 34 km²). Sundiver/Oberth was evaluated and **rejected**: Oberth
  multiplies instantaneous Δv, it does nothing for multi-year burns. The
  Jovian flyby keeps its real job — bending the departure asymptote 115.8°.
- Relativistic plate: ship proper time τ = ∫dt/γ, β, Sol-beacon Doppler
  (8.4 GHz → 7.60 GHz at cruise), light-year-range formatting.
- Whipple erosion budget: v³-weighted dust dose, τ = 300 yr design life →
  live shield-margin telemetry.

**Navigation — `src/lib/mission/stars.ts`**
- Real Gaia DR3 / Hipparcos proper motions for all 16 stars;
  `interceptSolution()` aim-ahead geometry (Barnard's: 1,647 AU, 0.25° lead).
  Catalog typo fixed: 61 CYGANI → 61 CYGNI.

**Crew systems — `src/lib/mission/ship.ts`**
- "Cold sleep" is honestly therapeutic torpor at 281 K (+8 °C), not 4 K cryo
  (Carnot says 72 W spent per watt removed at 4 K). Jargon stays; the
  telemetry tells the truth. `loopK: 4.1` → `281.1`.

**Planet generator — `src/lib/mission/engine.ts`**
- Albedo 0.3 / 254.6 K Earth calibration; greenhouse restores Earth to ≈ +15 °C
  (ΔT ≈ 33 K at 1 atm, Venus saturates, collapses far from the HZ).

**The decades are not kind — `src/lib/mission/events.ts` (new)**
- Seeded transit-failure events keyed to the spares manifest: grain strikes,
  droplet-curtain ruptures, TMR vote disagreements, ISM cloud sheets. A bare
  ship fails worse — the full manifest absorbs the same seeds gracefully.

**Screens** — `TransitPlot` (phase bands, intercept inset), `TransitScreen`,
`ShipBlueprint` (radiator silhouette), star/planet dossiers.

**Design discussion — `docs/DESIGN_NOTES.md` §5**
- §5.1 arrival-order physics (the courier is the only pre-arrival surveyor),
  §5.2 destinations by Δv, §5.3 the orbital-first doctrine with the gravity
  well priced (~90:1 per kg Earth-class, ~1,000:1 on the τ Cet super-Earths).

## How to use this tree

```bash
unzip outpost-exodus-realism-revf.zip -d outpost-exodus
cd outpost-exodus
npm install
npm run dev        # or: npm run build && npm start
```

Verification: `npx tsc --noEmit` clean · `next build` clean ·
`npx tsx scripts/verify-revf.ts` prints the full physics audit table.
