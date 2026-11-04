"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import type { StarSystem } from "@/lib/mission/types";
import { HudPanel, DataRow } from "@/components/common/HudPanel";
import {
  TRANSFER,
  DEPART_ANGLE_DEG,
  JUPITER_ORBIT_AU,
  BURN_DIST_AU,
  BURN_YEARS,
  CRUISE_C,
  CRUISE_KMS,
  SHIP_DRY_T,
  PROP_T,
  CREW_COUNT,
  MAG_DEPLOY_LY,
  MAG_YEARS,
  MAG_V_ARR_KMS,
  missionState,
  properTimeYears,
  solBeaconRxGhz,
  shieldMarginPct,
  totalYears,
  fmtLightTime,
  fmtRange,
  fmtKms,
  kineticEnergyJ,
  transferRangeAu,
} from "@/lib/mission/astro";
import { interceptSolution } from "@/lib/mission/stars";

// ─── Transit plot — Discovery-style departure plate ──────────────────────────
// Three panels: an SVG trajectory plate (draw-on plotter animation, flyby
// detail inset), a KaTeX equation plate with values substituted from live
// mission state, and a ticking telemetry table. All geometry derives from
// astro.ts — no hand-drawn curves.

const DEG = Math.PI / 180;

// ── Plate geometry constants (SVG user units) ──
const VB_W = 580;
const VB_H = 540;
const CX = 290;
const CY = 290;
const PX_AU = 40;
const INSET = { cx: 492, cy: 84, r: 74 };
const INSET_SCALE = 2.5e-5; // px per km inside the flyby inset
const IVORY = "#e8e6dc"; // plotted geometry
const PHOS = "#7beba6"; // the live ship
const AMBER = "#f5c76a"; // propulsive events

function toScreen(rAu: number, angDeg: number): [number, number] {
  return [
    CX + PX_AU * rAu * Math.cos(angDeg * DEG),
    CY - PX_AU * rAu * Math.sin(angDeg * DEG),
  ];
}

/** Point on the TJI ellipse at true anomaly θ (rad), screen coords. */
function ellipsePoint(theta: number): [number, number] {
  return toScreen(transferRangeAu(theta), DEPART_ANGLE_DEG + theta / DEG);
}

// ═══════════════════════ Departure plate (SVG) ═════════════════════════════

