// ─── Crew manifest — the 207 souls of the seed ship EXODUS ───────────────────
// Pure data, no React. Deterministic from fixed seeds (charter §1: same star,
// same planets, same crew — forever). The roster is a document of record: the
// crew was mustered when the keel was laid, so nothing here varies with the
// destination or the payload. Generation is ADDRESS-KEYED — every member's
// seed derives from their berth address (bay × berth), and only the flavour
// fields (name, age, origin, record) come from that seed. Constraint fields
// (role coverage) are decided one level up, at the cohort seed, so editing a
// name pool can never reshuffle faces, ages, or coverage.
//
// Doctrine (mirrors REV E's bay dispersion, ship.ts):
//   one cohort per bay — 12 × 17 sleepers + a watch of 3 = 207
//   every cohort carries all eight civilizational functions, so ANY single
//   surviving bay can rebuild the colony. That constraint is asserted at
//   module load, not assumed.
//
// Berth numbering is a drawing convention shared with the blueprint: berths
// 01–09 ride the dorsal row of the bay, 10–17 the ventral row; the watch
// occupies berths W-01…W-03 in the command sphere. The portrait layer
// (portraits.ts, DESIGN_NOTES §4 REV B) keys off the same member seed shown
// here as the face code.

import { mulberry32, hashString } from "./engine";
import {
  BAYS,
  BAY_COUNT,
  BERTHS_PER_BAY,
  type ColdSleepBay,
} from "./ship";
import { CREW_COUNT } from "./astro";

// ── Skill axes — six, reviewed on the dossier line as CMD/LFE/MED/IND/SCI/CUL ──

export type SkillId = "command" | "life" | "medicine" | "industry" | "science" | "culture";

export const SKILL_AXES: { id: SkillId; label: string }[] = [
  { id: "command", label: "CMD" },
  { id: "life", label: "LFE" },
  { id: "medicine", label: "MED" },
  { id: "industry", label: "IND" },
  { id: "science", label: "SCI" },
  { id: "culture", label: "CUL" },
];

export type Skills = Record<SkillId, number>; // 1–9

export interface CrewMember {
  id: string; // "W-01" watch · "C-04-11" bay C-04, berth 11
  name: string;
  sex: "F" | "M";
  age: number;
  origin: string; // "PUNE IN"
  role: string;
  record: string; // "11 Y · CERES YARDS"
  skills: Skills;
  bay: string; // "COMMAND" | bay id
  berth: number; // watch 1–3 · sleepers 1–17
  cohort: number; // 0 = watch · 1–12
  seed: number; // face code source — Elite homage, shown in hex
}

// ── Curated multi-region name pools — romanized, uppercase mono doc style ────

interface Region {
  id: string;
  givenF: string[];
  givenM: string[];
  surnames: string[];
  origins: string[];
}

