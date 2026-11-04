// ─── Procedural portraits — the member seed, read as a face ──────────────────
// Pure lib, no React, no DOM (it must run at import — in the browser and during
// next build's prerender — and in Node for the contact-sheet tooling). Every
// face is a deterministic function of the member record (charter §1: same
// crew, same faces — forever). The dossier face code shows the 32 bits raw;
// this layer reads the same bits as a mustered photograph. The Elite (1984)
// commander-face homage, grown up.
//
// REV D — the photograph is in color. REV B painted skin as 1-bit Bayer
// dither density and REV C calibrated that curve, but a 48×48 plate at 2×
// sits below the fusion threshold where a dither field reads as tone — it
// reads as texture, and no calibration fixes that. The eye was right both
// times. So tone now comes from pigment: skin, hair and eyes draw from the
// human gamut as real RGB, shaded by a small light model (lit T-zone,
// shadowed jaw, rim one step lighter). The instrument stays what it was —
// panels, text and line drawings remain 1-bit ivory-on-black — and the
// photograph becomes the one object on the ship that shows the world's
// actual colors, a color print stapled into a monochrome file. The only
// synthetic colors on the plate are live data: phos collar pips and cryo
// sensors, the amber watch braid.
//
// Layer stack (DESIGN_NOTES §4, REV D). Every layer draws from its own RNG
// stream keyed off the member seed, so re-curating one layer can never shift
// another — the address-keyed discipline of the roster, applied to faces:
//
//   uniform + collar  role-driven live data: phos pips for the core eight
//                     functions, a phos bar for the cohort senior, an amber
//                     braid for the watch of three. Your function is live
//                     data, and it is the only synthetic color left.
//   head              six silhouettes × width jitter.
//   skin              a uniform draw along a seven-anchor human ramp (deep
//                     brown → pale), shaded by the light model. The draw
//                     spans the full range uniformly, for everyone; nothing
//                     keys off name, origin or region.
//   features          eyes ×5 — sclera, a weighted iris gamut (browns
//                     common; hazel, blue, green, grey real but rarer),
//                     pupil, lash line — · brows ×4 in a hair-darkened ink ·
//                     nose ×4 and mouth ×6 in tones mixed from the skin.
//                     Hue carries the contrast; the REV B polarity inks and
//                     feature halos are gone.
//   hair              18 styles × a weighted human color table (black and
//                     browns common, blonde, auburn, ginger), rim in a
//                     lighter hair step, grey salt scaled by the record's
//                     age.
//   age lines         density from the member's actual age — the dossier
//                     reads the file, not the seed.
//   cryo marks        phos sensor pair at the temples, worn by every cohort
//                     member; the watch of three wears none. One pixel pair
//                     that says "this person is frozen".
//
// One FaceSpec per member (every decision, scale-independent) with two
// compositions: paint48 — the dossier plate — and paint16 — the roster
// thumbnail, solid colors at icon scale, never a downscale. Collisions
// between faces are allowed (Elite had them); scarcity is not.
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

// ── Color — RGB triples, the live-data accents, small helpers ────────────────

export type RGB = readonly [number, number, number];

/** Phosphor — live data. Synthetic, and it stays synthetic. */
export const PHOS: RGB = [123, 235, 166];
/** Amber — the watch braid, the one warm accent of the instrument. */
export const AMBER: RGB = [245, 199, 106];

function shade(c: RGB, f: number): RGB {
  return [
    Math.min(255, Math.round(c[0] * f)),
    Math.min(255, Math.round(c[1] * f)),
    Math.min(255, Math.round(c[2] * f)),
  ];
}

