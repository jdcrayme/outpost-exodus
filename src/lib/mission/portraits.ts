// ─── Procedural portraits — the member seed, read as a face ──────────────────
// Pure lib, no React, no DOM (it must run at import — in the browser and during
// next build's prerender — and in Node for the contact-sheet tooling). Every
// face is a deterministic function of the member record (charter §1: same
// crew, same faces — forever). The dossier face code shows the 32 bits raw;
// this layer reads the same bits as a mustered photograph. The Elite (1984)
// commander-face homage, grown up.
//
// Layer stack (DESIGN_NOTES §4, REV B). Every layer draws from its own RNG
// stream keyed off the member seed, so re-curating one layer can never shift
// another — the address-keyed discipline of the roster, applied to faces:
//
//   uniform + collar  role-driven, and the only color: phos pips for the
//                     core eight functions, a phos bar for the cohort
//                     senior, an amber braid for the watch of three. Your
//                     function is live data.
//   head              six silhouettes × width jitter.
//   skin              tone as Bayer-4 dither density in ivory-on-black — the
//                     §7 open question, resolved: the file stays 1-bit, and
//                     skin reads like a photograph scanned through the same
//                     monochrome instrument as the rest of the UI. Tone
//                     draws from the full human range uniformly, for
//                     everyone; nothing keys off name, origin or region.
//                     REV C: the uniform draw passes through a perceptual
//                     transfer curve (u^1.45) — a linear density mapping
//                     washed the whole roster white at 2× pixel fusion,
//                     because a 35–50% ivory dither on black reads light.
//                     The curve spends the range where the eye actually
//                     spends it: dark tones get the density room.
//   features          eyes ×5 · brows ×4 · nose ×4 · mouth ×6 — polarity
//                     ink: ivory lines carved on dark tones, black cuts on
//                     light ones, so features always contrast the field.
//   hair              18 styles, presentation-lean libraries (most styles
//                     are offered to everyone); salt stipple and age lines
//                     scale with the record's age, not the seed — a 58-year
//                     senior must read older than a 24-year-old fill.
//   cryo marks        phos sensor pair at the temples, worn by every cohort
//                     member; the watch of three wears none. One pixel pair
//                     that says "this person is frozen".
//
// One FaceSpec per member (every decision, scale-independent) with two
// compositions: paint48 — the dossier plate — and paint16 — the roster
// thumbnail. Pixel art at 16 px is a dedicated composition, never a
// downscale. Collisions between faces are allowed (Elite had them); scarcity
// is not.
//
// Doctrine, asserted at module load: spec determinism, painter purity
// (sampled), role→collar totality — a new role without a collar class throws
// at import — cryo consistency with the roster, and ≥150 distinct faces
// across the 207 souls.

import { hashString, mulberry32 } from "./engine";
import {
  CORE_ROLES,
  CREW,
  FILL_ROLES,
  WATCH_ROLES,
  type CrewMember,
} from "./crew";

// ── Ink — the photograph is 1-bit, plus the two live-data colors ─────────────

export type Ink = 0 | 1 | 2 | 3; // 0 empty · 1 ivory · 2 phos · 3 amber

export const INK_RGBA: Record<Ink, [number, number, number]> = {
  0: [3, 3, 4], // empty — the panel shows through
  1: [232, 230, 220], // ink ivory
  2: [123, 235, 166], // phos — live data
  3: [245, 199, 106], // amber — the watch braid (photograph-only accent)
};

// ── Collar classes — the uniform reads the role, total by assertion ─────────

export type CollarClass = "WATCH" | "SENIOR" | "CORE" | "FILL";

const WATCH_SET = new Set<string>(WATCH_ROLES);
const CORE_SET = new Set<string>(CORE_ROLES);
const FILL_SET = new Set<string>(FILL_ROLES.map((r) => r.role));

/** Role → collar. Throws for unmustered roles: the manifest is a document. */
export function collarClass(m: CrewMember): CollarClass {
  if (m.cohort === 0 && WATCH_SET.has(m.role)) return "WATCH";
  if (m.role === "COHORT SENIOR") return "SENIOR";
  if (CORE_SET.has(m.role)) return "CORE";
  if (FILL_SET.has(m.role)) return "FILL";
  throw new Error(`role "${m.role}" (${m.id}) has no collar class`);
}

// ── Hair library — presentation-lean, nobody typed by region ─────────────────
// tag F/M = offered to that presentation only, B = offered to everyone.

interface HairDef {
  id: string;
  tag: "F" | "M" | "B";
  capH: number; // cap descent below the crown, px at 48 (the fringe line)
  puff: number; // volume beyond the skull outline (curls, afro…)
  topH: number; // extra height above the crown (flat top, pompadour…)
  flat?: boolean; // square the top profile
  mohawk?: boolean; // narrow central strip only
  fringe: "straight" | "swept" | "curly" | "curtain" | "recede";
  sides: "none" | "mid" | "long";
  back: "none" | "bun" | "topknot" | "pony";
  braid?: boolean; // segmented columns (braids, dreads)
}

