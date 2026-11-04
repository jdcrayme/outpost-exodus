import { STARS } from "../src/lib/mission/stars";
import { generateSystem } from "../src/lib/mission/engine";
for (const s of STARS) {
  const ps = generateSystem(s);
  for (const p of ps) {
    if (p.atmosphere.breathable)
      console.log(`${s.shortName} ${p.designation} suit=${p.suitability} temp=${p.tempC.toFixed(0)}C mass=${s.massSolar} abiotic=${p.abioticRisk}`);
  }
}