const REGIONS: Region[] = [
  {
    id: "ANGLO",
    givenF: ["MIRIAM", "KATE", "RUTH", "HAZEL", "AUDREY", "EDITH", "VIVIAN", "JOAN"],
    givenM: ["OWEN", "MARTIN", "ALISTAIR", "JONAH", "HUGH", "EDGAR", "RONAN", "MALCOLM"],
    surnames: ["HALE", "WHITFIELD", "FAIRBANKS", "MERRITT", "CALLOWAY", "ASHBY", "STRAND", "PILGRIM"],
    origins: ["MANCHESTER UK", "AUCKLAND NZ", "TORONTO CA", "VALLES MARS"],
  },
  {
    id: "WEST AFRICA",
    givenF: ["ADAEZE", "AMARA", "CHIOMA", "NGOZI", "FOLAKE", "ABENA", "YAA", "EKENE"],
    givenM: ["CHUKWU", "EMEKA", "KOFI", "KWAME", "SEUN", "TUNDE", "EKAETE", "FEMI"],
    surnames: ["OKONKWO", "ABIOYE", "MENSAH", "OYELARAN", "EZE", "ADEYEMI", "BOATENG", "NWOSU"],
    origins: ["LAGOS NG", "ACCRA GH", "ENUGU NG", "KUMASI GH"],
  },
  {
    id: "EAST AFRICA",
    givenF: ["AMINA", "NEEMA", "SEBLE", "HIWOT", "MARIAM", "TSION", "AZIZA", "HALIMA"],
    givenM: ["TADESE", "JELANI", "BARAKA", "MUSA", "GETACHEW", "YOUSUF", "TESHOME", "KASSA"],
    surnames: ["TESFAYE", "ABEBE", "MENGISTU", "OKELLO", "KIPRUTO", "WEREG", "MKUMBA", "NEGASH"],
    origins: ["ADDIS ABABA ET", "NAIROBI KE", "DAR ES SALAAM TZ", "KAMPALA UG"],
  },
  {
    id: "SINOSPHERE",
    givenF: ["XUE", "MEILING", "YAN", "QING", "LIAN", "FEN", "JING", "TAO"],
    givenM: ["WEI", "DEMING", "HAO", "JIAN", "ZHEN", "BO", "GUANG", "MINGZHE"],
    surnames: ["ZHANG", "LI", "CHEN", "HUANG", "SU", "SHEN", "GUO", "LIN"],
    origins: ["XI'AN CN", "GUANGZHOU CN", "TAIPEI TW", "SHANGHAI CN", "HONG KONG HK"],
  },
  {
    id: "INDOSPHERE",
    givenF: ["PRIYA", "MEERA", "ANJALI", "LATA", "DEVI", "SUNAINA", "KIRAN", "ROHINI"],
    givenM: ["ARJUN", "VIKRAM", "RAJESH", "SURESH", "DEV", "KARTIK", "NIRANJAN", "BHASKAR"],
    surnames: ["IYER", "REDDY", "CHATTERJEE", "PILLAI", "NAIR", "BOSE", "MEHTA", "RAO"],
    origins: ["PUNE IN", "CHENNAI IN", "KOLKATA IN", "BENGALURU IN"],
  },
  {
    id: "HISPANOSPHERE",
    givenF: ["LUZ", "INES", "CARMEN", "PALOMA", "ROSA", "ELENA", "ALBA", "MERCEDES"],
    givenM: ["MATEO", "JOAQUIN", "RAUL", "TOMAS", "EMILIO", "ANDRES", "IGNACIO", "SALVADOR"],
    surnames: ["VALVERDE", "QUINTANA", "MOLINA", "SERRANO", "IBARRA", "CANO", "REYES", "DUARTE"],
    origins: ["VALPARAISO CL", "BOGOTA CO", "GUADALAJARA MX", "SEVILLE ES"],
  },
  {
    id: "LUSOSPHERE",
    givenF: ["VIVIANE", "LUCIA", "MARIANA", "BIANCA", "RAQUEL", "DULCE", "NERA", "CLEIA"],
    givenM: ["THIAGO", "CAIO", "GUSTAVO", "RAIMUNDO", "HELIO", "TIAGO", "AMILCAR", "DARIO"],
    surnames: ["AMARAL", "COUTINHO", "SALGADO", "FREITAS", "NASCIMENTO", "BITTENCOURT", "TEIXEIRA", "FARIA"],
    origins: ["SAO PAULO BR", "RECIFE BR", "BELO HORIZONTE BR", "LUANDA AO"],
  },
  {
    id: "FRANCOSPHERE",
    givenF: ["SOLANGE", "MARGAUX", "AMINATA", "COLETTE", "FATOU", "MAELIS", "ODILE", "SYLVIE"],
    givenM: ["ETIENNE", "LUCIEN", "MOCTAR", "ALPHONSE", "DIDIER", "GAETAN", "KARIM", "PASCAL"],
    surnames: ["TRAORE", "DIALLO", "BEAUMONT", "LAVIGNE", "KONE", "SOW", "MARCHAND", "OKOYO"],
    origins: ["DAKAR SN", "LYON FR", "BAMAKO ML", "QUEBEC CA"],
  },
  {
    id: "SLAVOSPHERE",
    givenF: ["VERA", "NADIA", "ZOFIA", "LUDMILA", "DARINA", "MILICA", "ELENA", "BOZENA"],
    givenM: ["MILOS", "IVAN", "DMYTRO", "PAVEL", "GEORGI", "RADOSLAV", "JAKUB", "LEV"],
    surnames: ["VORONTSOV", "KOVAC", "ZEMAN", "LITVIN", "HORAK", "PETRENKO", "MOZHAV", "SOKOL"],
    origins: ["NOVOSIBIRSK RU", "WARSAW PL", "ODESA UA", "SOFIA BG"],
  },
  {
    id: "ARABOSPHERE",
    givenF: ["LAYLA", "HIND", "NOUR", "RANIA", "SAMIRA", "DANA", "HANAN", "RUQAYYA"],
    givenM: ["TARIQ", "YOUSEF", "KARIM", "HADI", "OMRAN", "SAIF", "ZIAD", "NABIL"],
    surnames: ["HALABI", "MASRI", "NADIM", "SHAHEEN", "AZIZ", "KHOURY", "HAMDAN", "SULAYMAN"],
    origins: ["CASABLANCA MA", "DUBAI AE", "AMMAN JO", "TUNIS TN"],
  },
  {
    id: "JAPAN/KOREA",
    givenF: ["AIKO", "YUMI", "HANA", "EUNBI", "CHAEWON", "MIYAKO", "SOOAH", "NAOMI"],
    givenM: ["HARUTO", "KENJI", "MINJUN", "DOYUN", "TAIKI", "REN", "SEUNGMIN", "JAEHA"],
    surnames: ["SAITO", "KOBAYASHI", "BAE", "JUNG", "OKADA", "HAN", "ITSUKI", "PARK"],
    origins: ["OSAKA JP", "BUSAN KR", "SAPPORO JP", "JEJU KR"],
  },
];