const HAIR: HairDef[] = [
  { id: "crop", tag: "B", capH: 3, puff: 0, topH: 0, fringe: "straight", sides: "none", back: "none" },
  { id: "shave", tag: "M", capH: 1, puff: 0, topH: 0, fringe: "straight", sides: "none", back: "none" },
  { id: "flat", tag: "M", capH: 2, puff: 0, topH: 4, flat: true, fringe: "straight", sides: "none", back: "none" },
  { id: "sidepart", tag: "B", capH: 4, puff: 0, topH: 0, fringe: "swept", sides: "none", back: "none" },
  { id: "curls", tag: "B", capH: 4, puff: 2, topH: 1, fringe: "curly", sides: "none", back: "none" },
  { id: "afro", tag: "B", capH: 3, puff: 5, topH: 2, fringe: "curly", sides: "none", back: "none" },
  { id: "bob", tag: "F", capH: 5, puff: 0, topH: 0, fringe: "straight", sides: "mid", back: "none" },
  { id: "long", tag: "F", capH: 4, puff: 1, topH: 0, fringe: "straight", sides: "long", back: "none" },
  { id: "bun", tag: "B", capH: 4, puff: 1, topH: 0, fringe: "straight", sides: "none", back: "bun" },
  { id: "ponytail", tag: "F", capH: 4, puff: 0, topH: 0, fringe: "straight", sides: "none", back: "pony" },
  { id: "braids", tag: "F", capH: 4, puff: 0, topH: 0, fringe: "straight", sides: "long", back: "none", braid: true },
  { id: "receding", tag: "M", capH: 2, puff: 0, topH: 0, fringe: "recede", sides: "none", back: "none" },
  { id: "windswept", tag: "B", capH: 4, puff: 1, topH: 1, fringe: "swept", sides: "none", back: "none" },
  { id: "shaggy", tag: "B", capH: 5, puff: 1.5, topH: 1, fringe: "curly", sides: "mid", back: "none" },
  { id: "dreads", tag: "B", capH: 5, puff: 2, topH: 1, fringe: "curly", sides: "long", back: "none", braid: true },
  { id: "topknot", tag: "B", capH: 3, puff: 0, topH: 0, fringe: "straight", sides: "none", back: "topknot" },
  { id: "pompadour", tag: "M", capH: 3, puff: 1.5, topH: 2, fringe: "swept", sides: "none", back: "none" },
  { id: "pageboy", tag: "F", capH: 6, puff: 1, topH: 0, fringe: "curtain", sides: "mid", back: "none" },
];

const HAIR_BY_ID = new Map(HAIR.map((h) => [h.id, h]));

// ── Head library — six silhouettes, parametric ───────────────────────────────
// Rows crown→chin; half-width = dome (quarter-ellipse) → cheek (bulge) →
// jaw (shape-specific taper to the chin).

type Taper = "round" | "square" | "heart" | "oval";

interface HeadDef {
  domeH: number; // rows of skull before full width
  bulge: number; // extra half-width at cheek level
  taper: Taper;
  chinW: number; // half-width at the chin, px
}

const HEADS: HeadDef[] = [
  { domeH: 8, bulge: 0, taper: "round", chinW: 7 },
  { domeH: 9, bulge: 0, taper: "oval", chinW: 5 },
  { domeH: 7, bulge: 0.5, taper: "square", chinW: 8 },
  { domeH: 8, bulge: 1.5, taper: "heart", chinW: 5 },
  { domeH: 10, bulge: 0, taper: "oval", chinW: 6 },
  { domeH: 7, bulge: 2, taper: "round", chinW: 7 },
];

/** Half-width of the head at row y, in the shared profile coordinate space. */
function hwAt(
  y: number,
  p: { crownY: number; cheekY: number; chinY: number; fullW: number; chinW: number; taper: Taper }
): number {
  if (y < p.crownY || y > p.chinY) return 0;
  if (y <= p.cheekY) {
    const k = (y - p.crownY) / Math.max(1, p.cheekY - p.crownY);
    return p.fullW * (0.62 + 0.38 * Math.sqrt(1 - (1 - k) ** 2));
  }
  const k = (y - p.cheekY) / Math.max(1, p.chinY - p.cheekY);
  const drop = p.fullW - p.chinW;
  switch (p.taper) {
    case "round":
      return p.chinW + drop * Math.cos((k * Math.PI) / 2);
    case "square":
      return p.fullW - drop * k ** 3;
    case "heart":
      return p.fullW - drop * Math.pow(k, 0.65);
    case "oval":
      return p.chinW + drop * (1 - k) ** 1.4;
  }
}

// ── FaceSpec — every decision, one level up from the painters ────────────────

export interface FaceSpec {
  head: number; // 0–5
  headScale: number; // 0.92–1.08 half-width jitter
  skin: number; // 0.08–0.92 dither density (perceptual curve, REV C)
  hair: string; // style id, from the presentation-filtered library
  hairTone: number; // 0.06–0.72 dither density
  hairFlip: boolean; // mirror the style (swept side, bun side…)
  saltSeed: number; // stream seed for grey stipple
  eyes: number; // 0–4
  brows: number; // 0–3
  nose: number; // 0–3
  mouth: number; // 0–5
  ageLines: number; // 0–3, from the record's age — the dossier reads the file
  hairGrey: number; // salt stipple probability, from age
  collar: CollarClass;
  cryo: boolean; // cohort ≠ 0
}