const DeparturePlate = memo(function DeparturePlate({ star }: { star: StarSystem }) {
  const geo = useMemo(() => {
    // Transfer ellipse polyline, θ 0 → π (Earth perihelion → Jupiter aphelion)
    const pts: string[] = [];
    for (let i = 0; i <= 96; i++) {
      const [x, y] = ellipsePoint((Math.PI * i) / 96);
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    const transferPath = `M${pts.join("L")}`;
    const pE = ellipsePoint(0);
    const pJ = ellipsePoint(Math.PI);

    // Escape line: from Jupiter along the post-flyby asymptote to plot edge
    const dir = TRANSFER.exitDirDeg;
    const dx = Math.cos(dir * DEG);
    const dy = -Math.sin(dir * DEG); // screen y is flipped
    const tX = (VB_W - 8 - pJ[0]) / dx;
    const tY = (8 - pJ[1]) / dy;
    const t = Math.min(tX, tY);
    const exitEnd: [number, number] = [pJ[0] + dx * t, pJ[1] + dy * t];
    const exitAng = (Math.atan2(dy, dx) * 180) / Math.PI;
    const ignD = BURN_DIST_AU * PX_AU;
    const ignition: [number, number] = [pJ[0] + dx * ignD, pJ[1] + dy * ignD];

    // Flyby inset: hyperbola r(θ) = p/(1 + e·cosθ) around the periapsis axis
    const p = TRANSFER.periapseKm * (1 + TRANSFER.eFlyby); // semi-latus rectum
    const rClip = (INSET.r - 8) / INSET_SCALE;
    const cosClip = (p / rClip - 1) / TRANSFER.eFlyby;
    const thClip = Math.acos(Math.max(-1, Math.min(1, cosClip))) / DEG;
    const hPts: string[] = [];
    for (let i = 0; i <= 64; i++) {
      const th = (-thClip + ((2 * thClip) * i) / 64) * DEG;
      const r = p / (1 + TRANSFER.eFlyby * Math.cos(th));
      const ang = TRANSFER.periAxisDeg + th / DEG;
      hPts.push(
        `${(INSET.cx + r * INSET_SCALE * Math.cos(ang * DEG)).toFixed(1)},${(
          INSET.cy -
          r * INSET_SCALE * Math.sin(ang * DEG)
        ).toFixed(1)}`
      );
    }
    const hyperbolaPath = `M${hPts.join("L")}`;
    const periPt: [number, number] = [
      INSET.cx + TRANSFER.periapseKm * INSET_SCALE * Math.cos(TRANSFER.periAxisDeg * DEG),
      INSET.cy - TRANSFER.periapseKm * INSET_SCALE * Math.sin(TRANSFER.periAxisDeg * DEG),
    ];
    // Asymptote rays from the focus, in the directions the ship comes from / goes to
    const inRayDeg = DEPART_ANGLE_DEG + 180 + 90; // reversed incoming v∞
    const outRayDeg = TRANSFER.exitDirDeg;
    const ray = (a: number): [number, number] => [
      INSET.cx + INSET.r * Math.cos(a * DEG),
      INSET.cy - INSET.r * Math.sin(a * DEG),
    ];
    const inRayEnd = ray(inRayDeg);
    const outRayEnd = ray(outRayDeg);

    return {
      transferPath, pE, pJ, exitEnd, exitAng, ignition,
      hyperbolaPath, periPt, inRayEnd, outRayEnd,
      jupEpoch: (2098.274 + TRANSFER.years).toFixed(3),
      ticks: [1, 2, 3, 4, 5].map((k) => CX + PX_AU * k),
    };
  }, []);

  // Ship marker — traverses the arc and exit line, then parks as a blinking caret
  const markerRef = useRef<SVGGElement>(null);
  const [exited, setExited] = useState(false);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;
    const place = (x: number, y: number, deg: number, op: number) => {
      marker.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${deg.toFixed(1)})`);
      marker.setAttribute("opacity", op.toFixed(2));
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      place(geo.exitEnd[0], geo.exitEnd[1], geo.exitAng, 0);
      const soon = setTimeout(() => setExited(true), 0);
      return () => clearTimeout(soon);
    }
    const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
    const T0 = 2300, T_ELL = 2800, T_DWELL = 420, T_EXIT = 1150;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const e = now - t0;
      if (e < T0) {
        place(geo.pE[0], geo.pE[1], 0, 0);
      } else if (e < T0 + T_ELL) {
        const th = Math.PI * ease((e - T0) / T_ELL);
        const [x, y] = ellipsePoint(th);
        const [lx, ly] = ellipsePoint(Math.min(th + 0.03, Math.PI));
        place(x, y, (Math.atan2(ly - y, lx - x) * 180) / Math.PI, 1);
      } else if (e < T0 + T_ELL + T_DWELL) {
        place(geo.pJ[0], geo.pJ[1], geo.exitAng - 9, 1);
      } else if (e < T0 + T_ELL + T_DWELL + T_EXIT) {
        const p = ease((e - T0 - T_ELL - T_DWELL) / T_EXIT);
        const x = geo.pJ[0] + (geo.exitEnd[0] - geo.pJ[0]) * p;
        const y = geo.pJ[1] + (geo.exitEnd[1] - geo.pJ[1]) * p;
        place(x, y, geo.exitAng, 1);
      } else {
        place(geo.exitEnd[0], geo.exitEnd[1], geo.exitAng, 0);
        setExited(true);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [geo]);

  return (
    <HudPanel
      title="Heliocentric Departure Plane"
      code="PLOT 03-C"
      bodyClassName="p-2 sm:p-3"
      className="h-full"
    >
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="h-auto w-full select-none"
        role="img"
        aria-label={`Departure trajectory plot: transfer ellipse from Earth to Jupiter, gravity assist, and escape toward ${star.name}`}
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
          <clipPath id="tp-inset">
            <circle cx={INSET.cx} cy={INSET.cy} r={INSET.r} />
          </clipPath>
        </defs>

        {/* ── static chrome ── */}
        <g className="fade-in">
          {/* orbit rings */}
          <circle cx={CX} cy={CY} r={PX_AU} fill="none" stroke="#ffffff" strokeOpacity="0.14" strokeWidth="1" />
          <circle
            cx={CX} cy={CY} r={JUPITER_ORBIT_AU * PX_AU}
            fill="none" stroke="#ffffff" strokeOpacity="0.2" strokeWidth="1"
          />
          {/* AU ticks along +x */}
          {geo.ticks.map((x, i) => (
            <g key={x}>
              <line x1={x} y1={CY - 3} x2={x} y2={CY + 3} stroke="#ffffff" strokeOpacity="0.28" strokeWidth="1" />
              {(i === 0 || i === 1 || i === 4) && (
                <text x={x} y={CY + 15} textAnchor="middle" className="hal-mono" fontSize="7" fill="#737373">
                  {i === 4 ? "5 AU" : i + 1}
                </text>
              )}
            </g>
          ))}
          {/* Sun */}
          <circle cx={CX} cy={CY} r="3" fill="#ffe9a8" filter="url(#tp-glow)" />
          <text x={CX - 7} y={CY - 7} textAnchor="end" className="hal-mono" fontSize="7" fill="#a3a3a3">
            SOL
          </text>

          {/* title block */}
          <text x="16" y="26" className="hal-display" fontSize="11" fill="#e5e5e5" letterSpacing="2">
            HELIOCENTRIC DEPARTURE PLANE
          </text>
          <text x="16" y="41" className="hal-mono" fontSize="8" fill="#737373" letterSpacing="1">
            EPOCH 2098.274 · ECLIPTIC J2000 · SNAPSHOT
          </text>
          <text x="16" y="53" className="hal-mono" fontSize="8" fill="#737373" letterSpacing="1">
            CONIC: TJI ELLIPSE → JOVIAN FLYBY → C3 ESCAPE
          </text>
          <line x1="16" y1="60" x2="248" y2="60" stroke="#ffffff" strokeOpacity="0.14" strokeWidth="1" />

          {/* legend */}
          <text x="16" y={VB_H - 10} className="hal-mono" fontSize="7.5" fill="#737373" letterSpacing="0.5">
            PLOT 03-C · TJI e={TRANSFER.e.toFixed(3)} · FLYBY e={TRANSFER.eFlyby.toFixed(3)} · δ={TRANSFER.deltaDeg.toFixed(1)}° · 1 TICK = 1 AU
          </text>

          {/* Earth marker + labels */}
          <g>
            <circle cx={geo.pE[0]} cy={geo.pE[1]} r="3.4" fill="none" stroke="#e5e5e5" strokeWidth="1" />
            <line x1={geo.pE[0] - 4.6} y1={geo.pE[1]} x2={geo.pE[0] + 4.6} y2={geo.pE[1]} stroke="#e5e5e5" strokeWidth="0.8" />
            <line x1={geo.pE[0]} y1={geo.pE[1] - 4.6} x2={geo.pE[0]} y2={geo.pE[1] + 4.6} stroke="#e5e5e5" strokeWidth="0.8" />
            <text x={geo.pE[0] - 9} y={geo.pE[1] - 12} textAnchor="end" className="hal-mono" fontSize="8" fill="#a3a3a3">
              EARTH — TJI BURN 2098.274
            </text>
            <text x={geo.pE[0] - 9} y={geo.pE[1] - 2} textAnchor="end" className="hal-mono" fontSize="8" fill={IVORY}>
              Δv {TRANSFER.dvTjiKms.toFixed(2)} KM/S
            </text>
          </g>

          {/* Jupiter marker + labels */}
          <g>
            <circle cx={geo.pJ[0]} cy={geo.pJ[1]} r="3.2" fill="#d9a066" filter="url(#tp-glow)" />
            <text x={VB_W - 10} y={geo.pJ[1] + 38} textAnchor="end" className="hal-mono" fontSize="8" fill="#a3a3a3">
              JUPITER — FLYBY {geo.jupEpoch}
            </text>
            <text x={VB_W - 10} y={geo.pJ[1] + 50} textAnchor="end" className="hal-mono" fontSize="8" fill="#737373">
              ASSIST δ {TRANSFER.deltaDeg.toFixed(1)}°
            </text>
          </g>
        </g>

        {/* ── trajectory: transfer ellipse (draw-on) ── */}
        <path
          d={geo.transferPath}
          fill="none"
          stroke={IVORY}
          strokeWidth="1.6"
          filter="url(#tp-glow)"
          pathLength={1}
          className="draw-on"
        />

        {/* ── escape line (draw-on, delayed) ── */}
        <line
          x1={geo.pJ[0]} y1={geo.pJ[1]}
          x2={geo.exitEnd[0]} y2={geo.exitEnd[1]}
          stroke={IVORY} strokeOpacity="0.9" strokeWidth="1.2"
          pathLength={1}
          className="draw-on"
          style={{ animationDelay: "2.5s", animationDuration: "0.9s" }}
        />

        {/* ignition point + labels */}
        <g className="fade-in" style={{ animationDelay: "2.8s" }}>
          <rect
            x={geo.ignition[0] - 2.6} y={geo.ignition[1] - 2.6}
            width="5.2" height="5.2"
            fill={AMBER} filter="url(#tp-glow-hi)"
            transform={`rotate(45 ${geo.ignition[0]} ${geo.ignition[1]})`}
          />
          <text x={VB_W - 8} y={geo.ignition[1] + 16} textAnchor="end" className="hal-mono" fontSize="7.5" fill={AMBER}>
            FUSION IGNITION
          </text>
          <text x={VB_W - 8} y={geo.ignition[1] + 27} textAnchor="end" className="hal-mono" fontSize="7.5" fill="#737373">
            +{BURN_DIST_AU} AU · SUSTAINED {BURN_YEARS.toFixed(1)} YR
          </text>
        </g>

        {/* exit labels */}
        <g className="fade-in" style={{ animationDelay: "3.3s" }}>
          <path
            d={`M${geo.exitEnd[0] - 9},${geo.exitEnd[1] - 6.4} L${geo.exitEnd[0] + 1},${geo.exitEnd[1]} L${geo.exitEnd[0] - 9},${geo.exitEnd[1] + 6.4} Z`}
            fill={IVORY} filter="url(#tp-glow)"
            transform={`rotate(${geo.exitAng} ${geo.exitEnd[0]} ${geo.exitEnd[1]})`}
          />
          <text x={geo.exitEnd[0] - 4} y={geo.exitEnd[1] - 44} textAnchor="end" className="hal-mono" fontSize="8.5" fill={IVORY}>
            ESCAPE ASYMPTOTE
          </text>
          <text x={geo.exitEnd[0] - 4} y={geo.exitEnd[1] - 32} textAnchor="end" className="hal-mono" fontSize="8" fill="#a3a3a3">
            {TRANSFER.exitSpeedKms.toFixed(1)} KM/S » {star.shortName} {star.distanceLy.toFixed(2)} LY
          </text>
        </g>

        {/* ── flyby detail inset ── */}
        <g>
          <circle cx={INSET.cx} cy={INSET.cy} r={INSET.r} fill="#060607" stroke="#ffffff" strokeOpacity="0.18" strokeWidth="1" />
          <g className="fade-in">
            {/* asymptotes */}
            <line x1={INSET.cx} y1={INSET.cy} x2={geo.inRayEnd[0]} y2={geo.inRayEnd[1]} stroke="#ffffff" strokeOpacity="0.3" strokeWidth="0.7" strokeDasharray="3 4" />
            <line x1={INSET.cx} y1={INSET.cy} x2={geo.outRayEnd[0]} y2={geo.outRayEnd[1]} stroke="#ffffff" strokeOpacity="0.3" strokeWidth="0.7" strokeDasharray="3 4" />
            {/* Jupiter (radius exaggerated ×3 — noted below) */}
            <circle cx={INSET.cx} cy={INSET.cy} r="5.5" fill="#d9a066" filter="url(#tp-glow)" />
            {/* periapsis tick */}
            <line
              x1={geo.periPt[0]} y1={geo.periPt[1]}
              x2={geo.periPt[0] + (geo.periPt[0] - INSET.cx) * 0.55}
              y2={geo.periPt[1] + (geo.periPt[1] - INSET.cy) * 0.55}
              stroke={IVORY} strokeWidth="0.8"
            />
            {/* v∞ labels + turning angle */}
            <text x={INSET.cx - 44} y={INSET.cy - 50} className="hal-mono" fontSize="7.5" fill="#a3a3a3">
              V∞ {TRANSFER.vInfJupKms.toFixed(2)} KM/S
            </text>
            <text x={INSET.cx - 46} y={INSET.cy + 44} className="hal-mono" fontSize="7.5" fill={IVORY}>
              δ {TRANSFER.deltaDeg.toFixed(1)}°
            </text>
            {/* caption + scale */}
            <text x={INSET.cx} y={INSET.cy + INSET.r + 14} textAnchor="middle" className="hal-mono" fontSize="8" fill="#a3a3a3" letterSpacing="1">
              DETAIL — JOVIAN FLYBY
            </text>
            <text x={INSET.cx} y={INSET.cy + INSET.r + 24} textAnchor="middle" className="hal-mono" fontSize="6.5" fill="#737373">
              R_J SHOWN ×3 · PERIJOVE 10 R_J
            </text>
            <line x1={INSET.cx + 8} y1={INSET.cy + INSET.r - 12} x2={INSET.cx + 33} y2={INSET.cy + INSET.r - 12} stroke="#ffffff" strokeOpacity="0.5" strokeWidth="0.8" />
            <line x1={INSET.cx + 8} y1={INSET.cy + INSET.r - 16} x2={INSET.cx + 8} y2={INSET.cy + INSET.r - 8} stroke="#ffffff" strokeOpacity="0.5" strokeWidth="0.8" />
            <line x1={INSET.cx + 33} y1={INSET.cy + INSET.r - 16} x2={INSET.cx + 33} y2={INSET.cy + INSET.r - 8} stroke="#ffffff" strokeOpacity="0.5" strokeWidth="0.8" />
            <text x={INSET.cx + 3} y={INSET.cy + INSET.r - 17} className="hal-mono" fontSize="6.5" fill="#737373">
              10⁶ KM
            </text>
          </g>
          {/* hyperbola arc (draw-on) */}
          <g clipPath="url(#tp-inset)">
            <path
              d={geo.hyperbolaPath}
              fill="none"
              stroke={IVORY}
              strokeWidth="1.4"
              filter="url(#tp-glow)"
              pathLength={1}
              className="draw-on"
              style={{ animationDelay: "1.2s", animationDuration: "1.4s" }}
            />
          </g>
        </g>

        {/* ship marker — the live vehicle, in phosphor */}
        <g ref={markerRef} opacity="0">
          <path d="M-5,-3.4 L6.5,0 L-5,3.4 Z" fill={PHOS} filter="url(#tp-glow-hi)" />
        </g>

        {/* en-route caret (after exit) */}
        {exited && (
          <g className="fade-in">
            <rect
              x={geo.exitEnd[0] - 2.5} y={geo.exitEnd[1] - 2.5}
              width="5" height="5" fill={PHOS}
              className="hal-blink" filter="url(#tp-glow-hi)"
            />
            <text x={geo.exitEnd[0] - 8} y={geo.exitEnd[1] + 18} textAnchor="end" className="hal-mono hal-blink" fontSize="8" fill="#a5f0c3">
              EN ROUTE
            </text>
          </g>
        )}
      </svg>
    </HudPanel>
  );
});

// ═══════════════════════ Equation plate (KaTeX) ═════════════════════════════

const EquationPlate = memo(function EquationPlate({
  star,
  payloadMassT,
}: {
  star: StarSystem;
  payloadMassT: number;
}) {
  const rows = useMemo(() => {
    const d = star.distanceLy;
    const tTotal = totalYears(d);
    const tCruise = (d - 0.06 - MAG_DEPLOY_LY) / CRUISE_C;
    const ek = kineticEnergyJ(payloadMassT);
    const exp = Math.floor(Math.log10(ek));
    const man = ek / 10 ** exp;
    // torch rocket equation, from the real masses
    const m0 = SHIP_DRY_T + PROP_T + payloadMassT;
    const mf = SHIP_DRY_T + payloadMassT + 0.124 * PROP_T;
    const ve = (CRUISE_KMS - TRANSFER.exitSpeedKms) / Math.log(m0 / mf);
    const dv = ve * Math.log(m0 / mf);
    const tau = properTimeYears(d, tTotal);
    const dTau = tTotal - tau;
    const tex = (s: string) =>
      katex.renderToString(s, { throwOnError: false, displayMode: false });
    return [
      {
        label: "TJI BURN — VIS-VIVA",
        html: tex(
          `v_p=\\sqrt{\\mu_\\odot\\!\\left(\\tfrac{2}{r_1}-\\tfrac{1}{a_t}\\right)}=${TRANSFER.vPeriKms.toFixed(1)}\\;\\mathrm{km/s}\\;\\Rightarrow\\;\\Delta v=${TRANSFER.dvTjiKms.toFixed(2)}\\;\\mathrm{km/s}`
        ),
      },
      {
        label: "JOVIAN FLYBY — TURNING ANGLE",
        html: tex(
          `\\delta=2\\arcsin\\!\\big(1/e\\big)=${TRANSFER.deltaDeg.toFixed(1)}^{\\circ}\\;,\\quad e=1+\\tfrac{r_p v_\\infty^{2}}{\\mu_{\\mathrm{J}}}=1.18`
        ),
      },
      {
        label: `TORCH — ${BURN_YEARS.toFixed(1)} YR SUSTAINED BURN`,
        html: tex(
          `\\Delta v=v_e\\ln\\!\\tfrac{m_0}{m_f}=${Math.round(ve).toLocaleString()}\\;\\mathrm{km/s}\\cdot\\ln\\!\\tfrac{${m0.toLocaleString()}}{${Math.round(mf).toLocaleString()}}=${Math.round(dv).toLocaleString()}\\;\\mathrm{km/s}`
        ),
      },
      {
        label: `CRUISE — ${star.name}`,
        html: tex(
          `t=\\tfrac{d-d_{\\mathrm{brake}}}{0.100\\,c}\\approx${tCruise.toFixed(1)}\\;\\mathrm{yr}`
        ),
      },
      {
        label: "MAGSAIL BRAKE — RAM DRAG",
        html: tex(
          `v(t)=\\tfrac{v_0}{1+t/\\tau'}\\;\\Rightarrow\\;${Math.round(CRUISE_KMS).toLocaleString()}\\to${MAG_V_ARR_KMS.toLocaleString()}\\;\\mathrm{km/s}\\;\\mathrm{over}\\;${MAG_YEARS.toFixed(1)}\\;\\mathrm{yr}`
        ),
      },
      {
        label: "SHIP PROPER TIME @ γ = 1.005",
        html: tex(
          `\\tau=\\int\\!\\mathrm{d}t/\\gamma=${tau.toFixed(1)}\\;\\mathrm{yr}\\;(-${dTau.toFixed(2)}\\;\\mathrm{yr})`
        ),
      },
      {
        label: "KINETIC ENERGY AT CRUISE",
        html: tex(
          `E_k=\\tfrac{1}{2}mv^{2}=${man.toFixed(1)}\\times10^{${exp}}\\;\\mathrm{J}`
        ),
      },
    ];
  }, [star, payloadMassT]);

  const shipT = SHIP_DRY_T + PROP_T + payloadMassT;

  return (
    <HudPanel title="Departure Solution" code="MATH.03" accent="white" bodyClassName="p-3">
      <div className="space-y-2.5">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="hal-mono text-[8px] tracking-[0.28em] text-neutral-500">
              {r.label}
            </div>
            <div
              className="katex-plate mt-0.5 overflow-x-auto text-[13px] leading-relaxed text-neutral-200"
              dangerouslySetInnerHTML={{ __html: r.html }}
            />
          </div>
        ))}
      </div>
      <div className="hal-mono mt-2.5 border-t border-ink/10 pt-1.5 text-[8px] tracking-[0.18em] text-neutral-600">
        SUBSTITUTED FROM LIVE MISSION STATE — PAYLOAD {payloadMassT.toLocaleString()} T · SHIP{" "}
        {shipT.toLocaleString()} T · DEST {star.shortName}
      </div>
    </HudPanel>
  );
});

