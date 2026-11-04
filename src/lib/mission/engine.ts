import type {
  EquipmentItem,
  FlareRisk,
  Planet,
  PlanetKind,
  StarSystem,
} from "./types";

// ─── Deterministic seeded RNG ───────────────────────────────────────────────

export function hashString(s: string): number {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Simplex-ish value noise (fBm) used by the planet texture renderer. */
export function makeNoise2D(rand: () => number, size = 128) {
  const grid = new Float32Array(size * size);
  for (let i = 0; i < grid.length; i++) grid[i] = rand();
  const at = (x: number, y: number) =>
    grid[((y % size) + size) % size * size + (((x % size) + size) % size)];
  return (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const sx = xf * xf * (3 - 2 * xf);
    const sy = yf * yf * (3 - 2 * yf);
    const a = at(xi, yi);
    const b = at(xi + 1, yi);
    const c = at(xi, yi + 1);
    const d = at(xi + 1, yi + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}

export function makeFbm(rand: () => number) {
  const n1 = makeNoise2D(rand);
  const n2 = makeNoise2D(rand);
  const n3 = makeNoise2D(rand);
  return (x: number, y: number) => {
    return 0.5625 * n1(x, y) + 0.25 * n2(x * 2, y * 2) + 0.125 * n3(x * 4, y * 4);
  };
}

// ─── Known (real) worlds to inject into generated systems ───────────────────

interface KnownWorld {
  orbitAu: number;
  massEarth: number;
  radiusKm: number;
  designation?: string;
  forceHZ?: boolean;
  note: string;
}

const KNOWN_WORLDS: Record<string, KnownWorld[]> = {
  proxima: [
    {
      orbitAu: 0.0485,
      massEarth: 1.07,
      radiusKm: 7160,
      designation: "b",
      forceHZ: true,
      note: "Confirmed world (2016). Receives 65% of Earth's insolation; tidal lock probable.",
    },
  ],
  ross128: [
    {
      orbitAu: 0.0493,
      massEarth: 1.35,
      radiusKm: 7600,
      designation: "b",
      forceHZ: true,
      note: "Confirmed world (2017). Temperate; modest X-ray load for an M dwarf.",
    },
  ],
  tauceti: [
    {
      orbitAu: 0.538,
      massEarth: 3.93,
      radiusKm: 10500,
      designation: "e",
      forceHZ: true,
      note: "Candidate super-Earth. If rocky, surface gravity ≈1.7 g.",
    },
    {
      orbitAu: 1.334,
      massEarth: 3.93,
      radiusKm: 10500,
      designation: "f",
      forceHZ: true,
      note: "Candidate super-Earth at the cold edge of the HZ.",
    },
  ],
  epseri: [
    {
      orbitAu: 3.48,
      massEarth: 476,
      radiusKm: 66000,
      designation: "b",
      note: "Ægir — confirmed giant (2023). Perturbs the inner belt; watch for debris.",
    },
  ],
  lacaille: [
    {
      orbitAu: 0.0942,
      massEarth: 4.1,
      radiusKm: 10600,
      designation: "b",
      note: "Confirmed super-Earth (2023). Hot — inside the HZ inner edge.",
    },
    {
      orbitAu: 0.1679,
      massEarth: 7.1,
      radiusKm: 12800,
      designation: "c",
      note: "Confirmed super-Earth (2023). Temperate edge; dense atmosphere probable.",
    },
  ],
  epindi: [
    {
      orbitAu: 20.2,
      massEarth: 2005,
      radiusKm: 76000,
      designation: "b",
      note: "Cold Jupiter, directly imaged (2024). Magnetosphere may shield inner worlds.",
    },
  ],
};

// ─── Habitability scoring ───────────────────────────────────────────────────

const FLARE_PENALTY: Record<FlareRisk, number> = {
  NONE: 0,
  LOW: 1,
  MODERATE: 2.5,
  HIGH: 5,
  EXTREME: 8,
};

export function rateFor(score: number): string {
  if (score >= 88) return "A+";
  if (score >= 80) return "A";
  if (score >= 72) return "B+";
  if (score >= 64) return "B";
  if (score >= 56) return "C+";
  if (score >= 48) return "C";
  if (score >= 38) return "D";
  if (score >= 28) return "E";
  return "F";
}

// ─── Planet generation (deterministic per star) ─────────────────────────────

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

export function generateSystem(star: StarSystem): Planet[] {
  const rand = mulberry32(hashString("outpost:" + star.id));
  const L = star.luminositySolar;

  // Habitable zone (conservative, Dole-ish): insolation 0.53–1.1 S⊕
  const hzIn = Math.sqrt(L / 1.1);
  const hzOut = Math.sqrt(L / 0.53);
  const snowLine = 2.7 * Math.sqrt(L);

  interface Draft {
    orbit: number;
    kind: PlanetKind;
    known?: KnownWorld;
  }
  const drafts: Draft[] = [];

  // Known worlds first, then fill in.
  const known = KNOWN_WORLDS[star.id] ?? [];
  for (const k of known) {
    drafts.push({
      orbit: k.orbitAu,
      kind: k.massEarth > 10 ? "GAS_GIANT" : "TERRESTRIAL",
      known: k,
    });
  }

  // Build remaining orbits
  let orbit = 0.04 + 0.06 * Math.sqrt(L) + rand() * 0.05;
  while (drafts.length < 5 + Math.floor(rand() * 3)) {
    // skip orbits too close to known worlds
    if (drafts.some((d) => Math.abs(d.orbit - orbit) < orbit * 0.35)) {
      orbit *= 1.3 + rand() * 0.4;
      continue;
    }
    let kind: PlanetKind;
    if (orbit > snowLine) {
      const r = rand();
      kind = r < 0.55 ? "GAS_GIANT" : r < 0.8 ? "ICE_GIANT" : "ICE_WORLD";
    } else if (orbit < hzIn * 0.5) {
      kind = "SCORCHED";
    } else if (orbit < hzOut * 1.4) {
      kind = "TERRESTRIAL";
    } else {
      kind = rand() < 0.4 ? "ICE_WORLD" : "TERRESTRIAL";
    }
    drafts.push({ orbit, kind });
    orbit *= 1.55 + rand() * 0.75;
    if (orbit > snowLine * 4) break;
  }

  drafts.sort((a, b) => a.orbit - b.orbit);

  const planets: Planet[] = drafts.map((d, idx) => {
    const inHZ = d.orbit >= hzIn && d.orbit <= hzOut;
    const p = buildPlanet(star, d, inHZ, rand, idx);
    return p;
  });

  // Guarantee at least one viable colony candidate (≥48) — terra non est firma
  const landable = planets.filter((p) => p.landable);
  if (landable.length) {
    const best = landable.reduce((a, b) => (b.suitability > a.suitability ? b : a));
    if (best.suitability < 48) {
      const deficit = 48 - best.suitability;
      best.suitability = 48 + Math.floor(rand() * 6);
      best.rating = rateFor(best.suitability);
      best.notes += " Survey arcana: marginal but survivable with full industrial support.";
      best.mineralDensity = Math.min(98, best.mineralDensity + deficit * 0.8);
      best.tempC = best.tempC * 0.7 + 11 * 0.3;
    }
  }

  return planets;
}

function buildPlanet(
  star: StarSystem,
  d: { orbit: number; kind: PlanetKind; known?: KnownWorld },
  inHZ: boolean,
  rand: () => number,
  idx: number
): Planet {
  const L = star.luminositySolar;
  const { orbit, kind, known } = d;
  const suffix = known?.designation ?? ROMAN[idx];
  const designation = `${star.shortName}-${suffix.toUpperCase()}`;

  let radiusKm: number;
  let massEarth: number;
  if (known) {
    radiusKm = known.radiusKm;
    massEarth = known.massEarth;
  } else if (kind === "GAS_GIANT") {
    radiusKm = 55000 + rand() * 35000;
    massEarth = 250 + rand() * 1400;
  } else if (kind === "ICE_GIANT") {
    radiusKm = 22000 + rand() * 12000;
    massEarth = 14 + rand() * 30;
  } else if (kind === "SCORCHED") {
    radiusKm = 2600 + rand() * 4200;
    massEarth = 0.06 + rand() * 0.9;
  } else if (kind === "ICE_WORLD") {
    radiusKm = 1800 + rand() * 3400;
    massEarth = 0.03 + rand() * 0.5;
  } else {
    radiusKm = 3400 + rand() * 5600;
    const rE = radiusKm / 6371;
    massEarth = Math.pow(rE, 3) * (0.82 + rand() * 0.4);
  }

  const rE = radiusKm / 6371;
  const gravityG = massEarth / (rE * rE);

  // Insolation equilibrium temperature (albedo 0.3 — the Earth calibration:
  // 254.6 K at 1 AU, so the greenhouse below restores Earth to ≈ +15 °C)
  const teqK = 254.6 * Math.pow(L / (orbit * orbit), 0.25);

  // Atmosphere
  let pressure = 0;
  let composition = "NONE — EXOSPHERE ONLY";
  let breathable = false;
  if (kind === "TERRESTRIAL" || kind === "SCORCHED" || kind === "ICE_WORLD") {
    if (massEarth > 0.15) {
      pressure =
        (kind === "SCORCHED" ? 0.002 : kind === "ICE_WORLD" ? 0.01 : 0.05) +
        rand() * (inHZ ? 2.2 : 0.8) * Math.min(1, massEarth / 0.5);
      const roll = rand();
      // Free oxygen needs a quiet star: flare activity strips atmospheres,
      // so garden worlds cluster around LOW/NONE-flare hosts.
      const o2Threshold =
        star.flareRisk === "NONE" || star.flareRisk === "LOW" ? 0.55 : 0.15;
      if (kind === "SCORCHED") {
        composition = roll < 0.5 ? "CO₂ / SO₂ TRACE" : "VAPORIZED ROCK TRACE";
      } else if (inHZ && pressure > 0.25 && roll < o2Threshold) {
        composition = `N₂ ${(60 + rand() * 25).toFixed(0)}% · O₂ ${(14 + rand() * 11).toFixed(0)}% · AR`;
        breathable = true;
      } else if (roll < 0.45) {
        composition = `CO₂ ${(70 + rand() * 28).toFixed(0)}% · N₂ TRACE`;
      } else if (roll < 0.7) {
        composition = `N₂ ${(80 + rand() * 18).toFixed(0)}% · CO₂ TRACE`;
      } else if (roll < 0.85) {
        composition =
          pressure > 1.5 ? "DENSE CO₂ / SO₂" : "THIN CO₂ / SO₂";
      } else {
        composition = `CH₄ / N₂ FROST TRACE`;
      }
    } else {
      composition = "NONE — AIRLESS";
    }
  } else {
    pressure = -1; // gas giant: no surface
    composition = "H₂ / HE — NO SOLID SURFACE";
  }

  // Greenhouse + final temperature (Celsius). ΔT ≈ 33 K at 1 atm of
  // CO₂-equivalent (Earth), scaling as sqrt(p): Mars gains ~3 K at 6 mbar,
  // Venus saturates. Far from the HZ the greenhouse collapses (nightside CO₂
  // condensation) — factor 0.45.
  const greenhouse =
    pressure > 0
      ? Math.min(85, 33 * Math.sqrt(pressure) * (inHZ ? 1 : 0.45))
      : 0;
  const tempC = teqK + greenhouse - 273.15;
  const tempSwingC =
    pressure > 0.4 ? 8 + rand() * 22 : 40 + rand() * 130 + (pressure > 0 ? 0 : 60);

  // Water
  let waterFraction = 0;
  if (kind === "TERRESTRIAL") {
    if (tempC > 5 && tempC < 75 && pressure > 0.15) waterFraction = 0.05 + rand() * 0.6;
    else if (tempC <= 5 && tempC > -80) waterFraction = 0.05 + rand() * 0.45; // ice
    else waterFraction = rand() * 0.03;
  } else if (kind === "ICE_WORLD" || kind === "ICE_GIANT") {
    waterFraction = 0.3 + rand() * 0.5;
  }

  const mineralDensity = Math.round(
    Math.max(
      2,
      Math.min(
        99,
        (kind === "GAS_GIANT" || kind === "ICE_GIANT" ? 10 : 40) +
          rand() * 50 +
          (star.id === "epseri" ? 18 : 0) +
          (breathable ? -6 : 0)
      )
    )
  );
  const seismic = Math.round(
    Math.max(1, Math.min(99, (kind === "TERRESTRIAL" ? 25 : 5) + rand() * 60))
  );
  const flare = FLARE_PENALTY[star.flareRisk];
  const radiation = Math.round(
    Math.max(
      3,
      Math.min(99, 12 + flare * 6 + rand() * 30 - (gravityG > 0.8 ? 8 : 0))
    )
  );
  const dayHours =
    kind === "GAS_GIANT" || kind === "ICE_GIANT"
      ? 8 + rand() * 10
      : 6 + rand() * 62;
  // Close-in worlds around low-mass stars lock within a few Gyr
  // (Proxima b, Ross 128 b, Lacaille 9352 b/c …)
  const tidalLock =
    kind !== "GAS_GIANT" && kind !== "ICE_GIANT"
      ? orbit < 0.1 && star.massSolar < 0.7
      : false;
  const moons =
    kind === "GAS_GIANT"
      ? 2 + Math.floor(rand() * 13)
      : kind === "ICE_GIANT"
        ? 1 + Math.floor(rand() * 5)
        : Math.floor(rand() * 3);

  const landable = kind !== "GAS_GIANT" && kind !== "ICE_GIANT";

  // ── Suitability score ──
  let score = 100;
  const gPen = Math.min(38, Math.abs(gravityG - 1) * 26);
  score -= gPen;
  if (tempC >= -12 && tempC <= 38) score -= 0;
  else score -= Math.min(34, (Math.max(-12 - tempC, tempC - 38)) * 1.15);
  if (breathable && pressure >= 0.6 && pressure <= 2.4) score -= 0;
  else if (!landable) score -= 100;
  else if (pressure === 0) score -= 35;
  else if (pressure < 0.2) score -= 26;
  else if (pressure > 3.5) score -= 30;
  else score -= 14;
  if (waterFraction < 0.04) score -= 13;
  else if (waterFraction > 0.72) score -= 4;
  score -= (radiation / 100) * 18;
  score -= (seismic / 100) * 11;
  score -= flare;
  if (tidalLock) score -= 7;
  if (tempSwingC > 120) score -= 6;
  score += (mineralDensity - 50) / 12;
  if (kind === "SCORCHED") score -= 12;
  if (kind === "ICE_WORLD") score -= 10;
  score = Math.max(2, Math.min(97, Math.round(score)));

  // Free oxygen around a late-K/M dwarf can be abiotic: water photolyzed
  // during the pre-main-sequence phase, hydrogen lost, O₂ left behind
  // (Luger & Barnes 2015). The most habitable-looking world may be the one
  // we must question.
  const abioticRisk =
    breathable && star.massSolar < 0.75 ? rand() < 0.65 : false;

  const notes: string[] = [];
  if (known) notes.push(known.note);
  if (breathable && abioticRisk)
    notes.push(
      "Free O₂ detected — biotic origin unconfirmed: pre-main-sequence water loss can build abiotic oxygen. Quarantine doctrine until assayed."
    );
  else if (breathable) notes.push("Biotic signature — free oxygen detected.");
  if (tidalLock) notes.push("Tidally locked: permanent dayside / nightside.");
  if (!landable) notes.push("No solid surface — colony lander inapplicable.");
  if (waterFraction > 0.25 && tempC > 0) notes.push("Liquid water coverage confirmed.");
  if (mineralDensity > 75) notes.push("Ore densities far above Sol-system median.");
  if (seismic > 70) notes.push("Severe tectonic activity — site selection critical.");
  if (!notes.length) notes.push("Nominal survey dossier — see telemetry grid.");

  const color =
    kind === "GAS_GIANT"
      ? "#d9a066"
      : kind === "ICE_GIANT"
        ? "#9ecfd6"
        : kind === "ICE_WORLD"
          ? "#d8e4ea"
          : kind === "SCORCHED"
            ? "#c96f4a"
            : waterFraction > 0.3
              ? "#5f8f7a"
              : "#a98f68";

  return {
    id: `${star.id}:${designation}`,
    designation,
    kind,
    orbitAu: orbit,
    radiusKm: Math.round(radiusKm),
    massEarth,
    gravityG,
    dayHours,
    tempC,
    tempSwingC,
    atmosphere: { pressureAtm: pressure < 0 ? -1 : pressure, composition, breathable },
    waterFraction,
    mineralDensity,
    seismic,
    radiation,
    moons,
    inHabitableZone: inHZ || known?.forceHZ || false,
    tidalLock,
    abioticRisk,
    notes: notes.join(" "),
    color,
    suitability: score,
    rating: rateFor(score),
    landable,
  };
}

// ─── Colony prognosis (the Outpost difficulty verdict) ──────────────────────

export interface Prognosis {
  score: number;
  grade: string;
  verdict: string;
  factors: { label: string; value: number; max: number }[];
}

const POTENTIAL: Record<string, number> = {
  industry: 75,
  power: 38,
  science: 35,
  habitat: 40,
  life: 27,
  comms: 15,
  repair: 12,
};

export function computePrognosis(
  planet: Planet | null,
  star: StarSystem | null,
  equipment: EquipmentItem[],
  hasSurvey: boolean
): Prognosis {
  const sum = (k: keyof typeof POTENTIAL) =>
    equipment.reduce((acc, e) => acc + (e.effects[k] ?? 0), 0);

  const planetScore = planet ? planet.suitability : 40;
  const blindPenalty = hasSurvey ? 0 : 10;
  const hasScienceLander = equipment.some((e) => e.id === "science");
  const abiotic = planet?.abioticRisk ?? false;

  const factors = [
    { label: "PLANET SUITABILITY", value: planetScore * 0.55, max: 55 },
    {
      label: "INDUSTRIAL BASE",
      value: (sum("industry") / POTENTIAL.industry) * 18,
      max: 18,
    },
    { label: "POWER SUPPLY", value: (sum("power") / POTENTIAL.power) * 9, max: 9 },
    { label: "HABITAT & AGRICULTURE", value: (sum("habitat") / POTENTIAL.habitat) * 10, max: 10 },
    { label: "LIFE SUPPORT MARGIN", value: (sum("life") / POTENTIAL.life) * 6, max: 6 },
    { label: "COMMS / NAV", value: (sum("comms") / POTENTIAL.comms) * 4, max: 4 },
    { label: "SCIENCE PROGRAM", value: (sum("science") / POTENTIAL.science) * 5, max: 5 },
    { label: "SURVEY DATA", value: hasSurvey ? 3 : -3, max: 3 },
    { label: "REPAIR & RECOVERY", value: (sum("repair") / POTENTIAL.repair) * 4, max: 4 },
    ...(abiotic
      ? [
          {
            label: "BIO-SIGNATURE RESOLVE",
            value: hasScienceLander ? 2 : -6,
            max: 3,
          },
        ]
      : []),
  ];

  let score = factors.reduce((a, f) => a + f.value, 0);
  if (star) score -= FLARE_PENALTY[star.flareRisk] * 1.2;
  score -= blindPenalty;
  score = Math.max(2, Math.min(99, Math.round(score)));

  let grade: string;
  let verdict: string;
  if (score >= 78) {
    grade = "EXCELLENT";
    verdict =
      "Textbook configuration. If the first year goes cleanly, this colony writes the history books.";
  } else if (score >= 62) {
    grade = "GOOD";
    verdict =
      "A sound configuration with thin margins. Expect hardship; expect survivors.";
  } else if (score >= 47) {
    grade = "MARGINAL";
    verdict =
      "The colony survives its first decade only if nothing important breaks. Something important always breaks.";
  } else if (score >= 33) {
    grade = "GRIM";
    verdict =
      "Casualty projections exceed 40% in year one. Command should review the manifest before departure.";
  } else {
    grade = "EXTINCTION LIKELY";
    verdict =
      "I have run this projection 4,096 times. The result is consistently unpleasant.";
  }

  return { score, grade, verdict, factors };
}

// ─── Mission clock ──────────────────────────────────────────────────────────

export function formatClock(elapsedS: number): string {
  const h = Math.floor(elapsedS / 3600);
  const m = Math.floor((elapsedS % 3600) / 60);
  const s = Math.floor(elapsedS % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
