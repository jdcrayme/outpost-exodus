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

// ── Torch burn (REV F): sustained, not impulsive ──
// A 0.1 c Δv in eighteen days would demand ~2 GN of thrust and ~34 PW of jet
// power — radiators of ~1,200 km². Stretched to two years (Daedalus-class
// staging) the jet power is ~0.9 TW and thermal rejection is ~34 km² of
// 1,450 K droplet curtain — still the dominant feature of the ship, which is
// the honest answer. The multi-year burn is also why there is no perihelion
// Oberth "Sundiver" dive instead: Oberth multiplies impulsive burns, and does
// nothing for a two-year torch. The Jovian flyby keeps its real job — bending
// the escape asymptote toward a high-declination target.
export const BURN_YEARS = 2.0;

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

export type MissionPhase =
  | "TJI"
  | "FLYBY"
  | "BURN"
  | "CRUISE"
  | "MAGSAIL"
  | "CAPTURE";

export interface MissionState {
  phase: MissionPhase;
  rangeAu: number; // heliocentric range
  velKms: number; // heliocentric speed
  remainingLy: number; // range to destination
  propPct: number; // fusion stockpile remaining
  beta: number; // v/c — for the relativistic plate
}

// Torch-burn velocity profile, p ∈ [0,1] across BURN_YEARS: the flyby ramp to
// the post-assist exit speed, then the long climb to cruise. Same shape the
// old 18-day blend had — the ramp physics did not change, only its duration.
const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const FLYBY_FRAC = 0.05; // of the burn window; the flyby itself is ~18 days
function burnSpeedKms(p: number): number {
  const q = Math.min(1, Math.max(0, p));
  if (q < FLYBY_FRAC) {
    const s = smooth(q / FLYBY_FRAC);
    return TRANSFER.vAphiKms + (TRANSFER.exitSpeedKms - TRANSFER.vAphiKms) * s;
  }
  const s = smooth((q - FLYBY_FRAC) / (1 - FLYBY_FRAC));
  return TRANSFER.exitSpeedKms + (CRUISE_KMS - TRANSFER.exitSpeedKms) * s;
}

// Integrated once at module load: distance, proper time and erosion dose
// across the burn. Star-independent — the profile depends only on Jupiter.
const BURN_PROFILE = (() => {
  const N = 2048;
  const cumKm = new Float64Array(N + 1);
  const cumTau = new Float64Array(N + 1); // proper time, yr
  const cumDose = new Float64Array(N + 1); // erosion dose, v³-weighted yr
  const dtYr = BURN_YEARS / N;
  for (let i = 1; i <= N; i++) {
    const v = burnSpeedKms((i - 0.5) / N);
    cumKm[i] = cumKm[i - 1] + v * dtYr * SEC_PER_YEAR;
    cumTau[i] = cumTau[i - 1] + dtYr * Math.sqrt(1 - (v / C_KMS) ** 2);
    cumDose[i] = cumDose[i - 1] + dtYr * (v / CRUISE_KMS) ** 3;
  }
  return { N, cumKm, cumTau, cumDose, totalKm: cumKm[N], totalTau: cumTau[N] };
})();

export const BURN_DISTANCE_LY = BURN_PROFILE.totalKm / LY_KM; // ≈ 0.06 ly
export const BURN_END_RANGE_AU = JUPITER_ORBIT_AU + BURN_PROFILE.totalKm / AU_KM;

// ── Magnetic sail — how a 0.1 c ship stops (Zubrin & Andrews) ────────────────
// Drag against the ISM is propellantless: a = a₀(v/v₀)², so v(t) = v₀/(1+t/τ′)
// with τ′ = v₀/a₀. Sketch-level constants: a₀ = 0.25 m/s² at 0.1 c wants a
// ~1,900 km superconducting loop on our 62 kt burnout mass in local-cloud
// densities (~0.3/cm³, magnetic-interaction cross-section of a few loop
// radii). The sail brakes 0.1 c → 4,000 km/s; the 12.4% fusion reserve then
// finishes the capture burn with ~44% margin. Braking the last factor of ten
// in speed would take another century — this is the honest architecture, not
// a convenient one.
export const MAG_A0_MS2 = 0.25;
export const MAG_TAU_YR = (CRUISE_KMS * 1000) / (MAG_A0_MS2 * SEC_PER_YEAR); // ≈ 3.80 yr
export const MAG_V_ARR_KMS = 4_000;
export const MAG_RATIO = CRUISE_KMS / MAG_V_ARR_KMS; // ≈ 7.49
export const MAG_DEPLOY_LY = CRUISE_C * MAG_TAU_YR * Math.log(MAG_RATIO); // ≈ 0.77 ly out
export const MAG_YEARS = MAG_TAU_YR * (MAG_RATIO - 1); // ≈ 24.7 yr
export const CAPTURE_YEARS = 0.3; // propulsive trim into a bound orbit
export const CAPTURE_V_KMS = 40; // post-capture: interplanetary-class speed