// ═══════════════════════ Telemetry (ticking table) ═══════════════════════════

const PHASE_META: Record<
  string,
  { label: string; color: string; dot: string }
> = {
  TJI: { label: "TJI COAST", color: "text-neutral-300", dot: "#d4d4d4" },
  FLYBY: { label: "FLYBY", color: "text-amber-300", dot: "#f5c76a" },
  BURN: { label: "TORCH BURN", color: "text-amber-300", dot: "#f5c76a" },
  CRUISE: { label: "CRUISE 0.100 C", color: "text-phos", dot: "#7beba6" },
  MAGSAIL: { label: "MAGSAIL BRAKE", color: "text-amber-300", dot: "#f5c76a" },
  CAPTURE: { label: "CAPTURE BURN", color: "text-amber-300", dot: "#f5c76a" },
};

function TelemetryPanel({ star, years }: { star: StarSystem; years: number }) {
  const st = missionState(star.distanceLy, years);
  const tau = properTimeYears(star.distanceLy, years);
  const beacon = solBeaconRxGhz(st.velKms);
  const shield = shieldMarginPct(star.distanceLy, years);
  const [jit, setJit] = useState({ reactor: 84.2, hull: 291.4, vel: 0 });

  useEffect(() => {
    const t = setInterval(() => {
      setJit((j) => ({
        reactor: Math.max(80.5, Math.min(88.5, j.reactor + (Math.random() - 0.5) * 0.9)),
        hull: Math.max(289.2, Math.min(293.2, j.hull + (Math.random() - 0.5) * 0.5)),
        vel: (Math.random() - 0.5) * 5,
      }));
    }, 170);
    return () => clearInterval(t);
  }, []);

  const meta = PHASE_META[st.phase];

  return (
    <HudPanel title="Telemetry — Forward Link" code="TLM.03" bodyClassName="p-3">
      <div className="mb-2 flex items-center justify-between border border-ink/10 bg-ink/[0.03] px-2 py-1">
        <span className="hal-mono text-[8px] tracking-[0.3em] text-neutral-500">
          PHASE
        </span>
        <span className={`hal-mono text-[9px] tracking-[0.22em] ${meta.color}`}>
          <span
            className="hal-blink mr-1.5 inline-block h-1.5 w-1.5 align-middle"
            style={{ background: meta.dot }}
          />
          {meta.label}
        </span>
      </div>
      <div className="tabular-nums">
        <DataRow label="T+ / MISSION" value={`${years.toFixed(2)} YR`} />
        <DataRow label="τ SHIP PROPER" value={`${tau.toFixed(2)} YR`} />
        <DataRow label="RANGE / SOL" value={fmtRange(st.rangeAu)} />
        <DataRow label="RANGE / DEST" value={`${st.remainingLy.toFixed(3)} LY`} />
        <DataRow
          label="VELOCITY"
          value={fmtKms(st.velKms + (st.phase === "CRUISE" ? jit.vel : 0))}
        />
        <DataRow label="LIGHT SPEED β" value={st.beta.toFixed(5)} />
        <DataRow label="LIGHT-TIME / SOL" value={fmtLightTime(st.rangeAu)} />
        <DataRow
          label="SOL BEACON RX"
          value={`${beacon.toFixed(3)} GHZ`}
          warn={beacon < 8.2}
        />
        <DataRow label="FUSION STOCKPILE" value={`${st.propPct.toFixed(1)} %`} />
        <DataRow
          label="SHIELD MARGIN"
          value={`${shield.toFixed(1)} %`}
          warn={shield < 50}
        />
        <DataRow label="HULL TEMP" value={`${jit.hull.toFixed(1)} K`} />
        <DataRow label="TORPOR" value={`${CREW_COUNT}/${CREW_COUNT} NOMINAL`} />
      </div>
    </HudPanel>
  );
}

