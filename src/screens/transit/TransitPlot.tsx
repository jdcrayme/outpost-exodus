"use client";

import { useEffect, useMemo, useRef } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import type { Planet, StarSystem } from "@/lib/mission/types";
import { HudPanel } from "@/components/common/HudPanel";
import {
  TRANSFER,
  BURN_YEARS,
  CRUISE_KMS,
  SHIP_DRY_T,
  PROP_T,
  MAG_DEPLOY_LY,
  MAG_YEARS,
  MAG_V_ARR_KMS,
  CAPTURE_V_KMS,
  CAPTURE_YEARS,
  CREW_COUNT,
  LY_AU,
  missionState,
  properTimeYears,
  phaseBoundaries,
  fmtLightTime,
  fmtKms,
} from "@/lib/mission/astro";
import { hashString, mulberry32, intendedParkingWorld } from "@/lib/mission/engine";

// ─── Unified transit plate — one plot, Sol → star → parking orbit ────────────
// A single camera: a log-scale range ladder centered on the destination star.
// The whole transit plays out along the ladder — TJI + flyby + torch at the
// Sol end, the long cruise, the magsail's quarter-century fall, the VLBI
// courier's relay printing its findings as the light catches up to us — and
// then the camera zooms DOWN the ladder, decade rings scrolling past, until
// the destination stops being a point of light and becomes a system chart,
// with the deceleration arc drawn to the intended parking orbit. No cuts and
// no hyperspace: one continuous approach, because it was one continuous
// approach. All geometry derives from astro.ts — no hand-drawn curves.

const DEG = Math.PI / 180;
const VB_W = 1000;
const VB_H = 560;
const FIELD_Y = 262; // the Sol–star baseline, in SVG user units
const STAR_X0 = 830; // star screen x during the transit overview
const STAR_X1 = 500; // …and once the camera has zoomed into the system
const R_BASE = 380; // screen radius of the outer (Sol) ring
const DU = 2.25; // decades of ladder visible at once
const IVORY = "#e8e6dc";
const PHOS = "#7beba6";
const AMBER = "#f5c76a";
const PROBE_C = 0.135; // the VLBI courier's cruise speed

const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const smooth = (t: number) => t * t * (3 - 2 * t);
const easeIO = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function fmtMass(earth: number): string {
  return earth < 20
    ? `${earth.toFixed(1)} M⊕`
    : `${(earth / 317.8).toFixed(1)} M♃`;
}

interface LadderRing {
  au: number;
  label: string | null;
  ly: boolean;
}

