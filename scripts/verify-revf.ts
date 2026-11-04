// Runtime verification of the REV F realism pass — prints the new canon numbers
// and checks the planet generator still yields a viable candidate per star.
import { STARS, interceptSolution, transitYears } from "../src/lib/mission/stars";
import {
  TRANSFER,
  BURN_YEARS,
  BURN_DISTANCE_LY,
  MAG_TAU_YR,
  MAG_DEPLOY_LY,
  MAG_YEARS,
  phaseBoundaries,
  missionState,
  properTimeYears,
  solBeaconRxGhz,
  shieldMarginPct,
  kineticEnergyJ,
} from "../src/lib/mission/astro";
import { generateSystem } from "../src/lib/mission/engine";
import { transitEvents } from "../src/lib/mission/events";
import { EQUIPMENT } from "../src/lib/mission/equipment";

const W = (s: string) => String(s).padEnd(12).slice(0, 12);

console.log("═══ DEPARTURE ═══");
console.log(
  `TJI ${TRANSFER.years.toFixed(2)} yr · flyby δ ${TRANSFER.deltaDeg.toFixed(1)}° · exit ${TRANSFER.exitSpeedKms.toFixed(1)} km/s`
);
console.log(
  `torch ${BURN_YEARS.toFixed(1)} yr · burn distance ${BURN_DISTANCE_LY.toFixed(3)} ly`
);
console.log(
  `magsail: τ'=${MAG_TAU_YR.toFixed(2)} yr · deploy ${MAG_DEPLOY_LY.toFixed(3)} ly out · brake ${MAG_YEARS.toFixed(1)} yr`
);

console.log("\n═══ TRANSIT TABLE (new canon) ═══");
console.log(
  [W("STAR"), "LY", "TJI+TORCH", "CRUISE", "MAGSAIL", "TOTAL", "PROPER τ", "Δτ", "SHIELD", "AIM AU", "LEAD°"].join(" · ")
);
for (const s of STARS) {
  const pb = phaseBoundaries(s.distanceLy);
  const T = pb.tTotal;
  const tau = properTimeYears(s.distanceLy, T);
  const shield = shieldMarginPct(s.distanceLy, T);
  const icpt = interceptSolution(s);
  console.log(
    [
      W(s.shortName),
      s.distanceLy.toFixed(2),
      (pb.tBurnEnd).toFixed(1),
      (pb.tCruiseEnd - pb.tBurnEnd).toFixed(1),
      (pb.tMagEnd - pb.tCruiseEnd).toFixed(1),
      T.toFixed(1),
      tau.toFixed(1),
      (T - tau).toFixed(2),
      shield.toFixed(0) + "%",
      Math.round(icpt.aimAu).toLocaleString(),
      icpt.leadAngleDeg.toFixed(2),
    ].join(" · ")
  );
}

console.log("\n═══ MID-TRANSIT STATE CHECKS (Proxima, Barnard, Tau Ceti) ═══");
for (const id of ["proxima", "barnard", "tauceti"]) {
  const s = STARS.find((x) => x.id === id)!;
  const pb = phaseBoundaries(s.distanceLy);
  const mid = pb.tBurnEnd + (pb.tCruiseEnd - pb.tBurnEnd) / 2;
  const st = missionState(s.distanceLy, mid);
  console.log(
    `${W(s.shortName)} t=${mid.toFixed(1)}: ${st.phase} v=${Math.round(st.velKms).toLocaleString()} km/s β=${st.beta.toFixed(4)} beacon=${solBeaconRxGhz(st.velKms).toFixed(2)} GHz prop=${st.propPct.toFixed(1)}%`
  );
  const magMid = pb.tCruiseEnd + MAG_YEARS / 2;
  const mst = missionState(s.distanceLy, magMid);
  console.log(
    `${W("")} t=${magMid.toFixed(1)}: ${mst.phase} v=${Math.round(mst.velKms).toLocaleString()} km/s remaining=${mst.remainingLy.toFixed(3)} ly`
  );
  const done = missionState(s.distanceLy, pb.tTotal + 1);
  console.log(
    `${W("")} end: ${done.phase} v=${done.velKms.toFixed(0)} km/s prop=${done.propPct.toFixed(1)}%`
  );
}

console.log("\n═══ PLANET GENERATOR SANITY (albedo+greenhouse fix) ═══");
let allOk = true;
for (const s of STARS) {
  const planets = generateSystem(s);
  const landable = planets.filter((p) => p.landable);
  const best = landable.length
    ? landable.reduce((a, b) => (b.suitability > a.suitability ? b : a))
    : null;
  const abiotic = planets.filter((p) => p.abioticRisk).length;
  const ok = best && best.suitability >= 48;
  if (!ok) allOk = false;
  console.log(
    `${W(s.shortName)} n=${planets.length} landable=${landable.length} best=${best ? best.designation + " " + best.suitability + "/100 " + best.tempC.toFixed(0) + "C" : "NONE"}${abiotic ? ` · abiotic-O2 worlds: ${abiotic}` : ""}${ok ? "" : "  <<< BELOW VIABILITY"}`
  );
}
console.log(allOk ? "all stars have a ≥48 viable candidate ✓" : "VIABILITY FAILURES ✗");

console.log("\n═══ EVENTS (Proxima, full manifest vs bare) ═══");
const full = EQUIPMENT.map((e) => e.id);
const bare = ["seed"];
for (const [label, eq] of [
  ["FULL MANIFEST", full],
  ["BARE (seed only)", bare],
] as const) {
  const evs = transitEvents(STARS[0], [...eq]);
  console.log(`— ${label} —`);
  for (const e of evs)
    console.log(`  Y${e.year.toFixed(1).padStart(6)} [${e.severity}] ${e.code}: ${e.text}`);
}

console.log("\n═══ NUMBERS QUOTED ELSEWHERE ═══");
const ke = kineticEnergyJ(1760);
console.log(
  `KE at cruise: ${(ke / 2.2e21).toFixed(1)}× the 2098 impactor (HALCYON says thirty)`
);
const ve = (29979.2 - TRANSFER.exitSpeedKms) / Math.log(145760 / 61664);
console.log(`implied exhaust velocity: ${Math.round(ve).toLocaleString()} km/s = ${(ve / 299792.458).toFixed(3)} c`);
const manifestT = EQUIPMENT.reduce((a, e) => a + e.massT, 0);
console.log(`manifest total: ${manifestT.toLocaleString()} t vs capacity 1,760 t`);
console.log(`transitYears check: ${transitYears(STARS[0]).toFixed(1)} (Proxima)`);
