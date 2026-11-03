// ─── Astrodynamics — the departure solution, computed for real ───────────────
// Pure math, no React, no DOM. Patched-conic mission architecture:
//   1. TJI burn from Earth orbit → heliocentric transfer ellipse to Jupiter
//   2. Gravity-assist flyby at Jupiter (turning angle from a real hyperbola)
//   3. Fusion escape burn 0.52 AU past Jupiter → 0.100 c interstellar cruise
// Every number on the transit plate derives from this module. Two-body
// approximations throughout — honest to mission-design sketch level, which is
// exactly what the Discovery plates showed.

// ── Physical constants (km, s, kg — SI-adjacent astrodynamics units) ─────────
export const MU_SUN = 1.32712440018e11; // km³/s²
export const MU_JUP = 1.26686534e8; // km³/s²
export const R_JUP = 71492; // km, equatorial
export const AU_KM = 1.495978707e8;
export const C_KMS = 299792.458;
export const LY_KM = 9.46073047258e12;
export const LY_AU = LY_KM / AU_KM; // 63,241 AU per light-year
export const SEC_PER_YEAR = 31_557_600; // Julian year

export const EARTH_ORBIT_AU = 1.0;
export const EARTH_V_KMS = 29.78; // heliocentric, circular
export const JUPITER_ORBIT_AU = 5.203;
export const JUPITER_V_KMS = 13.07;
export const PERIJOVE_RJ = 10; // flyby periapsis, Jovian radii

export const CRUISE_C = 0.1;
export const CRUISE_KMS = CRUISE_C * C_KMS; // 29,979 km/s
export const BURN_DIST_AU = 0.52; // fusion ignition distance past Jupiter

/** Perihelion of the TJI ellipse on the departure plate (math convention). */
export const DEPART_ANGLE_DEG = 155;

// ── Ship constants — OUTPOST-class seed ship EXODUS ─────────────────────────
export const SHIP_DRY_T = 48_000; // hull, cold-sleep bays, drive structure
export const PROP_T = 96_000; // fusion stockpile + departure stages
export const CREW_COUNT = 207;

/** The 2098 impactor (story canon): 1.4 km nickel-iron body at ~20 km/s. */
export const IMPACTOR_2098_J = 2.2e21; // J — for HALCYON's grim comparisons

// ── TJI transfer ellipse: Earth (perihelion) → Jupiter (aphelion) ────────────

export interface TransferSolution {
  aAu: number; // semi-major axis, AU
  e: number; // eccentricity
  vPeriKms: number; // heliocentric speed at Earth departure
  vAphiKms: number; // heliocentric speed at Jupiter arrival
  dvTjiKms: number; // Δv over Earth's orbital speed
  years: number; // transfer time (half period)
  // flyby
  vInfJupKms: number; // hyperbolic excess speed at Jupiter
  periapseKm: number; // flyby periapsis radius
  eFlyby: number; // flyby hyperbola eccentricity
  deltaDeg: number; // turning angle δ
  // escape (post-flyby, heliocentric)
  exitSpeedKms: number; // speed after the assist, before the torch
  exitDirDeg: number; // direction of the escape asymptote (math convention)
  periAxisDeg: number; // flyby periapsis axis direction on the inset
  burnYears: number; // mission time at fusion ignition
}

const R1 = EARTH_ORBIT_AU * AU_KM;
const R2 = JUPITER_ORBIT_AU * AU_KM;
const DEG = Math.PI / 180;