// Magsail proper-time profile (fixed shape — constants only, no star)
const MAG_PROFILE = (() => {
  const N = 2048;
  const cumTau = new Float64Array(N + 1);
  const dtYr = MAG_YEARS / N;
  for (let i = 1; i <= N; i++) {
    const u = 1 + ((i - 0.5) / N) * (MAG_YEARS / MAG_TAU_YR);
    const v = CRUISE_KMS / u;
    cumTau[i] = cumTau[i - 1] + dtYr * Math.sqrt(1 - (v / C_KMS) ** 2);
  }
  return { N, cumTau, totalTau: cumTau[N] };
})();

/** Phase boundary times (yr since the TJI burn) for a destination `distanceLy` away. */
export function phaseBoundaries(distanceLy: number) {
  const tJup = TRANSFER.years;
  const tBurnEnd = tJup + BURN_YEARS;
  const cruiseLy = Math.max(0, distanceLy - BURN_DISTANCE_LY - MAG_DEPLOY_LY);
  const tCruiseEnd = tBurnEnd + cruiseLy / CRUISE_C;
  const tMagEnd = tCruiseEnd + MAG_YEARS;
  return {
    tJup,
    tBurnEnd,
    tCruiseEnd,
    tMagEnd,
    tTotal: tMagEnd + CAPTURE_YEARS,
  };
}

/** Total mission duration: TJI + flyby/torch + cruise + magsail brake + capture. */
export function totalYears(distanceLy: number): number {
  return phaseBoundaries(distanceLy).tTotal;
}

/**
 * State of the ship at mission time `t` years since the TJI burn.
 * Phases: transfer ellipse → Jupiter flyby + 2 yr torch → 0.1 c cruise →
 * magsail brake → propulsive capture.
 */
export function missionState(
  distanceLy: number,
  t: number
): MissionState {
  const { tJup, tBurnEnd, tCruiseEnd, tMagEnd } = phaseBoundaries(distanceLy);
  if (t < tJup) {
    // Transfer ellipse coast — decelerating climb out of Sol's well
    const theta = Math.PI * clamp01(t / tJup);
    const v = transferSpeedKms(theta);
    return {
      phase: "TJI",
      rangeAu: transferRangeAu(theta),
      velKms: v,
      remainingLy: distanceLy,
      propPct: 100,
      beta: v / C_KMS,
    };
  }
  if (t < tBurnEnd) {
    // Jupiter flyby folding into the two-year torch burn
    const p = (t - tJup) / BURN_YEARS;
    const i = Math.min(BURN_PROFILE.N, Math.round(p * BURN_PROFILE.N));
    const v = burnSpeedKms(p);
    return {
      phase: p < FLYBY_FRAC ? "FLYBY" : "BURN",
      rangeAu: JUPITER_ORBIT_AU + BURN_PROFILE.cumKm[i] / AU_KM,
      velKms: v,
      remainingLy: Math.max(0, distanceLy - BURN_PROFILE.cumKm[i] / LY_KM),
      propPct: 100 - 87.6 * p,
      beta: v / C_KMS,
    };
  }
  if (t < tCruiseEnd) {
    // Cruise at 0.100 c — the long silence
    const tc = t - tBurnEnd;
    const travelledLy = BURN_DISTANCE_LY + CRUISE_C * tc;
    return {
      phase: "CRUISE",
      rangeAu: BURN_END_RANGE_AU + CRUISE_C * LY_AU * tc,
      velKms: CRUISE_KMS,
      remainingLy: Math.max(0, distanceLy - travelledLy),
      propPct: 12.4,
      beta: CRUISE_C,
    };
  }
  if (t < tMagEnd) {
    // Magsail brake — leaning on the interstellar medium itself
    const tm = t - tCruiseEnd;
    const u = 1 + tm / MAG_TAU_YR;
    const travelledLy = CRUISE_C * MAG_TAU_YR * Math.log(u);
    const v = CRUISE_KMS / u;
    const rangeAu =
      BURN_END_RANGE_AU +
      CRUISE_C * LY_AU * (tCruiseEnd - tBurnEnd) +
      travelledLy * LY_AU;
    return {
      phase: "MAGSAIL",
      rangeAu,
      velKms: v,
      remainingLy: Math.max(0, MAG_DEPLOY_LY - travelledLy),
      propPct: 12.4,
      beta: v / C_KMS,
    };
  }
  // Capture burn — the reserve spends itself to bind us to the star
  const p = clamp01((t - tMagEnd) / CAPTURE_YEARS);
  const v = MAG_V_ARR_KMS + (CAPTURE_V_KMS - MAG_V_ARR_KMS) * smooth(p);
  const rangeSoFar =
    BURN_END_RANGE_AU +
    CRUISE_C * LY_AU * (tCruiseEnd - tBurnEnd) +
    MAG_DEPLOY_LY * LY_AU;
  return {
    phase: "CAPTURE",
    rangeAu: rangeSoFar,
    velKms: v,
    remainingLy: 0,
    propPct: 12.4 - 6.9 * p,
    beta: v / C_KMS,
  };
}