/** Lighten with an additive floor, so even black hair keeps a visible rim. */
function lift(c: RGB, f: number, floor: number): RGB {
  return [
    Math.min(255, Math.round(Math.max(c[0] * f, c[0] + floor))),
    Math.min(255, Math.round(Math.max(c[1] * f, c[1] + floor))),
    Math.min(255, Math.round(Math.max(c[2] * f, c[2] + floor))),
  ];
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

// ── The human gamut — seven skin anchors, weighted hair and iris tables ──────
// Anchors are measured muted, not the orange of cheap palettes; the uniform
// draw along the ramp is a social policy, not a statistic — everyone draws
// from the whole range.

export const SKIN_RAMP: RGB[] = [
  [64, 42, 28], // deep brown
  [94, 63, 42], // brown
  [124, 86, 57], // tan brown
  [158, 114, 80], // medium / olive
  [192, 145, 108], // light medium
  [222, 175, 138], // light
  [244, 213, 183], // pale
];

function skinAt(u: number): RGB {
  const t = Math.min(0.9999, Math.max(0, u)) * (SKIN_RAMP.length - 1);
  const i = Math.min(SKIN_RAMP.length - 2, Math.floor(t));
  return mix(SKIN_RAMP[i], SKIN_RAMP[i + 1], t - i);
}

export const HAIR_COLORS: { name: string; c: RGB; w: number }[] = [
  { name: "black", c: [26, 20, 16], w: 28 },
  { name: "dark brown", c: [48, 32, 20], w: 24 },
  { name: "brown", c: [76, 50, 28], w: 16 },
  { name: "chestnut", c: [104, 66, 36], w: 9 },
  { name: "auburn", c: [122, 60, 32], w: 6 },
  { name: "ginger", c: [156, 82, 44], w: 3 },
  { name: "dark blonde", c: [126, 98, 60], w: 6 },
  { name: "blonde", c: [184, 152, 100], w: 5 },
  { name: "light blonde", c: [216, 196, 156], w: 3 },
];

export const IRIS_COLORS: { name: string; c: RGB; w: number }[] = [
  { name: "dark brown", c: [48, 32, 22], w: 26 },
  { name: "brown", c: [92, 60, 34], w: 32 },
  { name: "hazel", c: [128, 94, 50], w: 12 },
  { name: "amber", c: [168, 118, 60], w: 5 },
  { name: "green", c: [86, 112, 78], w: 6 },
  { name: "blue", c: [96, 132, 172], w: 13 },
  { name: "grey", c: [126, 130, 134], w: 6 },
];

/** Weighted index draw from a table — deterministic in the stream. */
function wpick(r: () => number, table: { w: number }[]): number {
  let total = 0;
  for (const t of table) total += t.w;
  let x = r() * total;
  for (let i = 0; i < table.length; i++) {
    x -= table[i].w;
    if (x < 0) return i;
  }
  return table.length - 1;
}

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
  skinU: number; // 0–1, position along the human skin ramp (uniform draw)
  hair: string; // style id, from the presentation-filtered library
  hairCIdx: number; // HAIR_COLORS index, weighted draw
  irisIdx: number; // IRIS_COLORS index, weighted draw
  hairFlip: boolean; // mirror the style (swept side, bun side…)
  saltSeed: number; // stream seed for grey salt
  eyes: number; // 0–4
  brows: number; // 0–3
  nose: number; // 0–3
  mouth: number; // 0–5
  ageLines: number; // 0–3, from the record's age — the dossier reads the file
  hairGrey: number; // grey salt probability, from age
  collar: CollarClass;
  cryo: boolean; // cohort ≠ 0
}

