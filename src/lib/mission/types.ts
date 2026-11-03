// ─── OUTPOST // EXODUS — Mission data types ─────────────────────────────────

export type FlareRisk = "NONE" | "LOW" | "MODERATE" | "HIGH" | "EXTREME";

export interface StarSystem {
  id: string;
  name: string;
  shortName: string; // used for planet designations
  catalog: string;
  distanceLy: number;
  ra: number; // hours
  dec: number; // degrees
  spectral: string;
  massSolar: number;
  luminositySolar: number;
  companions: string;
  flareRisk: FlareRisk;
  knownWorlds: string;
  notes: string;
  color: string;
}

export type PlanetKind =
  | "TERRESTRIAL"
  | "GAS_GIANT"
  | "ICE_GIANT"
  | "ICE_WORLD"
  | "SCORCHED";

export interface AtmosphereSpec {
  pressureAtm: number; // 0 = airless
  composition: string;
  breathable: boolean;
}

export interface Planet {
  id: string;
  designation: string;
  kind: PlanetKind;
  orbitAu: number;
  radiusKm: number;
  massEarth: number;
  gravityG: number;
  dayHours: number;
  tempC: number;
  tempSwingC: number;
  atmosphere: AtmosphereSpec;
  waterFraction: number; // 0–1
  mineralDensity: number; // 0–100
  seismic: number; // 0–100
  radiation: number; // 0–100
  moons: number;
  inHabitableZone: boolean;
  tidalLock: boolean;
  notes: string;
  color: string;
  suitability: number; // 0–100
  rating: string; // A+ … F
  landable: boolean;
}

export type EquipmentCategory = "ORBITAL ASSETS" | "LANDERS" | "SUPPORT SYSTEMS";

export interface EquipmentEffects {
  industry?: number;
  science?: number;
  power?: number;
  comms?: number;
  habitat?: number;
  life?: number;
  survey?: boolean;
}

export interface EquipmentItem {
  id: string;
  name: string;
  code: string;
  category: EquipmentCategory;
  massT: number;
  powerKw: number;
  reliability: number; // %
  role: string;
  desc: string;
  required?: boolean;
  effects: EquipmentEffects;
}

export interface MissionState {
  starId: string | null;
  equipment: string[];
  planetId: string | null;
}

export type Phase = "BOOT" | "STAR" | "EQUIP" | "TRANSIT" | "PLANET" | "PROFILE";

export interface LogEntry {
  t: string; // mission clock stamp
  text: string;
}