// ═══════════════════════ Intercept inset — proper-motion lead ═════════════════

const InterceptPanel = memo(function InterceptPanel({ star }: { star: StarSystem }) {
  const geo = useMemo(() => {
    const icpt = interceptSolution(star);
    const T = totalYears(star.distanceLy);
    // pm screen direction: RA → +x, Dec → up (screen y flipped). Stars with
    // southward pm get the geometry dropped to the upper half so the aim
    // vector never lands in the footer.
    const ang = Math.atan2(star.pmDecMasYr, star.pmRaMasYr);
    const south = star.pmDecMasYr < 0;
    const L = 54; // px — deliberately exaggerated
    const vis: [number, number] = [252, south ? 64 : 96];
    const icptPt: [number, number] = [
      vis[0] + L * Math.cos(ang),
      vis[1] - L * Math.sin(ang),
    ];
    return { icpt, T, vis, icptPt, south };
  }, [star]);

  const { icpt, T, vis, icptPt, south } = geo;
  const trajAng = (Math.atan2(vis[1] - icptPt[1], icptPt[0] - 14) * 180) / Math.PI;
  const icptRight = icptPt[0] <= 208; // ring far enough right for a start-anchored label
  // AIM text rides 30% along the lead vector, offset off the line
  const aimLbl: [number, number] = [
    vis[0] + (icptPt[0] - vis[0]) * 0.3 - 10,
    vis[1] + (icptPt[1] - vis[1]) * 0.3 + (south ? 10 : -8),
  ];

  return (
    <HudPanel
      title="Intercept — Proper Motion"
      code="PLOT 03-D"
      bodyClassName="p-2 sm:p-3"
    >
      <svg
        viewBox="0 0 320 168"
        className="h-auto w-full select-none"
        role="img"
        aria-label={`Intercept geometry for ${star.name}: the ship aims ahead of the star's visual position along its proper motion`}
      >
        {/* visual line of sight — dashed, from Sol */}
        <line
          x1="14" y1={vis[1]} x2={vis[0]} y2={vis[1]}
          stroke="#ffffff" strokeOpacity="0.28" strokeWidth="0.9" strokeDasharray="4 5"
        />
        <text x="16" y="46" className="hal-mono" fontSize="6.5" fill="#737373">
          LINE OF SIGHT · EPOCH 2098 — LIGHT LEFT {star.distanceLy.toFixed(1)} YR AGO
        </text>

        {/* true trajectory — solid, to the intercept */}
        <line
          x1="14" y1={vis[1]} x2={icptPt[0]} y2={icptPt[1]}
          stroke={IVORY} strokeWidth="1.3" filter="url(#tp-glow)"
        />
        <path
          d={`M${icptPt[0] - 9},${icptPt[1] - 6.4} L${icptPt[0] + 1},${icptPt[1]} L${icptPt[0] - 9},${icptPt[1] + 6.4} Z`}
          fill={IVORY}
          transform={`rotate(${trajAng} ${icptPt[0]} ${icptPt[1]})`}
        />
        <text x="20" y="128" className="hal-mono" fontSize="7.5" fill={IVORY}>
          EXODUS — 0.100 C · T = {T.toFixed(0)} YR
        </text>

        {/* visual position — dashed cross */}
        <g stroke="#a3a3ac" strokeWidth="1">
          <line x1={vis[0] - 5} y1={vis[1]} x2={vis[0] + 5} y2={vis[1]} />
          <line x1={vis[0]} y1={vis[1] - 5} x2={vis[0]} y2={vis[1] + 5} />
        </g>
        <text
          x={vis[0] - 9}
          y={vis[1] + 3.5}
          textAnchor="end"
          className="hal-mono" fontSize="7.5" fill="#a3a3ac"
        >
          AS SEEN
        </text>

        {/* intercept position — solid ring */}
        <circle
          cx={icptPt[0]} cy={icptPt[1]} r="5.5"
          fill="none" stroke={PHOS} strokeWidth="1.2" filter="url(#tp-glow)"
        />
        <circle cx={icptPt[0]} cy={icptPt[1]} r="1.6" fill={PHOS} />
        <text
          x={icptRight ? icptPt[0] + 10 : icptPt[0] - 9}
          y={icptPt[1] - 6}
          textAnchor={icptRight ? "start" : "end"}
          className="hal-mono" fontSize="7.5" fill="#a5f0c3"
        >
          INTERCEPT {Math.round(2098.274 + T)}
        </text>

        {/* lead vector */}
        <line
          x1={vis[0]} y1={vis[1]} x2={icptPt[0]} y2={icptPt[1]}
          stroke={AMBER} strokeWidth="0.9" strokeDasharray="3 3"
        />
        <text
          x={aimLbl[0]}
          y={aimLbl[1]}
          textAnchor="end"
          className="hal-mono" fontSize="7" fill={AMBER}
        >
          AIM +{Math.round(icpt.aimAu).toLocaleString()} AU
        </text>

        {/* footer — true numbers */}
        <line x1="14" y1="140" x2="306" y2="140" stroke="#ffffff" strokeOpacity="0.12" strokeWidth="0.8" />
        <text x="14" y="152" className="hal-mono" fontSize="7" fill="#737373">
          μ = {(icpt.pmMasYr / 1000).toFixed(2)}″/YR · v_t = {icpt.vtKms.toFixed(0)} KM/S
        </text>
        <text x="14" y="161" className="hal-mono" fontSize="7" fill="#737373">
          LEAD ANGLE {icpt.leadAngleDeg.toFixed(2)}° TRUE · OFFSET DRAWN ~×10³
        </text>
      </svg>
    </HudPanel>
  );
});

// ═══════════════════════ Composition ════════════════════════════════════════

export default function TransitPlot({
  star,
  payloadMassT,
  years,
}: {
  star: StarSystem;
  payloadMassT: number;
  years: number;
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-12">
      <div className="space-y-3 lg:col-span-7">
        <DeparturePlate star={star} />
        <InterceptPanel star={star} />
      </div>
      <div className="space-y-3 lg:col-span-5">
        <EquationPlate star={star} payloadMassT={payloadMassT} />
        <TelemetryPanel star={star} years={years} />
      </div>
    </div>
  );
}