export function buildSpec(m: CrewMember): FaceSpec {
  const rr = (layer: string) =>
    mulberry32((m.seed ^ hashString(`exodus:face:${layer}`)) >>> 0);
  // stream order is doctrine: geo → skin → features → hair (style, color,
  // flip) → iris. Re-curating a table never reshuffles an earlier stream.
  const rGeo = rr("geo");
  const rSkin = rr("skin");
  const rFeat = rr("features");
  const rHair = rr("hair");
  const rIris = rr("iris");
  const lib = HAIR.filter((h) => h.tag === "B" || h.tag === m.sex);
  return {
    head: Math.floor(rGeo() * HEADS.length),
    headScale: 0.92 + rGeo() * 0.16,
    skinU: rSkin(),
    hair: lib[Math.floor(rHair() * lib.length)].id,
    hairCIdx: wpick(rHair, HAIR_COLORS),
    hairFlip: rHair() < 0.5,
    irisIdx: wpick(rIris, IRIS_COLORS),
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
}

function hairDef(spec: FaceSpec): HairDef {
  const def = HAIR_BY_ID.get(spec.hair);
  if (!def) throw new Error(`unknown hair style "${spec.hair}"`);
  return def;
}

// ── FaceColors — the derived palette, mixed from the three draws ─────────────

export interface FaceColors {
  skin: RGB;
  skinLight: RGB; // rim + lit steps
  skinShadow: RGB; // hoods, temple shade
  skinLine: RGB; // nose strokes, age lines
  hair: RGB;
  hairLight: RGB; // rim — floored so black hair still reads
  hairSalt: RGB; // the grey, mixed toward the hair so salt blends
  brow: RGB; // hair-darkened
  lash: RGB; // darker still — lash lines and icon eyes
  lip: RGB; // muted, mixed from the skin's own shadow
  lipLight: RGB; // the lower lip
  sclera: RGB;
  iris: RGB;
  pupil: RGB;
  cloth: RGB;
  clothLight: RGB;
}

export function faceColors(spec: FaceSpec): FaceColors {
  const skin = skinAt(spec.skinU);
  const hair = HAIR_COLORS[spec.hairCIdx].c;
  const lip = mix(shade(skin, 0.58), [154, 70, 60], 0.5);
  return {
    skin,
    skinLight: lift(skin, 1.22, 14),
    skinShadow: shade(skin, 0.74),
    skinLine: shade(skin, 0.58),
    hair,
    hairLight: lift(hair, 1.5, 26),
    hairSalt: mix(hair, [184, 180, 172], 0.85),
    brow: shade(hair, 0.75),
    lash: shade(hair, 0.6),
    lip,
    lipLight: shade(lip, 1.35),
    sclera: [238, 234, 226],
    iris: IRIS_COLORS[spec.irisIdx].c,
    pupil: [18, 15, 12],
    cloth: [30, 32, 36],
    clothLight: [74, 78, 84],
  };
}

// ── Surface — the RGBA painting target ───────────────────────────────────────

interface Surface {
  px: Uint8Array; // RGBA, row-major; alpha 0 = the panel shows through
  size: number;
  put(x: number, y: number, c: RGB): void;
  clear(x: number, y: number): void;
}

function makeSurface(size: number): Surface {
  const px = new Uint8Array(size * size * 4);
  return {
    px,
    size,
    put(x, y, c) {
      if (x < 0 || x >= size || y < 0 || y >= size) return;
      const i = (y * size + x) * 4;
      px[i] = c[0];
      px[i + 1] = c[1];
      px[i + 2] = c[2];
      px[i + 3] = 255;
    },
    clear(x, y) {
      if (x < 0 || x >= size || y < 0 || y >= size) return;
      const i = (y * size + x) * 4;
      px[i] = 0;
      px[i + 1] = 0;
      px[i + 2] = 0;
      px[i + 3] = 0;
    },
  };
}

/** Stamp a small glyph. Chars resolve through `inks`; '.' leaves the surface
 *  alone. Mirrored for the right-hand side of the face. */
function stamp(
  s: Surface,
  x0: number,
  y0: number,
  rows: string[],
  inks: Record<string, RGB>,
  mirror = false
) {
  rows.forEach((row, r) => {
    const chars = mirror ? [...row].reverse() : [...row];
    chars.forEach((ch, c) => {
      const col = inks[ch];
      if (col) s.put(x0 + c, y0 + r, col);
    });
  });
}

// ── The 48×48 dossier plate ──────────────────────────────────────────────────

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

// Eye glyphs — s sclera · r iris · p pupil · k lash · d hood shadow.
// One table for every face: hue carries the contrast, no polarity split.
const EYES: string[][] = [
  ["krrk"], // narrow — a dark-lidded squint over the iris field
  ["kkkkk", "srprs"], // round — lash line over sclera, iris, pupil
  ["kkkkkk", "srpprs"], // wide
  ["dddddd", "kkkkkk", "srpprs"], // deep-set — heavy hood, eye set low
  ["drrrrd"], // almond — shaded corners over the iris field
];

const BROWS: string[][] = [
  ["bbbbb", ".bbb."], // straight
  [".bbb.", "b...b"], // arched
  ["bbbbb", "bbbbb"], // heavy
  [".bbb."], // thin
];

function paintEyes48(
  s: Surface,
  p: ReturnType<typeof profile48>,
  style: number,
  col: FaceColors
) {
  const rows = EYES[style] ?? EYES[0];
  const w = Math.max(...rows.map((r) => r.length));
  const inks: Record<string, RGB> = {
    s: col.sclera,
    r: col.iris,
    p: col.pupil,
    k: col.lash,
    d: col.skinShadow,
  };
  // mirror-exact placement: even-width patterns must sit symmetrically
  stamp(s, p.cx - p.eyeDX - Math.ceil((w - 1) / 2), p.eyeY, rows, inks, false);
  stamp(s, p.cx + p.eyeDX - Math.floor((w - 1) / 2), p.eyeY, rows, inks, true);
}

function paintNose48(
  s: Surface,
  p: ReturnType<typeof profile48>,
  style: number,
  col: FaceColors
) {
  const cx = p.cx;
  // every nose carries a solid tip block — coherent blocks read through the
  // shading, 1px lines do not
  const tip = (w: number) => {
    for (let x = cx - w; x <= cx + w; x++) s.put(x, p.noseTip, col.skinLine);
  };
  switch (style) {
    case 1: // button
      for (let y = p.eyeY + 3; y < p.noseTip; y++) {
        s.put(cx, y, col.skinLine);
        s.put(cx + 1, y, col.skinLine);
      }
      tip(1);
      break;
    case 2: // aquiline — the bump
      for (let y = p.eyeY + 2; y < p.noseTip; y++) {
        s.put(cx, y, col.skinLine);
        s.put(cx + 1, y, col.skinLine);
      }
      s.put(cx + 2, p.eyeY + 4, col.skinLine);
      tip(1);
      break;
    case 3: // broad
      for (let y = p.eyeY + 3; y < p.noseTip; y++) {
        s.put(cx, y, col.skinLine);
        s.put(cx + 1, y, col.skinLine);
      }
      tip(2);
      break;
    default: // straight
      for (let y = p.eyeY + 2; y < p.noseTip; y++) {
        s.put(cx, y, col.skinLine);
        s.put(cx + 1, y, col.skinLine);
      }
      tip(1);
  }
}

function paintMouth48(
  s: Surface,
  p: ReturnType<typeof profile48>,
  style: number,
  col: FaceColors
) {
  const cx = p.cx;
  const y = p.mouthY;
  // two-row solid structure — main line plus lower lip — so the mouth
  // reads at every skin tone
  const line = (w: number) => {
    for (let x = cx - w; x <= cx + w; x++) s.put(x, y, col.lip);
  };
  const lip = (w: number) => {
    for (let x = cx - w; x <= cx + w; x++) s.put(x, y + 1, col.lipLight);
  };
  switch (style) {
    case 1: // smile — corners rise
      s.put(cx - 3, y - 1, col.lip);
      s.put(cx + 3, y - 1, col.lip);
      line(2);
      lip(1);
      break;
    case 2: // corners fall
      line(2);
      lip(1);
      s.put(cx - 3, y + 1, col.lip);
      s.put(cx + 3, y + 1, col.lip);
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
      for (let x = cx - 2; x <= cx + 1; x++) s.put(x, y, col.lip);
      s.put(cx + 2, y - 1, col.lip);
      s.put(cx - 1, y + 1, col.lipLight);
      s.put(cx, y + 1, col.lipLight);
      break;
    default: // flat
      line(2);
      lip(1);
  }
}

/** Age lines read the record: density from the member's actual age. */
function paintAge48(
  s: Surface,
  p: ReturnType<typeof profile48>,
  band: number,
  col: FaceColors
) {
  if (band < 1) return;
  for (let x = p.cx - 2; x <= p.cx + 2; x++) s.put(x, p.browY - 3, col.skinLine); // forehead
  if (band >= 2) {
    s.put(p.cx - 3, p.noseTip - 1, col.skinLine); // nasolabial pair
    s.put(p.cx - 4, p.noseTip, col.skinLine);
    s.put(p.cx + 3, p.noseTip - 1, col.skinLine);
    s.put(p.cx + 4, p.noseTip, col.skinLine);
    const fx = p.eyeDX + 3; // crow's feet
    s.put(p.cx - fx, p.eyeY, col.skinLine);
    s.put(p.cx - fx - 1, p.eyeY - 1, col.skinLine);
    s.put(p.cx + fx, p.eyeY, col.skinLine);
    s.put(p.cx + fx + 1, p.eyeY - 1, col.skinLine);
  }
  if (band >= 3) {
    s.put(p.cx, p.browY - 1, col.skinLine); // glabella
    s.put(p.cx, p.browY - 2, col.skinLine);
    for (let x = p.cx - 2; x <= p.cx + 1; x++) s.put(x, 36, col.skinLine); // neck crease
  }
}

function paintHair48(
  s: Surface,
  p: ReturnType<typeof profile48>,
  spec: FaceSpec,
  def: HairDef,
  col: FaceColors
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

  // fill: the hair color, a floored-lighter rim on the boundary, grey salt
  // through the interior at the age-scaled rate
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
      if (b) s.put(x, y, col.hairLight);
      else s.put(x, y, salt() < spec.hairGrey ? col.hairSalt : col.hair);
    }
  }
}

