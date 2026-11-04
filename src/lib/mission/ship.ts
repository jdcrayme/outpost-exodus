// ─── Ship architecture — OUTPOST-class seed ship EXODUS ─────────────────────
// Pure data, no React: the general-arrangement truth shared by the blueprint
// drawing (src/screens/equipment/ShipBlueprint.tsx), the crew manifest
// (src/lib/mission/crew.ts + src/screens/crew/), and the planned hangar view
// (DESIGN_NOTES §4). Stations are
// metres from the nose datum (STA) — the drawing maps STA → x at 1 unit = 1 m.

import { CREW_COUNT } from "./astro";

// ── Cold-sleep doctrine ──────────────────────────────────────────────────────
// One cohort per bay. Bays are strung along the spine inside the debris
// shadow cone, staggered clock positions, alternating power buses: no single
// catastrophe — strike, fire, bus loss — reaches a second bay. 12 × 17 = 204
// sleepers + 3 command watch = 207 souls, which must equal CREW_COUNT.
//
// PHYSICS (REV F): "cold sleep" is mission jargon for therapeutic torpor —
// ~281 K (+8 °C), sedated, metabolisms at roughly one ninth, periodic wake
// cycles (SpaceWorks NIAC-style hypothermia), NOT cryogenics. True 4 K cryo
// would need ~72 W of electricity per watt removed (Carnot) and km² of
// 4 K radiator against the CMB — thermodynamic fantasy. The sailors' word
// stays; the telemetry tells the truth.

export const WATCH_CREW = 3;
export const BAY_COUNT = 12;
export const BERTHS_PER_BAY = 17;
export const COLD_SLEEPERS = BAY_COUNT * BERTHS_PER_BAY; // 204

if (WATCH_CREW + COLD_SLEEPERS !== CREW_COUNT) {
  throw new Error(
    `bay arithmetic drifted: ${WATCH_CREW} watch + ${COLD_SLEEPERS} sleepers != CREW_COUNT ${CREW_COUNT}`
  );
}

export interface ColdSleepBay {
  id: string; // "C-01" … "C-12"
  cohort: number; // one cohort per bay
  sta: number; // bay centre, metres from nose datum
  offset: number; // elevation offset from the centreline (m, staggered)
  clock: string; // clock position around the spine
  bus: "A" | "B"; // power bus (alternating — no two neighbours share one)
  loopK: number; // torpor water-loop setpoint, K — cosmetic telemetry
}

const BAY_PITCH = 6.35; // m between bay centres: 5.4 m bay + 0.95 m truss gap

export const BAYS: ColdSleepBay[] = Array.from({ length: BAY_COUNT }, (_, i) => ({
  id: `C-${String(i + 1).padStart(2, "0")}`,
  cohort: i + 1,
  sta: 85.7 + i * BAY_PITCH,
  offset: i % 2 === 0 ? -0.4 : 0.4,
  clock: i % 2 === 0 ? "10 O'CLOCK" : "02 O'CLOCK",
  bus: i % 2 === 0 ? "A" : "B",
  loopK: 281.1 + ((i * 37) % 4) * 0.1,
}));

// ── Cargo ring — the front of the spine ──────────────────────────────────────
// Standard container cells racked in four rows around the forward spine,
// deliberately OUTBOARD of the debris shadow: the cargo is the outermost
// sacrificial mass between the Whipple shield and everything that matters.

export type RackRowId = "D2" | "D1" | "V1" | "V2";

export const RACK = {
  cellsPerRow: 11,
  cellW: 4.4, // m — a fat ISO container, schematically
  cellH: 2.4,
  pitch: 4.68, // cell + handling gap
  rows: ["D2", "D1", "V1", "V2"] as RackRowId[],
};

// ── Stowage — where every payload item lives ────────────────────────────────
// Three kinds of address:
//   rack  — containerized cargo, addressed like "D1-06" (row D1, cell 06)
//   dock  — self-supporting modules on the dorsal/ventral strongback, STA-addressed
//   bays  — equipment fitted to every cold-sleep bay (per-bay redundancy)

export type Stowage =
  | { kind: "rack"; cells: string[]; stamp: string }
  | { kind: "dock"; side: "D" | "V"; sta: number }
  | { kind: "bays" };

export const STOWAGE: Record<string, Stowage> = {
  // containerized cargo — the cargo ring
  genevault: { kind: "rack", cells: ["D1-02"], stamp: "VLT" },
  medical: { kind: "rack", cells: ["D1-04"], stamp: "MED" },
  refinery: { kind: "rack", cells: ["D1-06", "D1-07", "D1-08"], stamp: "REF" },
  hydro: { kind: "rack", cells: ["D1-09", "D1-10"], stamp: "HYD" },
  commsat: { kind: "rack", cells: ["V1-03"], stamp: "COM" },
  navbeacon: { kind: "rack", cells: ["V1-05"], stamp: "NAV" },
  rovers: { kind: "rack", cells: ["V1-07", "V1-08"], stamp: "RVR" },
  shipshop: { kind: "rack", cells: ["V1-10", "V1-11"], stamp: "RMS" },
  // strongback docks
  vlbi: { kind: "dock", side: "D", sta: 16.5 }, // launch cradle at the bow
  residential: { kind: "dock", side: "D", sta: 85 },
  sps: { kind: "dock", side: "D", sta: 113 },
  reactor: { kind: "dock", side: "D", sta: 143 },
  seed: { kind: "dock", side: "V", sta: 85 },
  industrial: { kind: "dock", side: "V", sta: 113 },
  science: { kind: "dock", side: "V", sta: 143 },
  // fitted to every bay
  coldsleep: { kind: "bays" },
};

// every rack address must exist — catches row typos and off-by-one cells
for (const s of Object.values(STOWAGE)) {
  if (s.kind !== "rack") continue;
  for (const c of s.cells) {
    const row = c.slice(0, 2) as RackRowId;
    const n = Number(c.slice(3));
    if (!RACK.rows.includes(row) || !Number.isInteger(n) || n < 1 || n > RACK.cellsPerRow) {
      throw new Error(`bad rack address in STOWAGE: ${c}`);
    }
  }
}

/** "D1-06" → the equipment id stowed there, or undefined. */
export const CELL_OWNER: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const [id, s] of Object.entries(STOWAGE)) {
    if (s.kind === "rack") for (const c of s.cells) m.set(c, id);
  }
  return m;
})();