// ── Roles ────────────────────────────────────────────────────────────────────
// CORE_ROLES: the eight civilizational functions every cohort must carry.
// FILL_ROLES: weighted general pool for the remaining berths.
// The senior (berth 01) leads the cohort through the wake-order era.

export const CORE_ROLES = [
  "PHYSICIAN",
  "AGRONOMIST",
  "FABRICATOR",
  "POWER ENGINEER",
  "GEOLOGIST",
  "TEACHER",
  "ECOLOGIST",
  "GENETICIST",
] as const;

export const FILL_ROLES: { role: string; w: number }[] = [
  { role: "TECHNICIAN", w: 3 },
  { role: "MEDIC", w: 2 },
  { role: "FABRICATOR", w: 2 },
  { role: "CHEMIST", w: 2 },
  { role: "PILOT", w: 1 },
  { role: "DATA ARCHIVIST", w: 1 },
  { role: "LOGISTICS OFFICER", w: 1 },
  { role: "BOTANIST", w: 1 },
  { role: "SURVEYOR", w: 1 },
  { role: "NETWORK ENGINEER", w: 1 },
  { role: "METALLURGIST", w: 1 },
  { role: "NURSE", w: 1 },
];

// role → (axis, floor) — the member's own trade is never left to chance.
// Exported so the dossier can mark the mastery axis in phos.
export const ROLE_MASTERY: Record<string, { axis: SkillId; lo: number; hi: number }> = {
  "COHORT SENIOR": { axis: "command", lo: 8, hi: 9 },
  PHYSICIAN: { axis: "medicine", lo: 8, hi: 9 },
  MEDIC: { axis: "medicine", lo: 6, hi: 8 },
  NURSE: { axis: "medicine", lo: 6, hi: 8 },
  AGRONOMIST: { axis: "life", lo: 8, hi: 9 },
  BOTANIST: { axis: "life", lo: 7, hi: 9 },
  ECOLOGIST: { axis: "life", lo: 7, hi: 9 },
  FABRICATOR: { axis: "industry", lo: 8, hi: 9 },
  "POWER ENGINEER": { axis: "industry", lo: 8, hi: 9 },
  TECHNICIAN: { axis: "industry", lo: 6, hi: 9 },
  "NETWORK ENGINEER": { axis: "industry", lo: 6, hi: 8 },
  METALLURGIST: { axis: "industry", lo: 7, hi: 9 },
  GEOLOGIST: { axis: "science", lo: 8, hi: 9 },
  CHEMIST: { axis: "science", lo: 7, hi: 9 },
  GENETICIST: { axis: "science", lo: 7, hi: 9 },
  SURVEYOR: { axis: "science", lo: 6, hi: 8 },
  PILOT: { axis: "command", lo: 7, hi: 9 },
  "LOGISTICS OFFICER": { axis: "command", lo: 6, hi: 8 },
  TEACHER: { axis: "culture", lo: 8, hi: 9 },
  "DATA ARCHIVIST": { axis: "culture", lo: 7, hi: 9 },
  // watch
  "MISSION COMMANDER": { axis: "command", lo: 9, hi: 9 },
  ASTROGATOR: { axis: "science", lo: 9, hi: 9 },
  "FLIGHT SURGEON": { axis: "medicine", lo: 9, hi: 9 },
};