export function buildSpec(m: CrewMember): FaceSpec {
  const rr = (layer: string) =>
    mulberry32((m.seed ^ hashString(`exodus:face:${layer}`)) >>> 0);
  const rGeo = rr("geo");
  const rSkin = rr("skin");
  const rFeat = rr("features");
  const rHair = rr("hair");
  const lib = HAIR.filter((h) => h.tag === "B" || h.tag === m.sex);
  const face: FaceSpec = {
    head: Math.floor(rGeo() * HEADS.length),
    headScale: 0.92 + rGeo() * 0.16,
    // perceptual transfer: the draw stays uniform (social policy — the
    // full human range for everyone); the curve is instrument calibration
    // so that draw READS. Linear density read all-white at 2× fusion.
    skin: 0.08 + 0.84 * Math.pow(rSkin(), 1.45),
    hair: lib[Math.floor(rHair() * lib.length)].id,
    hairTone: 0.06 + rHair() * 0.66,
    hairFlip: rHair() < 0.5,
    saltSeed: (m.seed ^ hashString("exodus:face:salt")) >>> 0,
    eyes: Math.floor(rFeat() * 5),
    brows: Math.floor(rFeat() * 4),
    nose: Math.floor(rFeat() * 4),
    mouth: Math.floor(rFeat() * 6),
    ageLines: m.age < 30 ? 0 : m.age < 40 ? 1 : m.age < 50 ? 2 : 3,
    hairGrey: m.age < 40 ? 0 : Math.min(0.45, (m.age - 40) * 0.015),
    collar: collarClass(m),
    cryo: m.cohort !== 0,
  };
  // hair must read as hair — but REV B pushed close tones UP on dark
  // faces, painting a light cap on every one of them and helping wash the
  // roster white. REV C separates downward: near-black hair against brown
  // skin reads by texture (solid sparse-black field vs skin speckle), and
  // the fringe rim carries the hairline. The floor case (very dark skin)
  // is rim-carried — still better than a light cap.
  const span = Math.abs(face.hairTone - face.skin);
  if (span < 0.15) {
    face.hairTone = Math.max(0.04, Math.min(face.hairTone, face.skin - 0.15));
  }
  return face;
}

function hairDef(spec: FaceSpec): HairDef {
  const def = HAIR_BY_ID.get(spec.hair);
  if (!def) throw new Error(`unknown hair style "${spec.hair}"`);
  return def;
}

// ── Pixel grid — the shared painting surface ─────────────────────────────────

interface Grid {
  g: Uint8Array;
  put(x: number, y: number, ink: Ink): void;
  at(x: number, y: number): Ink;
}

function makeGrid(size: number): Grid {
  const g = new Uint8Array(size * size);
  return {
    g,
    put(x, y, ink) {
      if (x >= 0 && x < size && y >= 0 && y < size) g[y * size + x] = ink;
    },
    at(x, y) {
      return x >= 0 && x < size && y >= 0 && y < size ? (g[y * size + x] as Ink) : 0;
    },
  };
}

/** Ordered Bayer 4×4 threshold — position-keyed, so the dither never depends
 *  on draw order. Density is the tone. */
const BAYER = new Float32Array(
  [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16)
);

function dith(x: number, y: number, tone: number): Ink {
  return tone > BAYER[(y & 3) * 4 + (x & 3)] ? 1 : 0;
}

/** Rim brightness for a field of tone t: one visible step brighter, never
 *  solid. REV C — the rim used to be unconditionally ivory, which drew a
 *  white band around every head and lit the whole roster from behind. A
 *  dithered step-bright rim holds the silhouette at every tone without
 *  painting anyone in outline-white. */
function rimTone(t: number): number {
  return Math.min(0.95, Math.max(0.6, t + 0.2));
}

/** Stamp a small character pattern. '#'=black slot, 'i'=ivory, 'p'=polarity
 *  ink, '.'=leave alone. Mirrored for the right-hand side of the face. */
function stamp(
  grid: Grid,
  x0: number,
  y0: number,
  rows: string[],
  polarity: Ink,
  mirror = false
) {
  rows.forEach((row, r) => {
    const chars = mirror ? [...row].reverse() : [...row];
    chars.forEach((ch, c) => {
      if (ch === ".") return;
      grid.put(x0 + c, y0 + r, ch === "#" ? 0 : ch === "i" ? 1 : polarity);
    });
  });
}

// ── The 48×48 dossier plate ──────────────────────────────────────────────────

const CLOTH_TONE = 0.22;

function profile48(spec: FaceSpec) {
  const hd = HEADS[spec.head];
  const fullW = 11 * spec.headScale + hd.bulge;
  const p = {
    cx: 24,
    crownY: 6,
    cheekY: 6 + hd.domeH,
    chinY: 34,
    fullW,
    chinW: hd.chinW,
    taper: hd.taper,
    eyeY: 18,
    browY: 16,
    noseTip: 25,
    mouthY: 28,
    eyeDX: 5,
  };
  p.eyeDX = Math.max(4, Math.round(hwAt(p.eyeY, p) * 0.48));
  return p;
}

const EYES: string[][] = [
  ["#iii#"], // narrow — bright closed slit
  ["#####", "##ii#", "#####"], // round — socket pad with a glint
  ["######", "##ii##", "######"], // wide
  ["######", "######", "##ii##"], // deep-set — shadowed, glint low
  ["ii##ii"], // almond — bright corners
];

/** Eyes for light faces (P = black strokes): small dark eyes with bright
 *  cores — solid dark pads here would read as hollow sockets, and outlined
 *  rectangles as goggles. */
