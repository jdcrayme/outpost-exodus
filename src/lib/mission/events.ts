import type { StarSystem } from "./types";
import { hashString, mulberry32 } from "./engine";
import { STOWAGE } from "./ship";
import { totalYears, phaseBoundaries } from "./astro";

// ─── Transit events — the decades are not kind, and they are not random ──────
// Deterministic from the star + the mounted manifest: same mission, same
// failures, forever (charter §1). Every event has an equipment-dependent
// outcome — the shipshop remanufactures, the torpor reserve batteries absorb,
// and the unprepared ship eats the loss. This is the load-time twin of the
// "risk event" language in DESIGN_NOTES §5: certainty vs cargo is the trade.

export type EventSeverity = "NOMINAL" | "CAUTION" | "ALERT";

export interface TransitEvent {
  /** Mission year at which the event resolves. */
  year: number;
  /** Log-style code, e.g. "WHD-2". */
  code: string;
  /** Telemetry-line text, uppercase, terse. */
  text: string;
  severity: EventSeverity;
  /** Optional HALCYON voice line for the transit screen. */
  speech?: string;
}

export function transitEvents(
  star: StarSystem,
  equipmentIds: string[]
): TransitEvent[] {
  const has = (id: string) => equipmentIds.includes(id);
  const rand = mulberry32(
    hashString(`transit-events:${star.id}:${[...equipmentIds].sort().join(",")}`)
  );
  const T = totalYears(star.distanceLy);
  const { tBurnEnd, tCruiseEnd } = phaseBoundaries(star.distanceLy);

  // A rack cell we actually own, if any — cargo strikes should hurt the manifest
  const ownedCells: string[] = [];
  for (const id of equipmentIds) {
    const s = STOWAGE[id];
    if (s?.kind === "rack") ownedCells.push(...s.cells);
  }

  const events: TransitEvent[] = [];
  const push = (e: TransitEvent) => events.push(e);

  // ── 1. Interstellar grain strike on the Whipple stack (always) ──
  {
    const year = tBurnEnd + 2 + rand() * (tCruiseEnd - tBurnEnd - 4);
    const craterCm = 4 + rand() * 22;
    push({
      year,
      code: "WHD-2",
      text: `INTERSTELLAR GRAIN STRIKE, WHIPPLE PLATE 2 — CRATER ${craterCm.toFixed(0)} CM. SHIELD MARGIN RENUMBERED.`,
      severity: "CAUTION",
      speech:
        "A grain of silicate found plate two this morning, Commander — about a hundred kilograms of TNT, all of it spent on armour that exists to be spent.",
    });
  }

  // ── 2. Torpor bay bus brownout — the reserve battery earns its mass ──
  {
    const year = tBurnEnd + 4 + rand() * (tCruiseEnd - tBurnEnd - 8);
    const bay = 1 + Math.floor(rand() * 12);
    if (has("coldsleep")) {
      push({
        year,
        code: `BAY-${String(bay).padStart(2, "0")}`,
        text: `BAY ${String(bay).padStart(2, "0")} BUS BROWNOUT — RESERVE BATTERY ABSORBED, COHORT UNDISTURBED.`,
        severity: "NOMINAL",
        speech: `Bay ${bay} blinked on the primary bus this decade. The reserve battery caught it. The sleepers dreamed on.`,
      });
    } else {
      push({
        year,
        code: `BAY-${String(bay).padStart(2, "0")}`,
        text: `BAY ${String(bay).padStart(2, "0")} BUS BROWNOUT — NO RESERVE BATTERY ABOARD. EMERGENCY THAW CYCLE, COHORT REVIVED EARLY.`,
        severity: "ALERT",
        speech: `Bay ${bay} blinked on the primary bus, Commander, and there was no reserve battery to catch it. I woke them early. They will age with the transit.`,
      });
    }
  }

  // ── 3. Radiator curtain rupture — patched or remanufactured ──
  {
    const year = tBurnEnd + 6 + rand() * (tCruiseEnd - tBurnEnd - 10);
    const curtain = 1 + Math.floor(rand() * 4);
    if (has("shipshop")) {
      push({
        year,
        code: `RAD-${curtain}`,
        text: `DROPLET CURTAIN ${curtain} RUPTURE — SHIPSHOP REMANUFACTURED SEGMENT, 62 DAYS, NO DERATE.`,
        severity: "NOMINAL",
      });
    } else {
      push({
        year,
        code: `RAD-${curtain}`,
        text: `DROPLET CURTAIN ${curtain} RUPTURE — PATCHED BY ROBOT, REJECTION DERATED 6% PERMANENTLY.`,
        severity: "CAUTION",
      });
    }
  }

  // ── 4. HALCYON triple-vote transient (always — machines age too) ──
  {
    const year = tBurnEnd + 1 + rand() * (tCruiseEnd - tBurnEnd - 2);
    push({
      year,
      code: "CPU-2",
      text: "TRIPLE-MODULAR VOTE DISAGREEMENT, CORE 2 — RECONFIGURED AROUND THE FAULT. NO ACTION REQUIRED.",
      severity: "NOMINAL",
    });
  }

  // ── 5. Cargo cell strike — lost mass, or feedstock reclaimed ──
  if (ownedCells.length) {
    const year = tBurnEnd + 8 + rand() * Math.max(2, tCruiseEnd - tBurnEnd - 12);
    const cell = ownedCells[Math.floor(rand() * ownedCells.length)];
    if (has("shipshop")) {
      push({
        year,
        code: "CGO",
        text: `MICROMETEOROID PENETRATED RACK CELL ${cell} — SHIPSHOP RECLAIMED FEEDSTOCK FROM WRECKAGE.`,
        severity: "NOMINAL",
      });
    } else {
      push({
        year,
        code: "CGO",
        text: `MICROMETEOROID PENETRATED RACK CELL ${cell} — CELL CONTENTS VAPORIZED, MASS LOST.`,
        severity: "CAUTION",
      });
    }
  }

  // ── 6. ISM density front near the braking phase ──
  {
    const year = Math.max(tCruiseEnd - 2 - rand() * 4, tBurnEnd + 10);
    push({
      year,
      code: "ISM",
      text: "LOCAL CLOUD SHEET ENCOUNTERED — MAGSAIL DRAG UP 18%. BRAKING AHEAD OF SCHEDULE.",
      severity: "NOMINAL",
      speech:
        "The medium thickens, Commander — we have entered the cloud sheet ahead of the target. The sail approves. So do I.",
    });
  }

  return events.sort((a, b) => a.year - b.year);
}