const FILL_TOTAL = FILL_ROLES.reduce((a, r) => a + r.w, 0);

function pickFill(rand: () => number): string {
  let t = rand() * FILL_TOTAL;
  for (const r of FILL_ROLES) {
    t -= r.w;
    if (t <= 0) return r.role;
  }
  return FILL_ROLES[0].role;
}

// ── Service records — orgs of the 2080s interplanetary boom ──────────────────

const SERVICE_ORGS = [
  "CERES YARDS",
  "VALLES SHIPWORKS",
  "LUNA ACADEMY",
  "KOUROU LINE",
  "DEIMOS FOUNDRY",
  "SVALBARD ARCHIVE",
  "TYCHO GRID",
  "BAFFIN RELAY",
  "AMBOSELI CLINIC",
  "JIUQUAN RANGE",
  "OUTPOST PROGRAM",
  "THARSIS ROADS",
];

const WATCH_ORGS = ["OUTPOST PROGRAM", "LUNA ACADEMY", "FLEET OPERATIONS"];

// ── Name assembly with roster-wide de-duplication ────────────────────────────

const seenNames = new Set<string>();

function drawName(rand: () => number): { name: string; sex: "F" | "M"; region: Region } {
  const region = REGIONS[Math.floor(rand() * REGIONS.length)];
  for (let attempt = 0; attempt < 8; attempt++) {
    const sex: "F" | "M" = rand() < 0.5 ? "F" : "M";
    const given = (sex === "F" ? region.givenF : region.givenM)[
      Math.floor(rand() * (sex === "F" ? region.givenF : region.givenM).length)
    ];
    const surname = region.surnames[Math.floor(rand() * region.surnames.length)];
    const name = `${given} ${surname}`;
    if (!seenNames.has(name)) {
      seenNames.add(name);
      return { name, sex, region };
    }
  }
  // pools exhausted for this roll — force a middle initial, keep going
  const sex: "F" | "M" = rand() < 0.5 ? "F" : "M";
  const name = `${(sex === "F" ? region.givenF : region.givenM)[0]} ${region.surnames[0]} ${"ACDEJKLMNPRSTV"[Math.floor(rand() * 15)]}`;
  seenNames.add(name);
  return { name, sex, region };
}

// ── One member from their berth address + role (role comes from above) ───────

function buildMember(
  bay: string,
  berth: number,
  cohort: number,
  role: string,
  seed: number,
  ageRange: [number, number],
  orgs: string[]
): CrewMember {
  const rand = mulberry32(seed);
  const { name, sex, region } = drawName(rand);
  const age = ageRange[0] + Math.floor(rand() * (ageRange[1] - ageRange[0] + 1));
  const origin = region.origins[Math.floor(rand() * region.origins.length)];
  const yrs = 4 + Math.floor(rand() * 15);
  const org = orgs[Math.floor(rand() * orgs.length)];
  const skills: Skills = {
    command: 1 + Math.floor(rand() * 9),
    life: 1 + Math.floor(rand() * 9),
    medicine: 1 + Math.floor(rand() * 9),
    industry: 1 + Math.floor(rand() * 9),
    science: 1 + Math.floor(rand() * 9),
    culture: 1 + Math.floor(rand() * 9),
  };
  const mastery = ROLE_MASTERY[role];
  if (mastery) skills[mastery.axis] = mastery.lo + Math.floor(rand() * (mastery.hi - mastery.lo + 1));
  return {
    id: cohort === 0 ? `W-${String(berth).padStart(2, "0")}` : `${bay}-${String(berth).padStart(2, "0")}`,
    name,
    sex,
    age,
    origin,
    role,
    record: `${yrs} Y · ${org}`,
    skills,
    bay,
    berth,
    cohort,
    seed,
  };
}