// ── Relativistic plate @ 0.1 c ──────────────────────────────────────────────

/** Ship-board elapsed time τ(t) = ∫dt/γ — the time the crew experiences. */
export function properTimeYears(distanceLy: number, t: number): number {
  const { tJup, tBurnEnd, tCruiseEnd, tMagEnd } = phaseBoundaries(distanceLy);
  if (t <= tJup) return t; // v ≤ 36 km/s: γ−1 ≤ 7×10⁻¹², beneath the dial
  if (t <= tBurnEnd) {
    const i = Math.min(
      BURN_PROFILE.N,
      Math.round(((t - tJup) / BURN_YEARS) * BURN_PROFILE.N)
    );
    return tJup + BURN_PROFILE.cumTau[i];
  }
  const tauBurnEnd = tJup + BURN_PROFILE.totalTau;
  if (t <= tCruiseEnd) {
    return tauBurnEnd + (t - tBurnEnd) * Math.sqrt(1 - CRUISE_C ** 2);
  }
  const tauCruiseEnd =
    tauBurnEnd + (tCruiseEnd - tBurnEnd) * Math.sqrt(1 - CRUISE_C ** 2);
  if (t <= tMagEnd) {
    const i = Math.min(
      MAG_PROFILE.N,
      Math.round(((t - tCruiseEnd) / MAG_YEARS) * MAG_PROFILE.N)
    );
    return tauCruiseEnd + MAG_PROFILE.cumTau[i];
  }
  return tauCruiseEnd + MAG_PROFILE.totalTau + (t - tMagEnd); // capture: γ≈1
}

/** Earth's 8.4 GHz archive beacon, Doppler-shifted by our receding velocity. */
export function solBeaconRxGhz(velKms: number): number {
  const beta = Math.min(0.9, Math.max(0, velKms / C_KMS));
  return 8.4 * Math.sqrt((1 - beta) / (1 + beta));
}

// ── Whipple-stack erosion ─────────────────────────────────────────────────────
// Kinetic flux ∝ v³. Dose calibrated so the stack loses roughly half its
// margin over ~two centuries at 0.1 c (Daedalus beryllium-shield estimates).
export const SHIELD_TAU_YR = 300;

/** Remaining Whipple-shield margin at mission time t, percent. */
export function shieldMarginPct(distanceLy: number, t: number): number {
  const { tJup, tBurnEnd, tCruiseEnd, tMagEnd } = phaseBoundaries(distanceLy);
  let dose = 0;
  if (t > tJup) {
    const i = Math.min(
      BURN_PROFILE.N,
      Math.round(Math.min(1, (t - tJup) / BURN_YEARS) * BURN_PROFILE.N)
    );
    dose += BURN_PROFILE.cumDose[i];
  }
  if (t > tBurnEnd) dose += Math.min(t, tCruiseEnd) - tBurnEnd;
  if (t > tCruiseEnd) {
    // ∫(1+tm/τ′)⁻³ dtm = (τ′/2)(1 − 1/(1+T/τ′)²)
    const tm = Math.min(t, tMagEnd) - tCruiseEnd;
    dose += (MAG_TAU_YR / 2) * (1 - 1 / (1 + tm / MAG_TAU_YR) ** 2);
  }
  return 100 * Math.exp(-dose / SHIELD_TAU_YR);
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

/** Heliocentric range with sane significant digits (AU, then light-years). */
export function fmtRange(rangeAu: number): string {
  if (rangeAu < 100) return `${rangeAu.toFixed(2)} AU`;
  if (rangeAu < LY_AU) return `${Math.round(rangeAu).toLocaleString("en-US")} AU`;
  return `${(rangeAu / LY_AU).toFixed(3)} LY`;
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