const EYES_LIGHT: string[][] = [
  ["#ii#"], // narrow
  ["#ii#"], // round — a small dark eye, bright core
  ["#iii#"], // wide
  ["####", "#ii#"], // deep-set — heavy lid over a bright eye
  ["ii##ii"], // almond
];

const BROWS: string[][] = [
  ["ppppp", ".ppp."], // straight
  [".ppp.", "p...p"], // arched
  ["ppppp", "ppppp"], // heavy
  [".ppp."], // thin
];

function paintEyes48(
  grid: Grid,
  p: ReturnType<typeof profile48>,
  style: number,
  P: Ink
) {
  // light faces get open eyes — dark 3-row pads on a near-white field read
  // as hollow sockets (the skull trap); dark faces get socket pads, where
  // the glints carry
  const table = P === 0 ? EYES_LIGHT : EYES;
  const rows = table[style] ?? table[0];
  const w = Math.max(...rows.map((r) => r.length));
  // mirror-exact placement: even-width patterns must sit symmetrically
  stamp(grid, p.cx - p.eyeDX - Math.ceil((w - 1) / 2), p.eyeY, rows, 1, false);
  stamp(grid, p.cx + p.eyeDX - Math.floor((w - 1) / 2), p.eyeY, rows, 1, true);
}

function paintNose48(
  grid: Grid,
  p: ReturnType<typeof profile48>,
  style: number,
  P: Ink
) {
  const cx = p.cx;
  // every nose carries a solid tip block — coherent blocks read through the
  // dither, 1px lines do not
  const tip = (w: number) => {
    for (let x = cx - w; x <= cx + w; x++) grid.put(x, p.noseTip, P);
  };
  switch (style) {
    case 1: // button
      for (let y = p.eyeY + 3; y < p.noseTip; y++) {
        grid.put(cx, y, P);
        grid.put(cx + 1, y, P);
      }
      tip(1);
      break;
    case 2: // aquiline — the bump
      for (let y = p.eyeY + 2; y < p.noseTip; y++) {
        grid.put(cx, y, P);
        grid.put(cx + 1, y, P);
      }
      grid.put(cx + 2, p.eyeY + 4, P);
      tip(1);
      break;
    case 3: // broad
      for (let y = p.eyeY + 3; y < p.noseTip; y++) {
        grid.put(cx, y, P);
        grid.put(cx + 1, y, P);
      }
      tip(2);
      break;
    default: // straight
      for (let y = p.eyeY + 2; y < p.noseTip; y++) {
        grid.put(cx, y, P);
        grid.put(cx + 1, y, P);
      }
      tip(1);
  }
}

function paintMouth48(
  grid: Grid,
  p: ReturnType<typeof profile48>,
  style: number,
  P: Ink
) {
  const cx = p.cx;
  const y = p.mouthY;
  // two-row solid structure — main line plus lower lip — so the mouth
  // survives mid-tone dither at any polarity
  const line = (w: number) => {
    for (let x = cx - w; x <= cx + w; x++) grid.put(x, y, P);
  };
  const lip = (w: number) => {
    for (let x = cx - w; x <= cx + w; x++) grid.put(x, y + 1, P);
  };
  switch (style) {
    case 1: // smile — corners rise
      grid.put(cx - 3, y - 1, P);
      grid.put(cx + 3, y - 1, P);
      line(2);
      lip(1);
      break;
    case 2: // corners fall
      line(2);
      lip(1);
      grid.put(cx - 3, y + 1, P);
      grid.put(cx + 3, y + 1, P);
      break;
    case 3: // full
      line(2);
      lip(2);
      break;
    case 4: // wide
      line(3);
      lip(2);
      break;
    case 5: // smirk
      for (let x = cx - 2; x <= cx + 1; x++) grid.put(x, y, P);
      grid.put(cx + 2, y - 1, P);
      grid.put(cx - 1, y + 1, P);
      grid.put(cx, y + 1, P);
      break;
    default: // flat
      line(2);
      lip(1);
  }
}

/** Age lines read the record: density from the member's actual age. */
function paintAge48(
  grid: Grid,
  p: ReturnType<typeof profile48>,
  band: number,
  P: Ink
) {
  if (band < 1) return;
  for (let x = p.cx - 2; x <= p.cx + 2; x++) grid.put(x, p.browY - 3, P); // forehead
  if (band >= 2) {
    grid.put(p.cx - 3, p.noseTip - 1, P); // nasolabial pair
    grid.put(p.cx - 4, p.noseTip, P);
    grid.put(p.cx + 3, p.noseTip - 1, P);
    grid.put(p.cx + 4, p.noseTip, P);
    const fx = p.eyeDX + 3; // crow's feet
    grid.put(p.cx - fx, p.eyeY, P);
    grid.put(p.cx - fx - 1, p.eyeY - 1, P);
    grid.put(p.cx + fx, p.eyeY, P);
    grid.put(p.cx + fx + 1, p.eyeY - 1, P);
  }
  if (band >= 3) {
    grid.put(p.cx, p.browY - 1, P); // glabella
    grid.put(p.cx, p.browY - 2, P);
    for (let x = p.cx - 2; x <= p.cx + 1; x++) grid.put(x, 36, P); // neck crease
  }
}