// ── The watch — three berths in the command sphere, awake at departure ───────

export const WATCH_ROLES = [
  "MISSION COMMANDER",
  "ASTROGATOR",
  "FLIGHT SURGEON",
];

// NOTE: ship.ts exports WATCH_CREW = 3 (the count). This array is WATCH.
export const WATCH: CrewMember[] = WATCH_ROLES.map((role, i) =>
  buildMember(
    "COMMAND",
    i + 1,
    0,
    role,
    hashString(`exodus:watch:${i + 1}`),
    [38, 58],
    WATCH_ORGS
  )
);

// ── The twelve cohorts — coverage first, flavour second ──────────────────────
// Berth 01 is the cohort senior; berths 02–09 carry the eight core functions
// (order shuffled per cohort); berths 10–17 fill from the weighted pool.

function cohortRoles(rand: () => number): string[] {
  const core = [...CORE_ROLES];
  // deterministic in-place shuffle of the core eight across berths 02–09
  for (let i = core.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [core[i], core[j]] = [core[j], core[i]];
  }
  const fill: string[] = [];
  for (let b = 0; b < 8; b++) fill.push(pickFill(rand));
  return ["COHORT SENIOR", ...core, ...fill];
}

interface Cohort {
  bay: ColdSleepBay;
  members: CrewMember[];
}

const COHORT_LIST: Cohort[] = BAYS.map((bay) => {
  const rand = mulberry32(hashString(`exodus:cohort:${bay.cohort}`));
  const roles = cohortRoles(rand);
  const members = Array.from({ length: BERTHS_PER_BAY }, (_, k) =>
    buildMember(
      bay.id,
      k + 1,
      bay.cohort,
      roles[k],
      hashString(`${bay.id}:${String(k + 1).padStart(2, "0")}`),
      k === 0 ? [38, 58] : [24, 58], // seniors skew older — they were chosen to lead
      SERVICE_ORGS
    )
  );
  return { bay, members };
});

// ── Public roster ────────────────────────────────────────────────────────────

export const COHORTS = COHORT_LIST;
export const CREW: CrewMember[] = [...WATCH, ...COHORT_LIST.flatMap((c) => c.members)];

export const CREW_BY_ID: Map<string, CrewMember> = new Map(
  CREW.map((m) => [m.id, m])
);

/** Face code — the member seed in hex, the Elite (1984) homage. */
export function faceCode(m: CrewMember): string {
  return m.seed.toString(16).toUpperCase().padStart(8, "0");
}

/** The axis a given role masters — null for unlisted fill roles. */
export function masteryAxis(role: string): SkillId | null {
  return ROLE_MASTERY[role]?.axis ?? null;
}

// ── Load-time assertions — the doctrine is checked, not assumed ──────────────

if (CREW.length !== CREW_COUNT) {
  throw new Error(`crew roster drifted: ${CREW.length} != CREW_COUNT ${CREW_COUNT}`);
}
if (COHORT_LIST.length !== BAY_COUNT) {
  throw new Error(`cohort count drifted: ${COHORT_LIST.length} != BAY_COUNT ${BAY_COUNT}`);
}
for (const c of COHORT_LIST) {
  if (c.members.length !== BERTHS_PER_BAY) {
    throw new Error(`cohort ${c.bay.id} has ${c.members.length} berths`);
  }
  const have = new Set(c.members.map((m) => m.role));
  for (const r of CORE_ROLES) {
    if (!have.has(r)) throw new Error(`cohort ${c.bay.id} is missing the ${r} function`);
  }
  if (!have.has("COHORT SENIOR")) {
    throw new Error(`cohort ${c.bay.id} has no senior`);
  }
  if (c.members[0].role !== "COHORT SENIOR") {
    throw new Error(`cohort ${c.bay.id}: berth 01 must be the senior`);
  }
  // roster-wide name uniqueness (the manifest is a document of record)
  if (new Set(c.members.map((m) => m.name)).size !== BERTHS_PER_BAY) {
    throw new Error(`cohort ${c.bay.id} has duplicate names`);
  }
}
if (new Set(CREW.map((m) => m.name)).size !== CREW.length) {
  throw new Error("roster has duplicate names across cohorts");
}