export const TRANSFER: TransferSolution = (() => {
  // Hohmann transfer, tangent at both ends
  const a = (R1 + R2) / 2; // km
  const aAu = a / AU_KM;
  const e = (R2 - R1) / (R2 + R1);
  const vPeri = Math.sqrt(MU_SUN * (2 / R1 - 1 / a));
  const vAphi = Math.sqrt(MU_SUN * (2 / R2 - 1 / a));
  const years = (Math.PI * Math.sqrt(a ** 3 / MU_SUN)) / SEC_PER_YEAR;

  // Jupiter flyby — patched conic in the Jovian frame
  const vInf = JUPITER_V_KMS - vAphi; // Jupiter overtakes us from behind
  const rp = PERIJOVE_RJ * R_JUP;
  const eF = 1 + (rp * vInf * vInf) / MU_JUP;
  const delta = (2 * Math.asin(1 / eF)) / DEG;

  // Compose the exit state: v_exit = v_Jupiter + v∞_out (vector sum).
  // Geometry: departure perihelion sits at 155° (math convention), so Jupiter
  // arrival — the ellipse aphelion — is at 335°. Both planets prograde (CCW).
  const jupAngle = DEPART_ANGLE_DEG + 180; // position angle of Jupiter at flyby
  const tangential = jupAngle + 90; // direction of both velocities
  // v∞ in = ship − Jupiter = (vAphi − vJup) along `tangential` → reversed ray
  const vInfInDir = tangential + 180;
  // Rotate the excess velocity by +δ (assist bending away from the Sun);
  // validated below — if the dot product with the radial says otherwise, flip.
  const radial = { x: Math.cos(jupAngle * DEG), y: Math.sin(jupAngle * DEG) };
  const compose = (sign: number) => {
    const outDir = vInfInDir + sign * delta;
    const vx =
      JUPITER_V_KMS * Math.cos(tangential * DEG) +
      vInf * Math.cos(outDir * DEG);
    const vy =
      JUPITER_V_KMS * Math.sin(tangential * DEG) +
      vInf * Math.sin(outDir * DEG);
    return {
      speed: Math.hypot(vx, vy),
      dirDeg: Math.atan2(vy, vx) / DEG,
      outward: vx * radial.x + vy * radial.y,
    };
  };
  const plus = compose(+1);
  const minus = compose(-1);
  const exit = plus.outward >= minus.outward ? plus : minus;

  // Flyby periapsis axis: lies opposite the short-way bisector of the two
  // asymptote rays (θ∞ > 90° ⇒ periapsis is on the far side).
  // Incoming ray points at `tangential` (opposite v∞ in), outgoing at exit dir.
  const outgoingRay = (((vInfInDir + delta) % 360) + 360) % 360;
  const incomingRay = tangential;
  let out = outgoingRay;
  while (Math.abs(out - incomingRay) > 180) {
    out -= Math.sign(out - incomingRay) * 360;
  }
  const periAxis = (incomingRay + out) / 2 + 180;

  return {
    aAu,
    e,
    vPeriKms: vPeri,
    vAphiKms: vAphi,
    dvTjiKms: vPeri - EARTH_V_KMS,
    years,
    vInfJupKms: vInf,
    periapseKm: rp,
    eFlyby: eF,
    deltaDeg: delta,
    exitSpeedKms: exit.speed,
    exitDirDeg: ((exit.dirDeg % 360) + 360) % 360,
    periAxisDeg: ((periAxis % 360) + 360) % 360,
    burnYears: years,
  };
})();

/** Point on the TJI ellipse. θ: true anomaly 0 (Earth) … π (Jupiter). AU. */
export function transferRangeAu(theta: number): number {
  return (TRANSFER.aAu * (1 - TRANSFER.e ** 2)) / (1 + TRANSFER.e * Math.cos(theta));
}

/** Heliocentric speed on the TJI ellipse at true anomaly θ (km/s). */
export function transferSpeedKms(theta: number): number {
  return Math.sqrt(
    MU_SUN * (2 / (transferRangeAu(theta) * AU_KM) - 1 / (TRANSFER.aAu * AU_KM))
  );
}

// ── Piecewise mission state — one function of mission time ───────────────────

export type MissionPhase = "TJI" | "FLYBY" | "BURN" | "CRUISE";