function paintHair48(
  grid: Grid,
  p: ReturnType<typeof profile48>,
  spec: FaceSpec,
  def: HairDef
) {
  const S = 48;
  const hw = (y: number) => hwAt(y, p);
  const mask = new Uint8Array(S * S);
  const mark = (x: number, y: number) => {
    if (x >= 0 && x < S && y >= 0 && y < S) mask[y * S + x] = 1;
  };
  const disc = (cx0: number, cy0: number, r: number) => {
    for (let y = cy0 - r; y <= cy0 + r; y++)
      for (let x = cx0 - r; x <= cx0 + r; x++)
        if ((x - cx0) ** 2 + (y - cy0) ** 2 <= r * r + 0.5) mark(x, y);
  };

  const flip = spec.hairFlip ? -1 : 1;
  const fringeY = p.crownY + def.capH;
  const capTopY = Math.max(0, p.crownY - def.topH - Math.round(def.puff / 3));
  const w0 = hw(p.crownY) + def.puff * 0.5;

  const capHalf = (y: number): number => {
    if (def.mohawk) return y >= p.crownY ? 3.5 : 2; // crest — wide at the base
    if (y >= p.crownY) return hw(y) + def.puff * 0.5;
    const t = (p.crownY - y) / Math.max(1, p.crownY - capTopY);
    const topW = def.flat ? w0 - 1.5 : 1.5 + def.puff * 0.4;
    return w0 + (topW - w0) * t;
  };

  // how low the cap reaches in column x — the fringe line. Corners tuck up
  // so the cap reads as hair, never as a hat brim.
  const edge = (x: number): number => {
    const d = x - p.cx;
    const tuck = Math.min(2, Math.max(0, Math.abs(d) - capHalf(fringeY) + 3));
    switch (def.fringe) {
      case "swept":
        return fringeY - tuck - (flip * d < 0 ? 1 : 0);
      case "curly": {
        const n = (Math.imul(x, 2654435761) >>> 0) % 3;
        return fringeY - tuck - (n === 0 ? 2 : n === 1 ? 1 : 0);
      }
      case "curtain":
        return Math.abs(d) < 2 ? -1 : fringeY - tuck;
      case "recede":
        return fringeY - (Math.abs(d) > 3 ? 2 : 0);
      default:
        return fringeY - tuck;
    }
  };

  for (let y = capTopY; y <= fringeY; y++) {
    const w = capHalf(y);
    for (let x = Math.round(p.cx - w); x <= Math.round(p.cx + w); x++) {
      if (y <= edge(x)) mark(x, y);
    }
  }

  // sides falling beside the face
  if (def.sides !== "none") {
    const endY = def.sides === "mid" ? p.cheekY + 6 : 41;
    for (let y = fringeY; y <= endY; y++) {
      const w = Math.round(y <= p.chinY ? hw(y) : Math.max(p.chinW, 5));
      const pinch = def.braid && y % 3 === 2;
      for (const o of pinch ? [0, 1] : [-1, 0, 1]) {
        mark(p.cx - (w + o), y);
        mark(p.cx + (w + o), y);
      }
    }
  }

  // back pieces — read behind the head
  if (def.back === "bun") {
    disc(p.cx + flip * (Math.round(hw(p.crownY + 3)) + 1), p.crownY + 3, 3);
  } else if (def.back === "topknot") {
    disc(p.cx, capTopY - 1, 2);
  } else if (def.back === "pony") {
    // the tail reads behind the lower head and shoulder — starting it at
    // the crown would draw a face-length seam
    for (let y = p.chinY - 3; y <= 44; y++) {
      const w = Math.round(hw(Math.min(y, p.chinY))) + 1;
      mark(p.cx + flip * w, y);
      mark(p.cx + flip * (w + 1), y);
    }
  }

  // fill: dither the interior, rim the boundary (a step brighter than the
  // field — REV C, same rule as the bust rim), salt the grey through
  const salt = mulberry32(spec.saltSeed);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (!mask[y * S + x]) continue;
      const b =
        !mask[y * S + x - 1] ||
        !mask[y * S + x + 1] ||
        y === 0 ||
        !mask[(y - 1) * S + x] ||
        (y + 1 >= S ? true : !mask[(y + 1) * S + x]);
      if (b) grid.put(x, y, dith(x, y, rimTone(spec.hairTone)));
      else grid.put(x, y, dith(x, y, spec.hairTone) === 1 || salt() < spec.hairGrey ? 1 : 0);
    }
  }
}

/** Face lighting — subtle density shifts model the head: a lit T-zone
 *  (forehead, nose bridge, cheeks) against a shadowed jaw and neck. This is
 *  what makes a dithered face read as a face instead of noise, at every
 *  tone: dark faces get a lit structure, light faces get form. */