/** Face lighting — a brightness multiplier per pixel that models the head:
 *  a lit T-zone (forehead, nose bridge, cheeks) against a shadowed jaw,
 *  temples and neck. Real colors take shading as naturally as film. */
function faceLight48(
  x: number,
  y: number,
  p: ReturnType<typeof profile48>
): number {
  const dx = Math.abs(x - p.cx);
  const hw = hwAt(Math.min(y, p.chinY), p);
  let f = 1;
  if (y >= p.browY - 4 && y <= p.browY - 2 && dx <= hw - 2) f += 0.08; // forehead
  else if (y >= p.eyeY + 3 && y <= p.noseTip - 1) {
    if (dx <= 1) f += 0.12; // nose bridge catchlight
    else if (dx >= 3 && dx <= hw - 2) f += 0.06; // cheek apples
  }
  if (y >= p.mouthY + 1 && y <= p.chinY && dx <= hw - 1) f -= 0.1; // chin
  if (y >= p.eyeY + 2 && y <= p.chinY && dx >= hw - 2.5) f -= 0.07; // temples
  if (y > p.chinY) f -= 0.08; // neck sits in shadow
  return f;
}

function paint48(spec: FaceSpec): Uint8Array {
  const S = 48;
  const s = makeSurface(S);
  const p = profile48(spec);
  const hw = (y: number) => hwAt(y, p);
  const col = faceColors(spec);

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

  // ── fill: skin shaded by the light model, cloth flat, rims one step
  //    lighter — the silhouette holds without any white outline ──
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
      if (mk === 1)
        s.put(x, y, edge ? col.skinLight : shade(col.skin, faceLight48(x, y, p)));
      else s.put(x, y, edge ? col.clothLight : col.cloth);
    }
  }

  // collar seam — where the neck meets the suit
  for (let x = p.cx - 5; x <= p.cx + 5; x++) s.put(x, 42, col.clothLight);
  s.put(p.cx - 6, 43, col.clothLight);
  s.put(p.cx + 6, 43, col.clothLight);

  // ── features, then hair over them, then the sensors ──
  const inks: Record<string, RGB> = { b: col.brow };
  const browRows = BROWS[spec.brows] ?? BROWS[0];
  const bw = Math.max(...browRows.map((r) => r.length));
  stamp(s, p.cx - p.eyeDX - Math.ceil((bw - 1) / 2), p.browY, browRows, inks, false);
  stamp(s, p.cx + p.eyeDX - Math.floor((bw - 1) / 2), p.browY, browRows, inks, true);
  paintEyes48(s, p, spec.eyes, col);
  paintNose48(s, p, spec.nose, col);
  paintMouth48(s, p, spec.mouth, col);

  // age lines stay subtle — they are weather, not features
  paintAge48(s, p, spec.ageLines, col);
  paintHair48(s, p, spec, hairDef(spec), col);

  if (spec.cryo) {
    // on the temple itself — just outside the eye cluster, inside the rim,
    // below every fringe line. 2×2 so they read at plate scale.
    const dx = p.eyeDX + 3;
    for (const sd of [-1, 1]) {
      for (let yy = p.eyeY + 1; yy <= p.eyeY + 2; yy++) {
        s.put(p.cx + sd * dx, yy, PHOS);
        s.put(p.cx + sd * (dx + 1), yy, PHOS);
      }
    }
  }

  // ── the collar reading — live data, the only synthetic color. Pips sit
  //    on a cleared patch so they read against the uniform ──
  const clearRect = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) s.clear(x, y);
  };
  switch (spec.collar) {
    case "WATCH":
      clearRect(p.cx - 5, 42, p.cx + 5, 45);
      for (let y = 43; y <= 44; y++)
        for (let x = p.cx - 4; x <= p.cx + 4; x++) s.put(x, y, AMBER);
      break;
    case "SENIOR":
      clearRect(p.cx - 5, 42, p.cx + 5, 45);
      for (let y = 43; y <= 44; y++)
        for (let x = p.cx - 4; x <= p.cx + 4; x++) s.put(x, y, PHOS);
      break;
    case "CORE":
      for (const sx of [p.cx - 6, p.cx + 5]) {
        clearRect(sx - 1, 42, sx + 2, 46);
        for (let y = 43; y <= 45; y++)
          for (let x = sx; x <= sx + 1; x++) s.put(x, y, PHOS);
      }
      break;
    // FILL — the uniform is the collar; no pips
  }

  return s.px;
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

