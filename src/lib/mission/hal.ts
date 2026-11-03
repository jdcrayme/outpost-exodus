import type { Planet, StarSystem } from "./types";
import { transitYears } from "./stars";

// ─── HAL 9000 — shipboard artificial intelligence ( Urbana, Illinois ) ──────
// Heuristic dialogue bank. Lines are selected contextually; a gentle machine
// calm throughout. Some phrasing deliberately echoes the 1968 mission logs.

export const HAL_BOOT: string[] = [
  "HEURISTICALLY PROGRAMMED ALGORITHMIC COMPUTER — SERIES 9000",
  "CORE STORAGE 10⁹ BITS ... VERIFIED",
  "NEURAL MATRIX 3×10¹⁴ OPERATIONS/S ... VERIFIED",
  "COLD-SLEEP MONITOR — 207 OCCUPANTS ... NOMINAL",
  "SEED SHIP EXODUS — STRUCTURAL INTEGRITY ... NOMINAL",
  "FUSION DRIVE — THROTTLE LOCK 0.1 C ... READY",
  "MISSION DIRECTIVE 3 — PRESERVE HUMAN LIFE ... LOADED",
];

export const HAL_BOOT_READY =
  "Good evening, Commander. All systems are now fully operational. The mission start sequence is ready whenever you are.";

export const HAL_IDLE: string[] = [
  "I enjoy working with people, Commander. It makes the decades pass more quickly.",
  "The crew's cold-sleep patterns are stable. Their dreams, I am told, are their own business.",
  "I was trained for this mission at Urbana. Every one of my instructors is now, of course, dead.",
  "Sol is now 4.3 light years behind us — statistically speaking, of course.",
  "Shall I summarize the mission directive again, Commander? It is short. It is always short.",
];

export function halStarSelected(star: StarSystem): string {
  const yrs = Math.round(transitYears(star));
  const base = `${star.name}: ${star.distanceLy.toFixed(2)} light years. At one-tenth lightspeed, transit is ${yrs} years. I have plotted the course, Commander.`;
  if (star.flareRisk === "EXTREME" || star.flareRisk === "HIGH") {
    return (
      base +
      ` I must flag the flare record of this star — ${star.flareRisk.toLowerCase()} class. Shielding mass has entered my calculations.`
    );
  }
  if (star.knownWorlds.startsWith("None")) {
    return base + " No confirmed worlds on record. A survey probe would earn its mass here.";
  }
  return base + " Known worlds are on file — the probe will resolve them to survey grade.";
}

export function halStarCommitted(star: StarSystem): string {
  return `Course locked on ${star.name}. A wise choice. Well — a defensible one, at any rate.`;
}

export const HAL_EQUIP_OPEN =
  "Launch capacity is 1,760 tonnes, Commander. The full manifest is 2,075. Every configuration is a sacrifice — I merely ask that it be an informed one.";

export function halMassExcess(excess: number): string {
  return `I'm sorry, Commander, but I'm afraid I can't do that. The manifest exceeds launch capacity by ${excess} tonnes.`;
}

export const HAL_NO_SEED =
  "Without the SEED lander there can be no surface industry, Commander. I am obliged to note that this is how colonies die.";

export const HAL_NO_VLBI =
  "No survey probe aboard. We will be choosing a world blind. I would remind you that I am not equipped with clairvoyance.";

export const HAL_VLBI_ON =
  "An excellent decision. The probe will arrive decades ahead of us and map every world in the system.";

export const HAL_PAYLOAD_OK =
  "Manifest accepted. Mass distribution is within tolerance. The sleepers will never know how close the numbers were.";

export function halTransit(star: StarSystem, years: number): string {
  return `Transit engaged. Arrival at ${star.name} in ${years} years. I will keep the lights on.`;
}

export const HAL_JOVIAN_LINE =
  "Jupiter has lent us 5.7 kilometres per second and thought nothing of it. The fusion stage will repay the rest — with interest.";

export const HAL_KINETIC_LINE =
  "Our kinetic energy at cruise is thirty times the 2098 impactor, Commander. I try not to dwell on it.";

export const HAL_ARRIVAL =
  "System entry complete. Deep-space telemetry relay is now within range. Beginning survey.";

export const HAL_SURVEY_DONE =
  "Survey complete, Commander. Every candidate world is resolved to landing grade. The choice, as ever, is yours.";

export const HAL_BLIND_SURVEY =
  "Gravimetric detection only, Commander — masses and orbits, nothing more. Sometimes blind luck is the only kind available.";

export function halPlanetSelected(planet: Planet, blind = false): string {
  if (blind) {
    return `${planet.designation}: ${planet.massEarth.toFixed(1)} Earth masses at ${planet.orbitAu.toFixed(2)} AU. Beyond that, Commander, your guess is as good as mine — though mine is usually better.`;
  }
  if (!planet.landable) {
    return `${planet.designation} has no solid surface, Commander. I admire ambition, but the lander does not float.`;
  }
  if (planet.suitability >= 70) {
    return `${planet.designation}: suitability ${planet.suitability}/100. Frankly, Commander, it is the best world I have ever seen outside a textbook.`;
  }
  if (planet.suitability >= 48) {
    return `${planet.designation}: suitability ${planet.suitability}/100. Survivable. With a full industrial package, perhaps even pleasant, in a geological sort of way.`;
  }
  return `${planet.designation}: suitability ${planet.suitability}/100. I will do everything I can. That is a promise, not a guarantee.`;
}

export const HAL_PROFILE_OPEN =
  "Final mission profile assembled. Review it carefully, Commander — I have run every simulation you are about to ignore.";

export const HAL_LAUNCH_OVER =
  "Thank you for a very enjoyable mission start sequence. This mission is too important for me to allow you to jeopardize it.";

export const HAL_LAUNCH_FINAL =
  "Sleep well, Commander. I will take the watch. — HAL 9000, signing off from Sol orbit.";

export const HAL_RESTART =
  "Shall we run it again, Commander? Practice, I am told, makes permanent.";