function faceTone48(
  x: number,
  y: number,
  p: ReturnType<typeof profile48>,
  skin: number
): number {
  const dx = Math.abs(x - p.cx);
  const hw = hwAt(Math.min(y, p.chinY), p);
  let t = skin;
  // gentle lift everywhere; very light faces keep grain, dark faces get a
  // faint T-zone — REV B's 0.7 lifted their centers to ~0.35 density and
  // nobody on the roster read as actually dark. 0.35 keeps the structure
  // while the field keeps its tone.
  const lift = skin > 0.75 ? 0.5 : skin < 0.45 ? 0.35 : 0.9;
  if (y >= p.browY - 4 && y <= p.browY - 2 && dx <= hw - 2) t += 0.18 * lift;
  else if (y >= p.eyeY + 3 && y <= p.noseTip - 1) {
    if (dx <= 1) t += 0.22 * lift; // nose bridge catchlight
    else if (dx >= 3 && dx <= hw - 2) t += 0.14 * lift; // cheek apples
  }
  if (skin > 0.4) {
    // dark faces keep their floor — subtractive shadows would read as void
    if (y >= p.mouthY + 1 && y <= p.chinY && dx <= hw - 1) t -= 0.12; // chin shadow
    if (y >= p.eyeY + 2 && y <= p.chinY && dx >= hw - 2.5) t -= 0.1; // temples
    if (y > p.chinY) t -= 0.08; // neck sits in shadow
    // soft clearings above and below the eye cluster
    if ((y === p.eyeY - 1 || y === p.eyeY + 3) && dx <= p.eyeDX + 3) t -= 0.14;
  }
  return Math.max(0.05, Math.min(0.95, t));
}

function paint48(spec: FaceSpec): Uint8Array {
  const S = 48;
  const grid = makeGrid(S);
  const p = profile48(spec);
  const hw = (y: number) => hwAt(y, p);

  // ── bust mask: head ∪ neck ∪ shoulders (1 = skin, 2 = cloth) ──
  const mask = new Uint8Array(S * S);
  const mark = (x: number, y: number, v: 1 | 2) => {
    if (x >= 0 && x < S && y >= 0 && y < S) mask[y * S + x] = v;
  };
  for (let y = p.crownY; y <= p.chinY; y++) {
    const w = hw(y);
    for (let x = Math.round(p.cx - w); x <= Math.round(p.cx + w); x++) mark(x, y, 1);
  }
  for (let y = p.chinY - 1; y <= 41; y++)
    for (let x = p.cx - 4; x <= p.cx + 4; x++) mark(x, y, 1); // neck
  for (let y = 41; y <= 47; y++) {
    const w = Math.min(23, 11 + (y - 41) * 3.4);
    for (let x = Math.round(p.cx - w); x <= Math.round(p.cx + w); x++) mark(x, y, 2);
  }

  // ── fill: ivory rim on the boundary, dither inside — the drawing holds the
  //    silhouette at every tone, the dither carries the tone, and the tone
  //    itself is lit (faceTone48) so the head reads as a head ──
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const mk = mask[y * S + x];
      if (!mk) continue;
      const edge =
        !mask[y * S + x - 1] ||
        !mask[y * S + x + 1] ||
        y === 0 ||
        y === S - 1 ||
        !mask[(y - 1) * S + x] ||
        !mask[(y + 1) * S + x];
      const tone = mk === 1 ? faceTone48(x, y, p, spec.skin) : CLOTH_TONE;
      grid.put(x, y, edge ? dith(x, y, rimTone(tone)) : dith(x, y, tone));
    }
  }

  // collar line — where the neck meets the suit
  for (let x = p.cx - 5; x <= p.cx + 5; x++) grid.put(x, 42, 1);
  grid.put(p.cx - 6, 43, 1);
  grid.put(p.cx + 6, 43, 1);

  // ── features, then hair over them, then the sensors ──
  // fg records every feature pixel so the halo pass can ring them
  const P: Ink = spec.skin > 0.55 ? 0 : 1; // polarity ink
  const feat = new Set<number>();
  const fg: Grid = {
    g: grid.g,
    put(x, y, ink) {
      grid.put(x, y, ink);
      if (x >= 0 && x < S && y >= 0 && y < S) feat.add(y * 100 + x);
    },
    at: grid.at,
  };
  const browRows = BROWS[spec.brows] ?? BROWS[0];
  const bw = Math.max(...browRows.map((r) => r.length));
  stamp(fg, p.cx - p.eyeDX - Math.ceil((bw - 1) / 2), p.browY, browRows, P, false);
  stamp(fg, p.cx + p.eyeDX - Math.floor((bw - 1) / 2), p.browY, browRows, P, true);
  paintEyes48(fg, p, spec.eyes, P);
  paintNose48(fg, p, spec.nose, P);
  paintMouth48(fg, p, spec.mouth, P);

  // feature halo — a 1px ring in the ink opposite the strokes. Invisible
  // when the field already contrasts the glyphs, decisive at mid-tones
  // where strokes used to dissolve into the dither.
  const ring: Ink = P === 1 ? 0 : 1;
  for (const k of feat) {
    const x = k % 100;
    const y = Math.floor(k / 100);
    for (const [nx, ny] of [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
      [x - 1, y - 1],
      [x + 1, y - 1],
      [x - 1, y + 1],
      [x + 1, y + 1],
    ]) {
      if (!feat.has(ny * 100 + nx)) grid.put(nx, ny, ring);
    }
  }

  // age lines stay subtle — no halo; they are weather, not features
  paintAge48(grid, p, spec.ageLines, P);
  paintHair48(grid, p, spec, hairDef(spec));

  if (spec.cryo) {
    // on the temple itself — just outside the eye cluster, inside the rim,
    // below every fringe line. 2×2 so they read at plate scale.
    const dx = p.eyeDX + 3;
    for (const s of [-1, 1]) {
      for (let yy = p.eyeY + 1; yy <= p.eyeY + 2; yy++) {
        grid.put(p.cx + s * dx, yy, 2);
        grid.put(p.cx + s * (dx + 1), yy, 2);
      }
    }
  }

  // ── the collar reading — the only color on the photograph. Pips sit on
  //    a cleared patch so they read against the uniform dither ──
  const clearRect = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) grid.put(x, y, 0);
  };
  switch (spec.collar) {
    case "WATCH":
      clearRect(p.cx - 5, 42, p.cx + 5, 45);
      for (let y = 43; y <= 44; y++)
        for (let x = p.cx - 4; x <= p.cx + 4; x++) grid.put(x, y, 3);
      break;
    case "SENIOR":
      clearRect(p.cx - 5, 42, p.cx + 5, 45);
      for (let y = 43; y <= 44; y++)
        for (let x = p.cx - 4; x <= p.cx + 4; x++) grid.put(x, y, 2);
      break;
    case "CORE":
      for (const sx of [p.cx - 6, p.cx + 5]) {
        clearRect(sx - 1, 42, sx + 2, 46);
        for (let y = 43; y <= 45; y++)
          for (let x = sx; x <= sx + 1; x++) grid.put(x, y, 2);
      }
      break;
    // FILL — the uniform is the collar; no pips
  }

  return grid.g;
}