function paint16(spec: FaceSpec): Uint8Array {
  const S = 16;
  const s = makeSurface(S);
  const p = profile16(spec);
  const hw = (y: number) => hwAt(y, p);
  const col = faceColors(spec);

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

  // fill — solid tones at icon scale (shading reads as mud at 16 px), rims
  // one step lighter
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
      if (mk === 1) s.put(x, y, edge ? col.skinLight : col.skin);
      else s.put(x, y, edge ? col.clothLight : col.cloth);
    }
  }

  // eyes — sclera flanks an iris pair; the white carries on every skin
  const eyeRow: [number, RGB][] = [
    [p.cx - 2, col.sclera],
    [p.cx - 1, col.iris],
    [p.cx + 1, col.iris],
    [p.cx + 2, col.sclera],
  ];
  for (const [ex, c] of eyeRow) {
    s.put(ex, p.eyeY, c);
    s.put(ex, p.eyeY + 1, c);
  }
  s.put(p.cx - 2, p.browY, col.lash);
  s.put(p.cx + 2, p.browY, col.lash);
  for (let x = p.cx - 1; x <= p.cx + 1; x++) s.put(x, p.mouthY, col.lip);

  // hair — cap + sides + back blobs, solid color, same rules at icon scale
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
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (!hmask[y * S + x]) continue;
      const b =
        !hmask[y * S + x - 1] ||
        !hmask[y * S + x + 1] ||
        y === 0 ||
        !hmask[(y - 1) * S + x] ||
        (y + 1 >= S ? true : !hmask[(y + 1) * S + x]);
      s.put(x, y, b ? col.hairLight : col.hair);
    }
  }

  // collar seam + reading, cryo sensor
  for (let x = p.cx - 2; x <= p.cx + 2; x++) s.put(x, 13, col.clothLight);
  const clearRect16 = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) s.clear(x, y);
  };
  switch (spec.collar) {
    case "WATCH":
      clearRect16(p.cx - 2, 14, p.cx + 2, 15);
      for (let x = p.cx - 1; x <= p.cx + 1; x++) s.put(x, 14, AMBER);
      break;
    case "SENIOR":
      clearRect16(p.cx - 2, 14, p.cx + 2, 15);
      for (let x = p.cx - 1; x <= p.cx + 1; x++) s.put(x, 14, PHOS);
      break;
    case "CORE":
      for (const sx of [p.cx - 2, p.cx + 2]) {
        clearRect16(sx - 1, 14, sx + 1, 15);
        s.put(sx, 14, PHOS);
      }
      break;
    // FILL — no pips
  }
  if (spec.cryo) {
    s.put(p.cx - 3, p.eyeY, PHOS);
    s.put(p.cx + 3, p.eyeY, PHOS);
    s.put(p.cx - 3, p.eyeY + 1, PHOS);
    s.put(p.cx + 3, p.eyeY + 1, PHOS);
  }

  return s.px;
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Paint a member's mustered photograph. size 48 = dossier plate, 16 = roster
 *  thumbnail. Returns RGBA bytes (alpha 0 = transparent). Pure: same member
 *  in, same pixels out, in any process. */
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
if (new Set(SPECS.map((sp) => JSON.stringify(sp))).size < 150) {
  throw new Error("portrait space collapsed: fewer than 150 distinct faces");
}