export interface MissionState {
  phase: MissionPhase;
  rangeAu: number; // heliocentric range
  velKms: number; // heliocentric speed
  remainingLy: number; // range to destination
  propPct: number; // fusion stockpile remaining
}

const T_BLEND = 0.05; // years of screen-time smoothing across flyby + burn

/** Total mission duration: departure leg + flyby/burn blend + 0.1 c cruise. */
export function totalYears(distanceLy: number): number {
  return TRANSFER.years + T_BLEND + distanceLy / CRUISE_C;
}

const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

/**
 * State of the ship at mission time `t` years since the TJI burn.
 * Phases: transfer ellipse → Jupiter flyby + fusion burn → 0.1 c cruise.
 */
export function missionState(
  distanceLy: number,
  t: number
): MissionState {
  const tXfer = TRANSFER.years;
  if (t < tXfer) {
    // Transfer ellipse coast — decelerating climb out of Sol's well
    const theta = Math.PI * clamp01(t / tXfer);
    return {
      phase: "TJI",
      rangeAu: transferRangeAu(theta),
      velKms: transferSpeedKms(theta),
      remainingLy: distanceLy,
      propPct: 100,
    };
  }
  if (t < tXfer + T_BLEND) {
    // Flyby + fusion burn: 7.4 → 16.3 → 29,979 km/s, smoothed for display
    const p = smooth(clamp01((t - tXfer) / T_BLEND));
    const speed =
      p < 0.4
        ? TRANSFER.vAphiKms +
          (TRANSFER.exitSpeedKms - TRANSFER.vAphiKms) * smooth(p / 0.4)
        : TRANSFER.exitSpeedKms +
          (CRUISE_KMS - TRANSFER.exitSpeedKms) * smooth((p - 0.4) / 0.6);
    return {
      phase: p < 0.4 ? "FLYBY" : "BURN",
      rangeAu: JUPITER_ORBIT_AU + BURN_DIST_AU * p,
      velKms: speed,
      remainingLy: distanceLy,
      propPct: 100 - 87.6 * p,
    };
  }
  // Cruise at 0.100 c — the long silence
  const tc = t - tXfer - T_BLEND;
  const travelledLy = CRUISE_C * tc;
  return {
    phase: "CRUISE",
    rangeAu: JUPITER_ORBIT_AU + BURN_DIST_AU + CRUISE_C * LY_AU * tc,
    velKms: CRUISE_KMS,
    remainingLy: Math.max(0, distanceLy - travelledLy),
    propPct: 12.4,
  };
}

// ── Display math for the equation plate ──────────────────────────────────────

/** Kinetic energy at cruise for a given payload (tonnes). Joules. */
export function kineticEnergyJ(payloadT: number): number {
  const mKg = (SHIP_DRY_T + PROP_T + payloadT) * 1000;
  return 0.5 * mKg * (CRUISE_KMS * 1000) ** 2;
}

/** One-way light time from a heliocentric range, in friendly units. */
export function fmtLightTime(rangeAu: number): string {
  const s = (rangeAu * AU_KM) / C_KMS;
  if (s < 60) return `${s.toFixed(1)} S`;
  if (s < 3600) return `${(s / 60).toFixed(1)} MIN`;
  if (s < 172_800) return `${(s / 3600).toFixed(1)} HRS`;
  const days = s / 86_400;
  if (days < 200) return `${days.toFixed(1)} DAYS`;
  return `${(days / 365.25).toFixed(2)} YRS`;
}

/** Heliocentric range with sane significant digits. */
export function fmtAu(rangeAu: number): string {
  if (rangeAu < 100) return `${rangeAu.toFixed(2)} AU`;
  return `${Math.round(rangeAu).toLocaleString("en-US")} AU`;
}

/** Telemetry-style speed (E-notation adjacent, fixed columns). */
export function fmtKms(v: number): string {
  if (v < 100) return `${v.toFixed(1)} KM/S`;
  return `${Math.round(v).toLocaleString("en-US")} KM/S`;
}