// ── The 16×16 roster thumbnail — a composition, not a downscale ──────────────

function profile16(spec: FaceSpec) {
  const hd = HEADS[spec.head];
  return {
    cx: 8,
    crownY: 3,
    cheekY: 3 + Math.round(hd.domeH * 0.4),
    chinY: 12,
    fullW: 4.3 * spec.headScale + hd.bulge * 0.5,
    chinW: Math.max(2, hd.chinW * 0.55),
    taper: hd.taper,
    eyeY: 7,
    browY: 6,
    noseTip: 9,
    mouthY: 10,
    eyeDX: 2,
  };
}

/** Icon-scale tone: flat, never stipple — below ~32 px a dither field reads
 *  as static, so every tone quantizes to one of two solids. Contrast at
 *  icon scale is carried by the rim, the features, and the collar. The cut
 *  sits below the plate-scale mid-tone (REV C curve) so the binary icons
 *  split ~45/55 light/dark, tracking the roster instead of flipping it. */
function flat16(tone: number): Ink {
  return tone > 0.45 ? 1 : 0;
}

function paint16(spec: FaceSpec): Uint8Array {
  const S = 16;
  const grid = makeGrid(S);
  const p = profile16(spec);
  const hw = (y: number) => hwAt(y, p);

  // bust mask
  const mask = new Uint8Array(S * S);
  const mark = (x: number, y: number, v: 1 | 2) => {
    if (x >= 0 && x < S && y >= 0 && y < S) mask[y * S + x] = v;
  };
  for (let y = p.crownY; y <= p.chinY; y++) {
    const w = hw(y);
    for (let x = Math.round(p.cx - w); x <= Math.round(p.cx + w); x++) mark(x, y, 1);
  }
  for (let y = 13; y <= 15; y++) {
    const w = Math.min(7, 4 + (y - 13) * 2.5);
    for (let x = Math.round(p.cx - w); x <= Math.round(p.cx + w); x++) mark(x, y, 2);
  }

  // rim + dither
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const mk = mask[y * S + x];
      if (!mk) continue;
      const edge =
        !mask[y * S + x - 1] ||
        !mask[y * S + x + 1] ||
        y === 0 ||
        y === S - 1 ||
        !mask[(y - 1) * S + x] ||
        !mask[(y + 1) * S + x];
      const tone = mk === 1 ? spec.skin : CLOTH_TONE;
      grid.put(x, y, edge ? 1 : flat16(tone));
    }
  }

  // features — icon scale: 2×2 eye blocks in the polarity ink so the eyes
  // always anchor the face against the (binary) head fill
  const P: Ink = spec.skin > 0.5 ? 0 : 1;
  for (const ex of [p.cx - 2, p.cx - 1, p.cx + 1, p.cx + 2]) {
    grid.put(ex, p.eyeY, P);
    grid.put(ex, p.eyeY + 1, P);
  }
  grid.put(p.cx - 2, p.browY, P);
  grid.put(p.cx + 2, p.browY, P);
  for (let x = p.cx - 1; x <= p.cx + 1; x++) grid.put(x, p.mouthY, P);

  // hair — cap + sides + back blobs, same rules at icon scale
  const def = hairDef(spec);
  const flip = spec.hairFlip ? -1 : 1;
  const hmask = new Uint8Array(S * S);
  const hmark = (x: number, y: number) => {
    if (x >= 0 && x < S && y >= 0 && y < S) hmask[y * S + x] = 1;
  };
  const fringeY = p.crownY + Math.round(def.capH / 2);
  const capTopY = Math.max(0, p.crownY - Math.round(def.topH / 2) - (def.puff >= 3 ? 1 : 0));
  const w0 = hw(p.crownY) + def.puff * 0.3;
  const capHalf = (y: number): number => {
    if (def.mohawk) return 1.5;
    if (y >= p.crownY) return hw(y) + def.puff * 0.3;
    const t = (p.crownY - y) / Math.max(1, p.crownY - capTopY);
    const topW = def.flat ? w0 : 1 + def.puff * 0.2;
    return w0 + (topW - w0) * t;
  };
  const edge = (x: number): number => {
    const d = x - p.cx;
    switch (def.fringe) {
      case "swept":
        return fringeY - (flip * d < 0 ? 1 : 0);
      case "curly":
        return fringeY - (((Math.imul(x, 2654435761) >>> 0) % 3) === 0 ? 1 : 0);
      case "curtain":
        return Math.abs(d) < 1 ? -1 : fringeY;
      case "recede":
        return fringeY - (Math.abs(d) > 2 ? 1 : 0);
      default:
        return fringeY;
    }
  };
  for (let y = capTopY; y <= fringeY; y++) {
    const w = capHalf(y);
    for (let x = Math.round(p.cx - w); x <= Math.round(p.cx + w); x++) {
      if (y <= edge(x)) hmark(x, y);
    }
  }
  if (def.sides !== "none") {
    const endY = def.sides === "mid" ? 9 : 13;
    for (let y = fringeY; y <= endY; y++) {
      const w = Math.round(hw(Math.min(y, p.chinY)));
      const pinch = def.braid && y % 2 === 1;
      if (!pinch) {
        hmark(p.cx - w, y);
        hmark(p.cx + w, y);
      }
      hmark(p.cx - w + 1, y);
      hmark(p.cx + w - 1, y);
    }
  }
  if (def.back === "bun") {
    const bx = p.cx + flip * (Math.round(w0) + 1);
    hmark(bx, 4);
    hmark(bx + flip, 4);
    hmark(bx, 5);
    hmark(bx + flip, 5);
  } else if (def.back === "topknot") {
    hmark(p.cx, capTopY - 1);
    hmark(p.cx - 1, capTopY - 1);
  } else if (def.back === "pony") {
    const bx = p.cx + flip * (Math.round(w0) + 1);
    for (let y = 5; y <= 13; y++) hmark(bx, y);
  }
  const rim: Ink = spec.hairTone > 0.5 && spec.skin > 0.5 ? 0 : 1; // solid at icon scale
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (!hmask[y * S + x]) continue;
      const b =
        !hmask[y * S + x - 1] ||
        !hmask[y * S + x + 1] ||
        y === 0 ||
        !hmask[(y - 1) * S + x] ||
        (y + 1 >= S ? true : !hmask[(y + 1) * S + x]);
      grid.put(x, y, b ? rim : flat16(spec.hairTone));
    }
  }

  // collar line + reading, cryo sensor
  for (let x = p.cx - 2; x <= p.cx + 2; x++) grid.put(x, 13, 1);
  const clearRect16 = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) grid.put(x, y, 0);
  };
  switch (spec.collar) {
    case "WATCH":
      clearRect16(p.cx - 2, 14, p.cx + 2, 15);
      for (let x = p.cx - 1; x <= p.cx + 1; x++) grid.put(x, 14, 3);
      break;
    case "SENIOR":
      clearRect16(p.cx - 2, 14, p.cx + 2, 15);
      for (let x = p.cx - 1; x <= p.cx + 1; x++) grid.put(x, 14, 2);
      break;
    case "CORE":
      for (const sx of [p.cx - 2, p.cx + 2]) {
        clearRect16(sx - 1, 14, sx + 1, 15);
        grid.put(sx, 14, 2);
      }
      break;
    // FILL — no pips
  }
  if (spec.cryo) {
    grid.put(p.cx - 3, p.eyeY, 2);
    grid.put(p.cx + 3, p.eyeY, 2);
    grid.put(p.cx - 3, p.eyeY + 1, 2);
    grid.put(p.cx + 3, p.eyeY + 1, 2);
  }

  return grid.g;
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Paint a member's mustered photograph. size 48 = dossier plate, 16 = roster
 *  thumbnail. Pure: same member in, same pixels out, in any process. */