export default function TransitPlot({
  star,
  planets,
  hasProbe,
  payloadMassT,
  onPrint,
  onMagsail,
  onApproach,
  onArrival,
  onSurveyDone,
  onDone,
}: {
  star: StarSystem;
  planets: Planet[];
  hasProbe: boolean;
  payloadMassT: number;
  onPrint: () => void;
  onMagsail: () => void;
  onApproach: () => void;
  onArrival: () => void;
  onSurveyDone: () => void;
  onDone: () => void;
}) {
  // callbacks ride a ref so the clock effect never re-subscribes
  const cb = useRef({ onPrint, onMagsail, onApproach, onArrival, onSurveyDone, onDone });
  useEffect(() => {
    cb.current = { onPrint, onMagsail, onApproach, onArrival, onSurveyDone, onDone };
  });

  // ── static mission geometry, computed once ──
  const geo = useMemo(() => {
    const dLy = star.distanceLy;
    const dAu = dLy * LY_AU;
    const pb = phaseBoundaries(dLy);
    const uMax0 = Math.log10(dAu);
    const uMin0 = uMax0 - DU;

    // system-scale window: outermost planet orbit sits ~72% out on the ladder
    const auOut = planets.reduce((a, p) => Math.max(a, p.orbitAu), 0.6);
    const uMin1 = Math.log10(auOut) - 1.62;
    const Z = uMin0 - uMin1; // decades the camera descends during the zoom

    // range rings — nice light-year values plus AU decades, deduped. Labels
    // yield to a neighbour within ~0.12 decades so close rings stay hairlines.
    const lyVals = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10]
      .map((v) => v * LY_AU)
      .filter((au) => au <= dAu * 1.02);
    const rings: LadderRing[] = lyVals.map((au) => ({
      au,
      label: `${+(au / LY_AU).toPrecision(2)} LY`,
      ly: true,
    }));
    rings.push({ au: dAu, label: `${dLy.toFixed(2)} LY`, ly: true });
    for (let e = -2; e <= 5; e++) {
      for (const m of [1, 2, 5]) {
        const au = m * 10 ** e;
        if (au < 0.03 || au > dAu * 1.02) continue;
        if (rings.some((r) => Math.abs(Math.log10(r.au / au)) < 0.07)) continue;
        const decade = m === 1;
        rings.push({
          au,
          label: decade
            ? au >= 1000
              ? `${au / 1000}K AU`
              : `${au} AU`
            : null,
          ly: false,
        });
      }
    }
    rings.sort((a, b) => a.au - b.au);
    // thin out crowded labels — the d-ring (Sol's) always keeps its own
    {
      let lastKept = -Infinity;
      for (const r of rings) {
        if (!r.label) continue;
        const u = Math.log10(r.au);
        if (u - lastKept < 0.12 && r.au !== dAu) r.label = null;
        else lastKept = u;
      }
    }

    // system chart at full zoom (log map at uMin1) — same ladder, bottom rung
    const R1 = (au: number) => (R_BASE * (Math.log10(au) - uMin1)) / DU;
    const target = intendedParkingWorld(planets, hasProbe);
    const targetAu = target?.orbitAu ?? Math.max(1, auOut * 0.4);
    const planetGeo = planets.map((p) => ({
      R: R1(p.orbitAu),
      phase: mulberry32(hashString(p.id))() * Math.PI * 2,
      speed: 0.028 / Math.sqrt(p.orbitAu ** 3),
      color: p.color,
      size:
        p.kind === "GAS_GIANT" || p.kind === "ICE_GIANT"
          ? 4.6
          : 2.6 + Math.min(1.6, p.radiusKm / 6371),
    }));
    const hzIn = Math.sqrt(star.luminositySolar / 1.1);
    const hzOut = Math.sqrt(star.luminositySolar / 0.53);

    // deceleration arc — a log spiral in world terms (AU, radians), mapped
    // onto the *current* ladder every frame so it draws in as we zoom. It
    // enters from the Sol direction, past the edge of the view, and wraps
    // ~300° before settling onto the intended parking orbit.
    const rStart = 10 ** (uMin0 - 0.5 * Z + DU) * 1.06;
    const ARC_N = 88;
    const arcR = new Float64Array(ARC_N + 1);
    const arcTh = new Float64Array(ARC_N + 1);
    const th0 = 168 * DEG;
    const sweep = 5.25;
    const uS = Math.log10(rStart);
    const uE = Math.log10(targetAu);
    for (let i = 0; i <= ARC_N; i++) {
      const a = i / ARC_N;
      arcR[i] = 10 ** lerp(uS, uE, a);
      arcTh[i] = th0 + a * sweep;
    }

    // VLBI courier timing, honestly: the probe runs 0.135 c, arrives at the
    // star, and its survey flies home at lightspeed until it catches us.
    let tProbe = Infinity;
    let tRx0 = Infinity;
    if (hasProbe) {
      tProbe = dLy / PROBE_C;
      let lo = tProbe;
      let hi = pb.tTotal;
      for (let i = 0; i < 48; i++) {
        const mid = (lo + hi) / 2;
        const r = missionState(dLy, mid).remainingLy;
        if (r > mid - tProbe) lo = mid;
        else hi = mid;
      }
      tRx0 = (lo + hi) / 2;
    }
    const printT = planets.map((_, i) => {
      const span = Math.min(
        Math.max(2, (pb.tMagEnd - tRx0) * 0.5),
        pb.tCruiseEnd + MAG_YEARS * 0.6 - tRx0
      );
      const n = Math.max(1, planets.length - 1);
      return tRx0 + (i / n) * Math.max(0.5, span);
    });

    return {
      dLy, dAu, pb, uMax0, uMin0, uMin1, Z, rings,
      auOut, target, targetAu, planetGeo, hzIn, hzOut,
      arcR, arcTh, ARC_N, tProbe, tRx0, printT,
      rCruiseMid: 10 ** ((uMax0 + Math.log10(MAG_DEPLOY_LY * LY_AU)) / 2),
    };
  }, [star, planets, hasProbe]);

  // ── equation plate — small, overlaid on the plot, fades out on zoom ──
  const eqRows = useMemo(() => {
    const tCruise = geo.pb.tCruiseEnd - geo.pb.tBurnEnd;
    const m0 = SHIP_DRY_T + PROP_T + payloadMassT;
    const mf = SHIP_DRY_T + payloadMassT + 0.124 * PROP_T;
    const ve = (CRUISE_KMS - TRANSFER.exitSpeedKms) / Math.log(m0 / mf);
    const dv = ve * Math.log(m0 / mf);
    const tau = properTimeYears(geo.dLy, geo.pb.tTotal);
    const tex = (s: string) => katex.renderToString(s, { throwOnError: false });
    return [
      {
        label: `TORCH — ${BURN_YEARS.toFixed(1)} YR SUSTAINED`,
        html: tex(
          `\\Delta v=v_e\\ln\\!\\tfrac{m_0}{m_f}=${Math.round(dv).toLocaleString()}\\;\\mathrm{km/s}`
        ),
      },
      {
        label: "CRUISE — 0.100 C",
        html: tex(
          `t=\\tfrac{d-d_{\\mathrm{brake}}}{0.100\\,c}\\approx${tCruise.toFixed(1)}\\;\\mathrm{yr}`
        ),
      },
      {
        label: "MAGSAIL — RAM DRAG",
        html: tex(
          `v(t)=\\tfrac{v_0}{1+t/\\tau'}\\Rightarrow${Math.round(CRUISE_KMS).toLocaleString()}\\to${MAG_V_ARR_KMS.toLocaleString()}\\;\\mathrm{km/s}`
        ),
      },
      {
        label: "SHIP PROPER TIME",
        html: tex(`\\tau=\\!\\int\\!\\mathrm{d}t/\\gamma=${tau.toFixed(1)}\\;\\mathrm{yr}`),
      },
    ];
  }, [geo, payloadMassT]);

  // ── refs driven imperatively by the master clock ──
  const worldG = useRef<SVGGElement>(null);
  const ringC = useRef<(SVGCircleElement | null)[]>([]);
  const ringT = useRef<(SVGTextElement | null)[]>([]);
  const overviewG = useRef<SVGGElement>(null);
  const solG = useRef<SVGGElement>(null);
  const traveled = useRef<SVGLineElement>(null);
  const remaining = useRef<SVGLineElement>(null);
  const corridor = useRef<SVGLineElement>(null);
  const markerG = useRef<SVGGElement>(null);
  const velLine = useRef<SVGLineElement>(null);
  const velText = useRef<SVGTextElement>(null);
  const probeG = useRef<SVGGElement>(null);
  const deployG = useRef<SVGGElement>(null);
  const cruiseT = useRef<SVGTextElement>(null);
  const printHead = useRef<SVGTextElement>(null);
  const printEls = useRef<(SVGTextElement | null)[]>([]);
  const titleA = useRef<SVGGElement>(null);
  const titleB = useRef<SVGGElement>(null);
  const phaseG = useRef<SVGGElement>(null);
  const phaseFill = useRef<SVGRectElement>(null);
  const phaseCaret = useRef<SVGRectElement>(null);
  const sysG = useRef<SVGGElement>(null);
  const sysPlanets = useRef<(SVGCircleElement | null)[]>([]);
  const arcPath = useRef<SVGPathElement>(null);
  const captureDia = useRef<SVGGElement>(null);
  const sysShip = useRef<SVGGElement>(null);
  const sysShipT = useRef<SVGTextElement>(null);
  const starBase = useRef<SVGCircleElement>(null);
  const starHalo = useRef<SVGCircleElement>(null);
  const starT = useRef<SVGTextElement>(null);
  const starTY = useRef<SVGTextElement>(null);
  const captureT = useRef<SVGTextElement>(null);
  const eqBox = useRef<SVGForeignObjectElement>(null);
  const yearsEl = useRef<HTMLSpanElement>(null);
  const rangeEl = useRef<HTMLSpanElement>(null);
  const velEl = useRef<HTMLSpanElement>(null);
  const lightEl = useRef<HTMLSpanElement>(null);

  // ── the master clock: screen time → mission years + camera zoom ──
  useEffect(() => {
    const RM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const D = RM
      ? { dep: 60, cruise: 60, mag: 60, zoom: 220, hold: 600 }
      : { dep: 2400, cruise: 5200, mag: 4200, zoom: 3200, hold: 1700 };
    const T1 = D.dep;
    const T2 = T1 + D.cruise;
    const T3 = T2 + D.mag;
    const T4 = T3 + D.zoom;
    const T5 = T4 + D.hold;
    const { pb } = geo;

    const clock = (t: number): { years: number; zoom: number } => {
      if (t < T1) return { years: easeIO(t / T1) * pb.tBurnEnd, zoom: 0 };
      if (t < T2)
        return {
          years: lerp(pb.tBurnEnd, pb.tCruiseEnd, (t - T1) / D.cruise),
          zoom: 0,
        };
      if (t < T3)
        return {
          years: lerp(
            pb.tCruiseEnd,
            pb.tMagEnd,
            easeOut((t - T2) / D.mag)
          ),
          zoom: 0,
        };
      const zoom = easeIO(clamp01((t - T3) / D.zoom));
      // the capture burn itself flies during the first 70% of the zoom
      return {
        years: lerp(pb.tMagEnd, pb.tTotal, clamp01(zoom / 0.7)),
        zoom,
      };
    };

    const fired = { mag: false, approach: false, arrival: false, survey: false, done: false };
    const shown = planets.map(() => false);
    let raf = 0;
    const t0 = performance.now();

    const frame = (now: number) => {
      const t = now - t0;
      const { years, zoom } = clock(t);
      const st = missionState(geo.dLy, years);

      // narrative callbacks
      if (!fired.mag && years >= pb.tCruiseEnd) {
        fired.mag = true;
        cb.current.onMagsail();
      }
      if (!fired.approach && zoom > 0.02) {
        fired.approach = true;
        cb.current.onApproach();
      }
      if (hasProbe) {
        for (let i = 0; i < printEls.current.length; i++) {
          if (!shown[i] && years >= geo.printT[i]) {
            shown[i] = true;
            printEls.current[i]?.setAttribute("opacity", "1");
            if (i === 0) printHead.current?.setAttribute("opacity", "1");
            cb.current.onPrint();
          }
        }
      }
      if (!fired.arrival && zoom >= 1) {
        fired.arrival = true;
        cb.current.onArrival();
      }
      if (!fired.survey && t >= T4 + 600) {
        fired.survey = true;
        cb.current.onSurveyDone();
      }

      // ── camera ──
      const uMin = geo.uMin0 - zoom * geo.Z;
      const starX = lerp(STAR_X0, STAR_X1, smooth(zoom));
      worldG.current?.setAttribute(
        "transform",
        `translate(${starX.toFixed(1)} ${FIELD_Y})`
      );
      const R = (au: number) => (R_BASE * (Math.log10(au) - uMin)) / DU;

      const overviewO = 1 - clamp01((zoom - 0.08) / 0.24);
      const sysO = clamp01((zoom - 0.45) / 0.3);
      const arcP = easeIO(clamp01((zoom - 0.5) / 0.42));

      // ── range ladder ──
      geo.rings.forEach((rg, i) => {
        const c = ringC.current[i];
        if (!c) return;
        const r = R(rg.au);
        const vis =
          r > 3 && r < R_BASE * 1.05 ? clamp01((r - 3) / 10) : 0;
        c.setAttribute("r", Math.max(0.1, r).toFixed(1));
        c.setAttribute("opacity", (vis * (rg.ly ? 0.16 : 0.09)).toFixed(3));
        const tx = ringT.current[i];
        if (tx) {
          if (rg.label && r > 34 && r < R_BASE * 1.02 && vis > 0.5) {
            tx.setAttribute("x", (-0.94 * r).toFixed(1));
            tx.setAttribute("y", (0.34 * r + 3).toFixed(1));
            const lo = rg.ly
              ? 1 - clamp01(zoom * 2.6)
              : clamp01((zoom - 0.3) / 0.28);
            tx.setAttribute("opacity", (lo * 0.75).toFixed(3));
          } else {
            tx.setAttribute("opacity", "0");
          }
        }
      });

      // ── overview layer: trajectory, markers, annotations ──
      if (overviewG.current)
        overviewG.current.setAttribute("opacity", overviewO.toFixed(3));
      const remAu = Math.max(0, st.remainingLy) * LY_AU;
      const Rm = Math.max(0, Math.min(R(remAu), R_BASE * 1.06));
      const Rsol = R(geo.dAu);
      markerG.current?.setAttribute("transform", `translate(${-Rm} 0)`);
      if (traveled.current) {
        traveled.current.setAttribute("x1", (-Rsol).toFixed(1));
        traveled.current.setAttribute("x2", (-Rm).toFixed(1));
      }
      if (remaining.current) {
        remaining.current.setAttribute("x1", (-Rm - 4).toFixed(1));
        remaining.current.setAttribute("x2", "-10");
      }
      if (solG.current)
        solG.current.setAttribute("transform", `translate(${-Rsol} 0)`);
      if (cruiseT.current)
        cruiseT.current.setAttribute("x", (-R(geo.rCruiseMid)).toFixed(1));
      const Rd = R(MAG_DEPLOY_LY * LY_AU);
      if (deployG.current)
        deployG.current.setAttribute("transform", `translate(${-Rd} 0)`);
      if (corridor.current) {
        corridor.current.setAttribute("x1", (-Rd).toFixed(1));
        corridor.current.setAttribute(
          "opacity",
          (years >= pb.tCruiseEnd ? 0.22 : 0).toFixed(3)
        );
      }
      // velocity vector — it visibly shrinks through the long fall
      const vf = clamp01(st.velKms / CRUISE_KMS);
      if (velLine.current) {
        velLine.current.setAttribute("x1", (-Rm - 2).toFixed(1));
        velLine.current.setAttribute(
          "x2",
          (-Rm - 2 + Math.max(3, 46 * vf)).toFixed(1)
        );
      }
      if (velText.current) {
        velText.current.setAttribute("x", (-Rm + 6).toFixed(1));
        velText.current.textContent = `V ${fmtKms(st.velKms)}`;
      }
      // the courier, running thirty years ahead
      if (probeG.current) {
        const rp = geo.dLy - PROBE_C * years;
        if (hasProbe && rp > 0.001 && overviewO > 0.05) {
          const Rp = Math.max(0, Math.min(R(rp * LY_AU), R_BASE));
          probeG.current.setAttribute(
            "transform",
            `translate(${-Rp} -9)`
          );
          probeG.current.setAttribute("opacity", "1");
        } else {
          probeG.current.setAttribute("opacity", "0");
        }
      }

      // ── star glyph: a point of light becoming a place ──
      if (starBase.current)
        starBase.current.setAttribute("r", (3.5 + 3.6 * sysO).toFixed(2));
      if (starHalo.current)
        starHalo.current.setAttribute("opacity", (sysO * 0.5).toFixed(3));
      if (starT.current)
        starT.current.setAttribute("opacity", (sysO * 0.9).toFixed(3));
      if (starTY.current)
        starTY.current.setAttribute("opacity", (sysO * 0.75).toFixed(3));

      // ── system layer: orbits, worlds, deceleration arc ──
      if (sysG.current)
        sysG.current.setAttribute("opacity", sysO.toFixed(3));
      geo.planetGeo.forEach((g, i) => {
        const el = sysPlanets.current[i];
        if (!el) return;
        const ang = g.phase + (t / 1000) * g.speed;
        el.setAttribute(
          "transform",
          `translate(${(g.R * Math.cos(ang)).toFixed(1)} ${(-g.R * Math.sin(ang)).toFixed(1)})`
        );
      });
      if (arcPath.current) {
        const pts: string[] = [];
        for (let i = 0; i <= geo.ARC_N; i++) {
          const r = Math.min(R(geo.arcR[i]), R_BASE * 1.18);
          const th = geo.arcTh[i];
          pts.push(
            `${(r * Math.cos(th)).toFixed(1)},${(-r * Math.sin(th)).toFixed(1)}`
          );
        }
        arcPath.current.setAttribute("d", `M${pts.join("L")}`);
        arcPath.current.setAttribute("stroke-dashoffset", (1 - arcP).toFixed(4));
      }
      const endTh = geo.arcTh[geo.ARC_N];
      const Rt = R(geo.targetAu);
      if (captureDia.current) {
        const ai = Math.floor(geo.ARC_N * 0.86);
        const r = Math.min(R(geo.arcR[ai]), R_BASE * 1.18);
        const th = geo.arcTh[ai];
        captureDia.current.setAttribute(
          "transform",
          `translate(${(r * Math.cos(th)).toFixed(1)} ${(-r * Math.sin(th)).toFixed(1)})`
        );
        captureDia.current.setAttribute("opacity", (sysO * arcP).toFixed(3));
      }
      if (sysShip.current) {
        const mx = Rt * Math.cos(endTh);
        const my = -Rt * Math.sin(endTh);
        sysShip.current.setAttribute("opacity", arcP >= 1 ? "1" : "0");
        sysShip.current.setAttribute(
          "transform",
          `translate(${mx.toFixed(1)} ${my.toFixed(1)})`
        );
        if (sysShipT.current) {
          sysShipT.current.setAttribute("x", (mx - 12).toFixed(1));
          sysShipT.current.setAttribute("y", (my + 22).toFixed(1));
          sysShipT.current.setAttribute(
            "opacity",
            arcP >= 1 ? "0.95" : "0"
          );
        }
      }
      if (captureT.current)
        captureT.current.setAttribute(
          "opacity",
          clamp01((zoom - 0.94) / 0.06).toFixed(3)
        );

      // ── titles, equations, phase bar ──
      titleA.current?.setAttribute(
        "opacity",
        (1 - clamp01((zoom - 0.22) / 0.24)).toFixed(3)
      );
      titleB.current?.setAttribute(
        "opacity",
        clamp01((zoom - 0.5) / 0.28).toFixed(3)
      );
      if (eqBox.current)
        eqBox.current.setAttribute(
          "opacity",
          (1 - clamp01((zoom - 0.05) / 0.22)).toFixed(3)
        );
      if (phaseG.current)
        phaseG.current.setAttribute(
          "opacity",
          (1 - clamp01((zoom - 0.55) / 0.35)).toFixed(3)
        );
      const fw = (years / pb.tTotal) * 920;
      phaseFill.current?.setAttribute("width", Math.max(0, fw).toFixed(1));
      phaseCaret.current?.setAttribute("x", (40 + Math.max(0, fw)).toFixed(1));

      // ── chips ──
      if (yearsEl.current) yearsEl.current.textContent = years.toFixed(1);
      if (rangeEl.current)
        rangeEl.current.textContent = `${st.remainingLy.toFixed(3)} LY`;
      if (velEl.current) velEl.current.textContent = fmtKms(st.velKms);
      if (lightEl.current)
        lightEl.current.textContent = fmtLightTime(st.rangeAu);

      if (!fired.done && t >= T5) {
        fired.done = true;
        cb.current.onDone();
        return; // stop the clock
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [geo, hasProbe, planets]);

  const arrivalYr = Math.round(2098.274 + geo.pb.tTotal);
  const deployYr = Math.round(2098.274 + geo.pb.tCruiseEnd);
  const targetDesig = geo.target?.designation ?? "NOMINAL";

  // system-chart radii at full zoom (log map at uMin1)
  const R1 = (au: number) => (R_BASE * (Math.log10(au) - geo.uMin1)) / DU;
  const hzRin = R1(geo.hzIn);
  const hzRout = R1(geo.hzOut);
  const targetR = R1(geo.targetAu);

  // phase-time bar segments (proportional to real phase durations)
  const segs = [
    { at: geo.pb.tJup / geo.pb.tTotal, label: `TJI 2098.274`, anchor: "start" as const, y: 516 },
    { at: geo.pb.tBurnEnd / geo.pb.tTotal, label: `TORCH OUT ${Math.round(2098.274 + geo.pb.tBurnEnd)}`, anchor: "start" as const, y: 491 },
    { at: geo.pb.tCruiseEnd / geo.pb.tTotal, label: `MAGSAIL DEPLOY ${deployYr}`, anchor: "start" as const, y: 516 },
    { at: (geo.pb.tCruiseEnd + MAG_YEARS / 2) / geo.pb.tTotal, label: `MAGSAIL ${MAG_YEARS.toFixed(1)} YR`, anchor: "middle" as const, y: 491 },
    { at: 1, label: `ARRIVAL ${arrivalYr}`, anchor: "end" as const, y: 516 },
  ];

  return (
    <HudPanel
      title={`Interstellar Transit — ${star.name}`}
      code="PLOT 03"
      className="flex h-full min-h-0 w-full flex-col"
      bodyClassName="flex min-h-0 flex-1 flex-col p-2 sm:p-3"
    >
      {/* live chips */}
      <div className="mb-2 grid shrink-0 grid-cols-4 gap-2 border border-ink/10 bg-black/40 p-2 text-center sm:grid-cols-5">
        <div>
          <span ref={yearsEl} className="hal-display glow-phos block text-lg text-phos sm:text-xl">
            0.0
          </span>
          <span className="hal-mono mt-0.5 block text-[8px] tracking-widest text-neutral-500">
            YEARS ELAPSED
          </span>
        </div>
        <div>
          <span ref={rangeEl} className="hal-display block text-lg text-ink sm:text-xl">
            {star.distanceLy.toFixed(2)}
          </span>
          <span className="hal-mono mt-0.5 block text-[8px] tracking-widest text-neutral-500">
            LY TO DESTINATION
          </span>
        </div>
        <div>
          <span ref={velEl} className="hal-display block text-lg text-ink sm:text-xl">
            —
          </span>
          <span className="hal-mono mt-0.5 block text-[8px] tracking-widest text-neutral-500">
            VELOCITY
          </span>
        </div>
        <div>
          <span ref={lightEl} className="hal-display block text-lg text-ink sm:text-xl">
            —
          </span>
          <span className="hal-mono mt-0.5 block text-[8px] tracking-widest text-neutral-500">
            LIGHT-TIME TO SOL
          </span>
        </div>
        <div className="hidden sm:block">
          <span className="hal-display block text-lg text-ink sm:text-xl">
            {CREW_COUNT}
          </span>
          <span className="hal-mono mt-0.5 block text-[8px] tracking-widest text-neutral-500">
            CREW · TORPOR
          </span>
        </div>
      </div>

      {/* the plot — one continuous camera */}
      <div className="relative min-h-0 flex-1">
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="absolute inset-0 h-full w-full select-none"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`Transit plot from Sol to ${star.name}: log-scale range ladder with torch burn, cruise, magsail braking, VLBI probe relay, and a continuous zoom into the destination system showing the deceleration arc to the intended parking orbit`}
        >
          <defs>
            <filter id="tp-glow" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="1.4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="tp-glow-hi" x="-120%" y="-120%" width="340%" height="340%">
              <feGaussianBlur stdDeviation="1.8" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* ══ world — everything anchored to the destination star ══ */}
          <g ref={worldG} transform={`translate(${STAR_X0} ${FIELD_Y})`}>
            {/* range ladder */}
            <g>
              {geo.rings.map((rg, i) => (
                <g key={`ring-${rg.au.toFixed(5)}`}>
                  <circle
                    ref={(el) => {
                      ringC.current[i] = el;
                    }}
                    cx={0}
                    cy={0}
                    r={R_BASE}
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="0.8"
                    opacity={rg.ly ? 0.16 : 0.09}
                  />
                  {rg.label && (
                    <text
                      ref={(el) => {
                        ringT.current[i] = el;
                      }}
                      className="hal-mono"
                      fontSize="7"
                      fill="#a3a3a3"
                      textAnchor="middle"
                      opacity="0"
                    >
                      {rg.label}
                    </text>
                  )}
                </g>
              ))}
            </g>

            {/* overview: the transit itself */}
            <g ref={overviewG} opacity="1">
              {/* braking corridor */}
              <line
                ref={corridor}
                x1={-R_BASE}
                y1={7}
                x2={-10}
                y2={7}
                stroke={AMBER}
                strokeWidth="2"
                opacity="0"
              />
              {/* remaining route (dashed) */}
              <line
                ref={remaining}
                x1={-R_BASE}
                y1={0}
                x2={-10}
                y2={0}
                stroke={IVORY}
                strokeOpacity="0.35"
                strokeWidth="0.9"
                strokeDasharray="3 5"
              />
              {/* travelled route (solid) */}
              <line
                ref={traveled}
                x1={-R_BASE}
                y1={0}
                x2={0}
                y2={0}
                stroke={IVORY}
                strokeWidth="1.4"
                filter="url(#tp-glow)"
              />
              {/* Sol cluster */}
              <g ref={solG}>
                <circle cx={0} cy={0} r="3.2" fill="#ffe9a8" filter="url(#tp-glow)" />
                <text x={-9} y={-10} textAnchor="end" className="hal-mono" fontSize="8" fill="#a3a3a3">
                  SOL
                </text>
                <text x={-9} y={16} textAnchor="end" className="hal-mono" fontSize="7" fill="#737373">
                  TJI Δv {TRANSFER.dvTjiKms.toFixed(1)} · FLYBY δ {TRANSFER.deltaDeg.toFixed(0)}° · TORCH {BURN_YEARS.toFixed(1)} YR
                </text>
              </g>
              {/* cruise annotation */}
              <text
                ref={cruiseT}
                x={-R_BASE * 0.5}
                y={-26}
                textAnchor="middle"
                className="hal-mono"
                fontSize="8"
                fill="#a3a3ac"
              >
                CRUISE 0.100 C — {Math.round(geo.pb.tCruiseEnd - geo.pb.tBurnEnd)} YR
              </text>
              {/* magsail deployment */}
              <g ref={deployG}>
                <circle cx={0} cy={0} r="5" fill="none" stroke={AMBER} strokeWidth="1" opacity="0.85" />
                <circle cx={0} cy={0} r="1.4" fill={AMBER} />
                <text x={0} y={-20} textAnchor="middle" className="hal-mono" fontSize="7.5" fill={AMBER} stroke="#030304" strokeWidth={2.5} paintOrder="stroke">
                  MAGSAIL DEPLOY {deployYr}
                </text>
              </g>
              {/* VLBI courier — thirty years ahead */}
              <g ref={probeG} opacity="0">
                <path d="M-3.2,-2.2 L3.2,0 L-3.2,2.2 Z" fill={AMBER} opacity="0.9" />
                <text x={0} y={-7} textAnchor="middle" className="hal-mono" fontSize="6.5" fill={AMBER} opacity="0.85">
                  VLBI COURIER 0.135 C
                </text>
              </g>
              {/* the ship */}
              <g ref={markerG} transform="translate(0 0)">
                <path d="M-5,-3.4 L6.5,0 L-5,3.4 Z" fill={PHOS} filter="url(#tp-glow-hi)" />
                <line ref={velLine} x1={0} y1={13} x2={40} y2={13} stroke={PHOS} strokeWidth="1.2" opacity="0.75" />
                <text ref={velText} x={6} y={28} className="hal-mono" fontSize="7.5" fill="#a5f0c3">
                  V —
                </text>
              </g>
            </g>

            {/* the destination — a point of light becoming a place */}
            <circle
              ref={starHalo}
              cx={0}
              cy={0}
              r={15}
              fill={star.color}
              opacity="0"
              filter="url(#tp-glow-hi)"
            />
            <circle ref={starBase} cx={0} cy={0} r={3.5} fill={star.color} filter="url(#tp-glow)" />
            <text
              ref={starT}
              x={0}
              y={26}
              textAnchor="middle"
              className="hal-mono"
              fontSize="8.5"
              fill={IVORY}
              opacity="0"
              stroke="#030304"
              strokeWidth={2.5}
              paintOrder="stroke"
            >
              {star.shortName}
            </text>
            <text
              ref={starTY}
              x={0}
              y={38}
              textAnchor="middle"
              className="hal-mono"
              fontSize="7"
              fill="#a3a3ac"
              opacity="0"
              stroke="#030304"
              strokeWidth={2.5}
              paintOrder="stroke"
            >
              ARRIVAL {arrivalYr}
            </text>

            {/* system layer — fades in as the ladder bottoms out */}
            <g ref={sysG} opacity="0">
              {/* habitable zone annulus */}
              <circle
                cx={0}
                cy={0}
                r={(hzRin + hzRout) / 2}
                fill="none"
                stroke="rgba(123,235,166,0.08)"
                strokeWidth={Math.max(1, Math.abs(hzRout - hzRin))}
              />
              {/* orbit rings */}
              {geo.planetGeo.map((g, i) => (
                <circle
                  key={`orb-${i}`}
                  cx={0}
                  cy={0}
                  r={g.R}
                  fill="none"
                  stroke="#ffffff"
                  strokeOpacity={0.22}
                  strokeWidth="0.8"
                />
              ))}
              {/* the intended parking orbit, emphasized */}
              <circle
                cx={0}
                cy={0}
                r={targetR}
                fill="none"
                stroke={IVORY}
                strokeOpacity={0.7}
                strokeWidth={1.3}
                strokeDasharray="7 4"
              />
              {/* worlds */}
              {geo.planetGeo.map((g, i) => (
                <circle
                  key={`pl-${i}`}
                  ref={(el) => {
                    sysPlanets.current[i] = el;
                  }}
                  cx={0}
                  cy={0}
                  r={g.size}
                  fill={g.color}
                  filter="url(#tp-glow)"
                />
              ))}
              {/* deceleration arc — log spiral drawn onto the live ladder */}
              <path
                ref={arcPath}
                d=""
                fill="none"
                stroke={IVORY}
                strokeWidth={1.6}
                filter="url(#tp-glow)"
                pathLength={1}
                strokeDasharray="1"
                strokeDashoffset={1}
              />
              {/* capture burn */}
              <g ref={captureDia} opacity="0">
                <rect x={-2.6} y={-2.6} width={5.2} height={5.2} fill={AMBER} transform="rotate(45)" filter="url(#tp-glow-hi)" />
                <text x={8} y={12} className="hal-mono" fontSize="7" fill={AMBER}>
                  CAPTURE BURN
                </text>
              </g>
              {/* the ship, parked */}
              <g ref={sysShip} opacity="0">
                <circle cx={0} cy={0} r={9} fill="none" stroke={PHOS} strokeWidth={1.1} opacity={0.85} />
                <path d="M-4.5,-3 L6,0 L-4.5,3 Z" fill={PHOS} filter="url(#tp-glow-hi)" />
              </g>
              <text
                ref={sysShipT}
                x={0}
                y={0}
                textAnchor="end"
                className="hal-mono"
                fontSize="7.5"
                fill="#a5f0c3"
                opacity="0"
                stroke="#030304"
                strokeWidth={2.5}
                paintOrder="stroke"
              >
                EXODUS — PARKING ORBIT {geo.targetAu.toFixed(2)} AU
              </text>
              {/* provenance of the approach */}
              <text x={-430} y={-42} className="hal-mono" fontSize="7" fill="#737373" opacity="0.8" stroke="#030304" strokeWidth={2.5} paintOrder="stroke">
                ◀ FROM SOL — {geo.dLy.toFixed(2)} LY CONTINUOUS TRANSIT
              </text>
              {!hasProbe && (
                <text x={0} y={52} textAnchor="middle" className="hal-mono" fontSize="7" fill="#f87171" opacity="0.9" stroke="#030304" strokeWidth={2.5} paintOrder="stroke">
                  MASS DETECTION ONLY — NO SURFACE TELEMETRY
                </text>
              )}
              {hasProbe && (
                <text x={0} y={52} textAnchor="middle" className="hal-mono" fontSize="7" fill={PHOS} opacity="0.8" stroke="#030304" strokeWidth={2.5} paintOrder="stroke">
                  VLBI SURVEY COMPLETE — {planets.length} WORLDS RESOLVED
                </text>
              )}
            </g>
          </g>

          {/* ══ titles ══ */}
          <g ref={titleA} opacity="1">
            <text x="16" y="30" className="hal-display" fontSize="13" fill="#e5e5e5" letterSpacing="2.5">
              INTERSTELLAR TRANSIT — {star.name}
            </text>
            <text x="16" y="48" className="hal-mono" fontSize="8" fill="#737373" letterSpacing="1">
              SOL ▸ {star.shortName} · {star.distanceLy.toFixed(2)} LY · CRUISE 0.100 C · EPOCH 2098.274
            </text>
            <text x="16" y="60" className="hal-mono" fontSize="8" fill="#737373" letterSpacing="1">
              LOG RANGE LADDER · DECADE RINGS · NON-LINEAR SCALE
            </text>
            <line x1="16" y1="68" x2="436" y2="68" stroke="#ffffff" strokeOpacity="0.14" strokeWidth="1" />
          </g>
          <g ref={titleB} opacity="0">
            <text x="16" y="30" className="hal-display" fontSize="13" fill="#e5e5e5" letterSpacing="2.5">
              SYSTEM ENTRY — {star.name}
            </text>
            <text x="16" y="48" className="hal-mono" fontSize="8" fill="#737373" letterSpacing="1">
              {arrivalYr} SHIP CALENDAR · CAPTURE BURN {MAG_V_ARR_KMS.toLocaleString()} ▸ {CAPTURE_V_KMS} KM/S · BOUND ORBIT
            </text>
            <text x="16" y="60" className="hal-mono" fontSize="8" fill="#737373" letterSpacing="1">
              DECELERATION ARC ▸ PARKING ORBIT {targetDesig} · {geo.targetAu.toFixed(2)} AU
            </text>
            <line x1="16" y1="68" x2="436" y2="68" stroke="#ffffff" strokeOpacity="0.14" strokeWidth="1" />
          </g>

          {/* ══ equations — small, overlaid on the plot below the title ══ */}
          <foreignObject ref={eqBox} x="14" y="80" width="380" height="170">
            <div className="pointer-events-none w-fit space-y-1.5">
              {eqRows.map((r) => (
                <div key={r.label} className="w-fit border-l border-ink/25 bg-black/45 px-2 py-1">
                  <div className="hal-mono text-[7px] tracking-[0.25em] text-neutral-500">
                    {r.label}
                  </div>
                  <div
                    className="katex-plate text-[11px] leading-relaxed text-neutral-200"
                    dangerouslySetInnerHTML={{ __html: r.html }}
                  />
                </div>
              ))}
            </div>
          </foreignObject>

          {/* ══ VLBI survey relay — printed on the plot as the light catches up ══ */}
          {hasProbe && (
            <g>
              <text
                ref={printHead}
                x="676"
                y="96"
                className="hal-mono"
                fontSize="7.5"
                fill="#a5f0c3"
                opacity="0"
                style={{ transition: "opacity 0.5s ease" }}
                stroke="#030304"
                strokeWidth={3}
                paintOrder="stroke"
              >
                VLBI SURVEY RELAY — RECEPTION T+{Math.round(geo.tRx0)} YR
              </text>
              {planets.map((p, i) => (
                <text
                  key={`pr-${p.id}`}
                  ref={(el) => {
                    printEls.current[i] = el;
                  }}
                  x="676"
                  y={112 + i * 15}
                  className="hal-mono"
                  fontSize="8"
                  fill={p.inHabitableZone ? "#d4f5e0" : PHOS}
                  opacity="0"
                  style={{ transition: "opacity 0.6s ease" }}
                  stroke="#030304"
                  strokeWidth={2.5}
                  paintOrder="stroke"
                >
                  ▸ {p.designation} · {fmtMass(p.massEarth)} · {p.orbitAu.toFixed(2)} AU{p.inHabitableZone ? " · HZ" : ""}
                </text>
              ))}
            </g>
          )}

          {/* ══ capture complete ══ */}
          <text
            ref={captureT}
            x={STAR_X1}
            y={448}
            textAnchor="middle"
            className="hal-mono glow-phos"
            fontSize="9"
            fill={PHOS}
            opacity="0"
            letterSpacing="1.5"
          >
            CAPTURE COMPLETE — BOUND ORBIT — V {CAPTURE_V_KMS} KM/S
          </text>

          {/* ══ phase-time bar ══ */}
          <g ref={phaseG} opacity="1">
            <rect x={40} y={496} width={920} height={7} fill="none" stroke="#ffffff" strokeOpacity={0.18} strokeWidth="1" />
            <rect ref={phaseFill} x={40} y={496} width={0} height={7} fill={PHOS} opacity={0.55} />
            <rect ref={phaseCaret} x={40} y={493} width={1.5} height={13} fill={PHOS} />
            {[
              geo.pb.tJup,
              geo.pb.tBurnEnd,
              geo.pb.tCruiseEnd,
              geo.pb.tMagEnd,
            ].map((tv, i) => (
              <line
                key={`tick-${i}`}
                x1={40 + (tv / geo.pb.tTotal) * 920}
                y1={494}
                x2={40 + (tv / geo.pb.tTotal) * 920}
                y2={505}
                stroke={AMBER}
                strokeOpacity={0.5}
                strokeWidth="1"
              />
            ))}
            {segs.map((s, i) => (
              <text
                key={`seg-${i}`}
                x={40 + s.at * 920}
                y={s.y}
                textAnchor={s.anchor}
                className="hal-mono"
                fontSize="7.5"
                fill="#8f8f8f"
              >
                {s.label}
              </text>
            ))}
          </g>

          {/* footer legend */}
          <text x="16" y={VB_H - 8} className="hal-mono" fontSize="7" fill="#737373">
            PLOT 03 · SCALE: LOG₁₀ DECADES · 1 RING = 1 DECADE · MAGSAIL {MAG_YEARS.toFixed(1)} YR · CAPTURE {CAPTURE_YEARS.toFixed(1)} YR
          </text>
        </svg>
      </div>
    </HudPanel>
  );
}