export function paintFace(m: CrewMember, size: 16 | 48): Uint8Array {
  const spec = buildSpec(m);
  return size === 48 ? paint48(spec) : paint16(spec);
}

// ── Doctrine — asserted at module load, not assumed ──────────────────────────
// Runs in the browser and during next build's prerender: a drifted portrait
// layer throws at import, it cannot silently mis-muster.

const SPECS = CREW.map(buildSpec);

// layer determinism — every spec builds identically twice
for (let i = 0; i < CREW.length; i++) {
  if (JSON.stringify(SPECS[i]) !== JSON.stringify(buildSpec(CREW[i]))) {
    throw new Error(`portrait spec is not deterministic: ${CREW[i].id}`);
  }
}

// role→collar totality is enforced inside collarClass (buildSpec calls it for
// every member above) — an unmustered role throws before this comment.

// cryo marks track the roster: the frozen wear them, the watch does not
for (let i = 0; i < CREW.length; i++) {
  if (SPECS[i].cryo !== (CREW[i].cohort !== 0)) {
    throw new Error(`cryo marks disagree with the roster: ${CREW[i].id}`);
  }
}

// painter purity — a sample must paint identically twice, both plates
for (let i = 0; i < CREW.length; i += 9) {
  for (const size of [16, 48] as const) {
    const a = paintFace(CREW[i], size);
    const b = paintFace(CREW[i], size);
    for (let k = 0; k < a.length; k++) {
      if (a[k] !== b[k]) {
        throw new Error(`painter is not deterministic: ${CREW[i].id} @${size}`);
      }
    }
  }
}

// collisions are allowed (Elite had them) — scarcity is not
if (new Set(SPECS.map((s) => JSON.stringify(s))).size < 150) {
  throw new Error("portrait space collapsed: fewer than 150 distinct faces");
}
