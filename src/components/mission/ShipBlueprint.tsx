"use client";

import { useEffect, useRef, useState } from "react";
import { EQUIPMENT_BY_ID } from "@/lib/mission/equipment";
import { cn } from "@/lib/utils";

// ─── GENERAL ARRANGEMENT — SEED SHIP EXODUS, side elevation ──────────────────
// A true engineering-drawing-style blueprint: 1 SVG user unit = 1 metre,
// hardpoints addressed as stations (STA = metres from the nose datum).
// Payload modules dock onto numbered dorsal/ventral spine stations and
// trace themselves in with the plotter animation; the 207 cold-sleep
// berths are drawn as individually countable dots. A 1.76 m human figure
// stands at true scale next to the scale bar — the ship is 225 m long,
// and the figure is the size of a grain of rice. That is the point.

// ── animated counter — mass readout ticks like a fuel gauge ──────────────────

export function useTickNumber(target: number, ms = 550) {
  const [val, setVal] = useState(target);
  const cur = useRef(target);
  useEffect(() => {
    const from = cur.current;
    if (from === target) return;
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      const v = Math.round(from + (target - from) * e);
      cur.current = v;
      setVal(v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return val;
}

// ── hull geometry (metres; nose datum x=5, centerline y=48) ──────────────────

const CL = 48; // centerline
const SPINE_TOP = 45.8;
const SPINE_BOT = 50.2;
const SPINE_X0 = 18;
const SPINE_X1 = 186;
const NOSE = 5;
const TAIL = 230;
const OVERALL_M = TAIL - NOSE; // 225

// cold-sleep stacks: two capsules on the centerline, 102 berths each
const BAY_A = { x: 24, w: 34 };
const BAY_B = { x: 64, w: 34 };
const BAY_R = 5.5;

type Mount = {
  x: number; // attach x (metres)
  side: "D" | "V"; // dorsal / ventral
  base: number; // attach y (metres)
  w: number;
  h: number;
};

// station assignments — every payload item has a fixed hardpoint
const MOUNTS: Record<string, Mount> = {
  vlbi: { x: 26, side: "D", base: 42.5, w: 10, h: 11 },
  commsat: { x: 40, side: "D", base: 42.5, w: 6, h: 9 },
  genevault: { x: 47, side: "D", base: 42.5, w: 8, h: 6 },
  medical: { x: 66, side: "D", base: 42.5, w: 12, h: 7 },
  refinery: { x: 82, side: "D", base: 42.5, w: 12, h: 8 },
  hydro: { x: 102, side: "D", base: SPINE_TOP, w: 12, h: 8 },
  science: { x: 118, side: "D", base: SPINE_TOP, w: 14, h: 8.5 },
  residential: { x: 136, side: "D", base: SPINE_TOP, w: 26, h: 12 },
  reactor: { x: 166, side: "D", base: SPINE_TOP, w: 14, h: 9 },
  coldsleep: { x: 26, side: "V", base: 53.5, w: 32, h: 4.5 },
  industrial: { x: 62, side: "V", base: 53.5, w: 26, h: 12.5 },
  navbeacon: { x: 102, side: "V", base: SPINE_BOT, w: 5, h: 6 },
  rovers: { x: 110, side: "V", base: SPINE_BOT, w: 12, h: 5 },
  sps: { x: 126, side: "V", base: SPINE_BOT, w: 28, h: 8.5 },
  seed: { x: 158, side: "V", base: SPINE_BOT, w: 24, h: 11.5 },
};

// ── module silhouettes — schematic, drawn in a local frame where ─────────────
// (0,0) is the attach corner, +x runs fore→aft, +y runs OUT from the hull.
// Rendered inside a scaled group, so: no text in here.

function ModuleArt({ id }: { id: string }) {
  switch (id) {
    case "vlbi":
      return (
        <>
          <rect pathLength={1} className="bp-ink bp-draw" x={1} y={1} width={4} height={3.2} rx={0.4} />
          <path pathLength={1} className="bp-ink bp-draw" d="M5,2.6 h2.4" />
          <circle pathLength={1} className="bp-ink bp-draw" cx={7.9} cy={4.9} r={2.3} />
          <g className="bp-detail">
            <circle className="bp-ink-dim" cx={7.9} cy={4.9} r={0.45} />
            <path className="bp-ink-faint" d="M7.9,2.6 v2.3 M5.6,4.9 h4.6 M6.3,3.3 l3.2,3.2 M6.3,6.5 l3.2,-3.2" />
            <path className="bp-ink-dim" d="M1,1 l1,-1 M5,1 l-1,-1" />
            <path className="bp-ink-faint" d="M1,1.8 l-1,-0.6 v-1.2 l1,0.6 Z" />
            <circle className="bp-phos" cx={2.4} cy={2} r={0.28} />
          </g>
        </>
      );
    case "commsat":
      return (
        <>
          <rect pathLength={1} className="bp-ink bp-draw" x={1} y={0.5} width={4} height={2} rx={0.25} />
          <path pathLength={1} className="bp-ink bp-draw" d="M3,2.5 v2.4" />
          <circle pathLength={1} className="bp-ink bp-draw" cx={3} cy={6.3} r={1.7} />
          <g className="bp-detail">
            <path className="bp-ink-faint" d="M3,4.6 v1.7 M1.6,6.3 h2.8" />
            <path className="bp-ink-dim" d="M1.4,2.5 l-0.7,2 M4.6,2.5 l0.7,2" />
            <circle className="bp-phos" cx={0.7} cy={4.7} r={0.24} />
            <circle className="bp-phos" cx={5.3} cy={4.7} r={0.24} />
          </g>
        </>
      );
    case "genevault":
      return (
        <>
          <rect pathLength={1} className="bp-ink bp-draw" x={0.5} y={1} width={7} height={2.6} rx={1.3} />
          <g className="bp-detail">
            <circle className="bp-ink-dim" cx={4} cy={2.3} r={0.75} />
            <circle className="bp-ink-dim" cx={4} cy={2.3} r={0.4} />
            <circle className="bp-phos" cx={4} cy={2.3} r={0.14} />
            <circle className="bp-ink-faint" cx={1.6} cy={4.6} r={0.8} />
            <circle className="bp-ink-faint" cx={6.4} cy={4.6} r={0.8} />
            <path className="bp-ink-faint" d="M1.6,3.8 v0.4 M6.4,3.8 v0.4 M1.4,1 l0.4,-1 M6.6,1 l-0.4,-1" />
          </g>
        </>
      );
    case "medical":
      return (
        <>
          <rect pathLength={1} className="bp-ink bp-draw" x={0.5} y={0.8} width={11} height={2.8} rx={1.4} />
          <g className="bp-detail">
            {[3, 6, 9].map((cx) => (
              <g key={cx}>
                <circle className="bp-ink-dim" cx={cx} cy={2.2} r={0.9} />
                <circle className="bp-phos" cx={cx} cy={2.2} r={0.3} />
              </g>
            ))}
            <path className="bp-ink-faint" d="M1.5,0.8 l0.7,-0.8 M10.5,0.8 l-0.7,-0.8" />
          </g>
        </>
      );
    case "refinery":
      return (
        <>
          <rect pathLength={1} className="bp-ink bp-draw" x={0.5} y={0.8} width={5} height={2.4} rx={1.2} />
          <rect pathLength={1} className="bp-ink bp-draw" x={6.5} y={0.8} width={5} height={2.4} rx={1.2} />
          <g className="bp-detail">
            <path className="bp-ink-dim" d="M3,3.2 v1.4 h5 v-1.4" />
            <circle className="bp-ink-dim" cx={5.5} cy={4.6} r={0.42} />
            <rect className="bp-ink-faint" x={10.6} y={3} width={1} height={2.6} rx={0.3} />
            <path className="bp-ink-faint" d="M11.1,5.6 v0.9" />
            <path className="bp-ink-faint" d="M1.4,0.8 l0.6,-0.8 M4.6,0.8 l-0.6,-0.8 M7.4,0.8 l0.6,-0.8 M10.6,0.8 l-0.6,-0.8" />
          </g>
        </>
      );
    case "hydro":
      return (
        <>
          <rect pathLength={1} className="bp-ink bp-draw" x={0.5} y={0.6} width={11} height={6.2} rx={0.3} />
          <g className="bp-detail">
            {[2.1, 3.9, 5.7].map((y) => (
              <path key={y} className="bp-phos" d={`M1.4,${y} h9.2`} opacity={0.55} />
            ))}
            {[2.4, 4.2, 6.0, 7.8, 9.6].map((x) => (
              <circle key={x} className="bp-ink-faint" cx={x} cy={3.9} r={0.22} />
            ))}
            <path className="bp-ink-faint" d="M2,0.6 l0.5,-0.6 M10,0.6 l-0.5,-0.6" />
          </g>
        </>
      );
    case "science":
      return (
        <>
          <rect pathLength={1} className="bp-ink bp-draw" x={0.5} y={0.8} width={6} height={3} rx={1.5} />
          <rect pathLength={1} className="bp-ink bp-draw" x={7.5} y={0.8} width={6} height={3} rx={1.5} />
          <path pathLength={1} className="bp-ink bp-draw" d="M13,3.8 v2.8" />
          <g className="bp-detail">
            <rect className="bp-ink-dim" x={6.5} y={1.6} width={1} height={1.4} />
            <circle className="bp-ink-dim" cx={13} cy={7.2} r={1} />
            <circle className="bp-phos" cx={13} cy={7.2} r={0.25} />
            <path className="bp-ink-faint" d="M1,3.8 v1.8" />
            <circle className="bp-ink-faint" cx={1} cy={6.2} r={0.5} />
            <path className="bp-ink-faint" d="M1.5,0.8 l0.5,-0.8 M5.5,0.8 l-0.5,-0.8 M8,0.8 l0.5,-0.8 M13,0.8 l-0.5,-0.8" />
          </g>
        </>
      );
    case "residential":
      return (
        <>
          <rect pathLength={1} className="bp-ink bp-draw bp-detail" x={0.5} y={0.8} width={25} height={10.5} strokeDasharray="1 0.6" />
          <rect pathLength={1} className="bp-ink bp-draw" x={2} y={1.5} width={8} height={2.6} rx={0.2} />
          <rect pathLength={1} className="bp-ink bp-draw" x={11} y={1.5} width={8} height={2.6} rx={0.2} />
          <rect pathLength={1} className="bp-ink bp-draw" x={20} y={1.5} width={4.5} height={2.6} rx={0.2} />
          <rect pathLength={1} className="bp-ink bp-draw" x={5} y={5.4} width={9} height={2.6} rx={0.2} />
          <rect pathLength={1} className="bp-ink bp-draw" x={16} y={5.4} width={7} height={2.6} rx={0.2} />
          <g className="bp-detail">
            <rect className="bp-ink-dim" x={5.8} y={4.1} width={1.6} height={1.3} />
            <rect className="bp-ink-dim" x={17} y={4.1} width={1.6} height={1.3} />
            {[3.5, 5.5, 7.5].map((x) => (
              <circle key={x} className="bp-phos" cx={x} cy={2.8} r={0.22} opacity={0.7} />
            ))}
            {[13, 15].map((x) => (
              <circle key={x} className="bp-phos" cx={x} cy={2.8} r={0.22} opacity={0.7} />
            ))}
          </g>
        </>
      );
    case "reactor":
      return (
        <>
          <rect pathLength={1} className="bp-ink bp-draw" x={2} y={1} width={6} height={3.4} rx={0.6} />
          <rect pathLength={1} className="bp-ink bp-draw" x={11} y={0.8} width={2.6} height={4.2} rx={0.2} />
          <g className="bp-detail">
            <path className="bp-ink-dim" d="M8,1.8 h3 M8,2.7 h3 M8,3.6 h3" />
            <path className="bp-ink-faint" d="M11.6,1.2 v0.5 M12.3,1.2 v0.5 M13,1.2 v0.5 M11.6,2.2 v0.5 M12.3,2.2 v0.5 M13,2.2 v0.5 M11.6,3.2 v0.5 M12.3,3.2 v0.5 M13,3.2 v0.5" />
            <circle className="bp-ink-dim" cx={5} cy={6} r={0.16} />
            <circle className="bp-ink-dim" cx={4.35} cy={6.65} r={0.32} />
            <circle className="bp-ink-dim" cx={5.65} cy={6.65} r={0.32} />
            <circle className="bp-ink-dim" cx={5} cy={5.35} r={0.32} />
            <path className="bp-ink-faint" d="M3,1 l0.7,-1 M7,1 l-0.7,-1 M11,1.8 l-1.4,-1.8" />
          </g>
        </>
      );
    case "coldsleep":
      return (
        <>
          <rect pathLength={1} className="bp-ink bp-draw" x={0.5} y={0.6} width={15} height={2.2} rx={1.1} />
          <rect pathLength={1} className="bp-ink bp-draw" x={16.5} y={0.6} width={15} height={2.2} rx={1.1} />
          <path pathLength={1} className="bp-ink bp-draw" d="M0.5,3.6 h31" />
          <g className="bp-detail">
            <circle className="bp-ink-dim" cx={8} cy={1.7} r={0.5} />
            <circle className="bp-ink-dim" cx={24} cy={1.7} r={0.5} />
            <path className="bp-ink-faint" d="M8,2.8 v0.8 M24,2.8 v0.8" />
            <circle className="bp-phos" cx={8} cy={1.7} r={0.15} />
            <circle className="bp-phos" cx={24} cy={1.7} r={0.15} />
          </g>
        </>
      );
    case "industrial":
      return (
        <>
          <rect pathLength={1} className="bp-ink bp-draw" x={2} y={1.8} width={16} height={4.4} rx={0.3} />
          <rect pathLength={1} className="bp-ink bp-draw" x={19} y={1.6} width={2.4} height={4.8} rx={0.5} />
          <path pathLength={1} className="bp-ink bp-draw" d="M17,6.2 l2.5,3.6 h4 v-1.2" />
          <g className="bp-detail">
            <path className="bp-ink-faint" d="M18,3.8 h1" />
            <path className="bp-ink-dim" d="M21.2,9.8 v1.4" />
            <rect className="bp-ink-dim" x={20.2} y={11.2} width={2} height={1.2} />
            <rect className="bp-ink-dim" x={2.5} y={6.2} width={19} height={0.5} />
            {[4, 8, 12, 16, 20].map((x) => (
              <circle key={x} className="bp-ink-dim" cx={x} cy={7.5} r={0.62} />
            ))}
            <path className="bp-ink-faint" d="M7,0 v1.8 M13,0 v1.8" />
            {[4, 7, 10, 13].map((x) => (
              <circle key={x} className="bp-phos" cx={x} cy={4} r={0.2} opacity={0.6} />
            ))}
          </g>
        </>
      );
    case "navbeacon":
      return (
        <>
          <rect pathLength={1} className="bp-ink bp-draw" x={0.5} y={0.2} width={4.2} height={0.35} />
          {[0.6, 1.65, 2.7, 3.75].map((x, i) => (
            <rect key={x} pathLength={1} className="bp-ink bp-draw" x={x} y={0.55} width={0.9} height={1.8} rx={0.3} />
          ))}
          <g className="bp-detail">
            {[1.05, 2.1, 3.15, 4.2].map((x, i) => (
              <g key={x}>
                <path className="bp-ink-faint" d={`M${x},0.55 v-${0.7 + (i % 2) * 0.4}`} />
                <circle className="bp-phos" cx={x} cy={-0.7 - (i % 2) * 0.4} r={0.2} />
              </g>
            ))}
          </g>
        </>
      );
    case "rovers":
      return (
        <>
          <rect pathLength={1} className="bp-ink bp-draw" x={0.5} y={0.4} width={11} height={1} rx={0.15} />
          <g className="bp-detail">
            {[1, 2.9, 4.8, 6.7].map((x) => (
              <g key={`t${x}`}>
                <rect className="bp-ink-dim" x={x} y={1.7} width={1.4} height={0.65} rx={0.12} />
                {[x + 0.25, x + 0.7, x + 1.15].map((wx) => (
                  <circle key={wx} className="bp-ink-dim" cx={wx} cy={2.5} r={0.24} />
                ))}
              </g>
            ))}
            {[1, 2.9, 4.8, 6.7].map((x) => (
              <g key={`b${x}`}>
                <rect className="bp-ink-dim" x={x} y={3.3} width={1.4} height={0.65} rx={0.12} />
                {[x + 0.25, x + 0.7, x + 1.15].map((wx) => (
                  <circle key={wx} className="bp-ink-dim" cx={wx} cy={4.1} r={0.24} />
                ))}
              </g>
            ))}
            <path className="bp-ink-faint" d="M2,1.4 v0.3 M9,1.4 v0.3" />
          </g>
        </>
      );
    case "sps":
      return (
        <>
          <rect pathLength={1} className="bp-ink bp-draw" x={0.5} y={0.9} width={10.5} height={6.8} />
          <rect pathLength={1} className="bp-ink bp-draw" x={17} y={0.9} width={10.5} height={6.8} />
          <rect pathLength={1} className="bp-ink bp-draw" x={11.5} y={0.6} width={5} height={2.6} rx={0.4} />
          <g className="bp-detail">
            <rect x={0.5} y={0.9} width={10.5} height={6.8} fill="rgba(123,235,166,0.05)" stroke="none" />
            <rect x={17} y={0.9} width={10.5} height={6.8} fill="rgba(123,235,166,0.05)" stroke="none" />
            {[2, 3.5, 5, 6.5, 8, 9.5].map((x) => (
              <path key={x} className="bp-ink-faint" d={`M${x},0.9 v6.8`} />
            ))}
            {[18.5, 20, 21.5, 23, 24.5, 26].map((x) => (
              <path key={x} className="bp-ink-faint" d={`M${x},0.9 v6.8`} />
            ))}
            <path className="bp-ink-faint" d="M0.5,4.3 h10.5 M17,4.3 h10.5" />
            <circle className="bp-ink-dim" cx={14} cy={4.9} r={1.3} />
            <circle className="bp-phos" cx={14} cy={4.9} r={0.3} />
            <path className="bp-ink-dim" d="M11.5,1.9 h-1 M16.5,1.9 h1" />
          </g>
        </>
      );
    case "seed":
      return (
        <>
          <rect pathLength={1} className="bp-ink bp-draw" x={4} y={1.5} width={15} height={4} rx={0.8} />
          <rect pathLength={1} className="bp-ink bp-draw" x={7} y={0.9} width={9} height={0.9} rx={0.4} />
          <path pathLength={1} className="bp-ink bp-draw" d="M6,5.5 l-3,5.3 M10,5.5 l-1,5.5 M14,5.5 l1,5.5 M18,5.5 l3,5.3" />
          <g className="bp-detail">
            <path className="bp-ink-dim" d="M10.5,5.5 h3 l0.7,1.5 h-4.4 Z" />
            {[7, 10.5, 14].map((x) => (
              <circle key={x} className="bp-ink-dim" cx={x} cy={3.5} r={0.6} />
            ))}
            <rect className="bp-ink-dim" x={16.8} y={0.7} width={1.8} height={4} rx={0.3} />
            <path className="bp-ink-dim" d="M4,3 l-2.5,2.5 v2.4" />
            <path className="bp-ink-faint" d="M1.5,7.9 l-0.4,0.4 M1.5,7.9 l0.4,0.4" />
            <path className="bp-ink-faint" d="M8,0 v1.5 M14,0 v1.5" />
            <circle className="bp-phos" cx={3} cy={11} r={0.3} />
            <circle className="bp-phos" cx={9} cy={11.2} r={0.3} />
            <circle className="bp-phos" cx={15} cy={11.2} r={0.3} />
            <circle className="bp-phos" cx={21} cy={11} r={0.3} />
          </g>
        </>
      );
    default:
      return null;
  }
}

// ── sleeper dot grid — 17 × 6 per stack, 102 each, +3 command berths ─────────

function BerthGrid({ x0 }: { x0: number }) {
  const dots = [];
  for (let i = 0; i < 17; i++) {
    for (let j = 0; j < 6; j++) {
      dots.push(
        <circle
          key={`${i}-${j}`}
          cx={x0 + 1.3 + i * 1.86}
          cy={44 + j * 1.55}
          r={0.42}
          fill="rgba(123,235,166,0.8)"
        />
      );
    }
  }
  return <g>{dots}</g>;
}

// ── the drawing ───────────────────────────────────────────────────────────────

export function ShipBlueprint({
  equipment,
  onToggle,
  hoverId,
  onHover,
}: {
  equipment: string[];
  onToggle: (id: string) => void;
  hoverId: string | null;
  onHover: (id: string | null) => void;
}) {
  const selected = new Set(equipment);
  const mass = equipment.reduce(
    (a, id) => a + (EQUIPMENT_BY_ID.get(id)?.massT ?? 0),
    0
  );
  const massTick = useTickNumber(mass, 700);
  const hoverItem = hoverId ? EQUIPMENT_BY_ID.get(hoverId) : null;
  const hoverMount = hoverId ? MOUNTS[hoverId] : null;

  const truss = [];
  for (let x = SPINE_X0; x < SPINE_X1 - 4; x += 4) {
    truss.push(
      <g key={x}>
        <path className="bp-ink-faint" d={`M${x},${SPINE_TOP} l4,${SPINE_BOT - SPINE_TOP}`} />
        <path className="bp-ink-faint" d={`M${x},${SPINE_BOT} l4,${SPINE_TOP - SPINE_BOT}`} />
      </g>
    );
  }

  return (
    <figure className="m-0">
      {/* status line — station data for the hovered module */}
      <figcaption className="hal-mono mb-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-ink/10 px-1 pb-1.5 text-[10px] tracking-widest text-neutral-500">
        {hoverItem && hoverMount ? (
          <>
            <span className="text-ink">
              STA {String(Math.round(hoverMount.x + hoverMount.w / 2 - NOSE)).padStart(3, "0")}
              {hoverMount.side === "D" ? " D" : " V"} · {hoverItem.name}
            </span>
            <span>
              <span className="text-phos">{hoverItem.massT} T</span>
              {hoverItem.required ? " · MANDATORY" : ""} · REL {hoverItem.reliability}% ·{" "}
              {hoverItem.powerKw > 0
                ? `DRAW ${hoverItem.powerKw} kW`
                : `SUPPLY ${Math.abs(hoverItem.powerKw) / 1000} MW`}
            </span>
          </>
        ) : (
          <>
            <span>
              14 HARDPOINTS · DORSAL/VENTRAL SPINE STATIONS · HOVER FOR STATION DATA
            </span>
            <span className="hidden sm:inline">
              CLICK A DOCKED MODULE TO DISMOUNT IT
            </span>
          </>
        )}
      </figcaption>

      <div className="aspect-[250/88] w-full min-h-[240px]">
        <svg
          viewBox="0 12 250 88"
          className="h-full w-full"
          role="img"
          aria-label={`General arrangement drawing of the seed ship Exodus, ${OVERALL_M} metres overall, with docked payload modules at numbered spine stations`}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* ── spine truss (under everything) ── */}
          <g>
            <path className="bp-ink-dim" d={`M${SPINE_X0},${SPINE_TOP} h${SPINE_X1 - SPINE_X0}`} />
            <path className="bp-ink-dim" d={`M${SPINE_X0},${SPINE_BOT} h${SPINE_X1 - SPINE_X0}`} />
            {truss}
          </g>

          {/* ── cold-sleep stacks (hull over truss) ── */}
          <g>
            {[BAY_A, BAY_B].map((b) => (
              <rect
                key={b.x}
                className="bp-hull"
                x={b.x}
                y={CL - BAY_R}
                width={b.w}
                height={BAY_R * 2}
                rx={BAY_R}
              />
            ))}
            {/* berth dots — 204 of the 207 */}
            <BerthGrid x0={BAY_A.x} />
            <BerthGrid x0={BAY_B.x} />
            {/* scan sweep */}
            {[BAY_A, BAY_B].map((b, i) => (
              <rect key={`sw${b.x}`} x={b.x} y={CL - BAY_R + 0.5} width={1.6} height={BAY_R * 2 - 1} fill="rgba(123,235,166,0.09)">
                <animateTransform
                  attributeName="transform"
                  type="translate"
                  from="0 0"
                  to={`${b.w - 2} 0`}
                  dur="9s"
                  begin={`${i * 4.5}s`}
                  repeatCount="indefinite"
                />
              </rect>
            ))}
            {/* stack codes */}
            <text className="bp-txt-dim" x={BAY_A.x + 30} y={CL - BAY_R + 2.4}>
              CS-A
            </text>
            <text className="bp-txt-dim" x={BAY_B.x + 30} y={CL - BAY_R + 2.4}>
              CS-B
            </text>
          </g>

          {/* ── command sphere ── */}
          <g>
            <circle className="bp-hull" cx={12} cy={CL} r={7} />
            <g className="bp-detail">
              <rect className="bp-ink-dim" x={8} y={46.4} width={8} height={1.1} rx={0.55} />
              <path className="bp-ink-faint" d="M5.5,44.5 h-2 M5.5,51.5 h-2" />
              <rect className="bp-ink-dim" x={3.6} y={46.8} width={1.4} height={2.4} rx={0.3} />
              {/* high-gain dish on a boom */}
              <path className="bp-ink-dim" d="M16,42 l1.6,-2.2" />
              <circle className="bp-ink-dim" cx={18.3} cy={39} r={1.5} />
              <circle className="bp-phos" cx={18.3} cy={39} r={0.25} />
              {/* three command watch berths */}
              <circle cx={9.4} cy={43.6} r={0.5} fill="rgba(123,235,166,0.85)" />
              <circle cx={12} cy={43.2} r={0.5} fill="rgba(123,235,166,0.85)" />
              <circle cx={14.6} cy={43.6} r={0.5} fill="rgba(123,235,166,0.85)" />
            </g>
          </g>

          {/* ── drive section ── */}
          <g>
            <path className="bp-hull" d="M184,45 L192,43.2 L192,52.8 L184,51 Z" />
            <rect className="bp-hull" x={192} y={43.5} width={12} height={9} rx={1} />
            <rect className="bp-hull" x={186} y={32} width={26} height={7} rx={0.5} />
            <rect className="bp-hull" x={186} y={57} width={26} height={7} rx={0.5} />
            <g className="bp-detail">
              <path className="bp-ink-faint" d="M194,45.5 h8 M194,48 h8 M194,50.5 h8" />
              {/* radiator fins */}
              {[189, 192, 195, 198, 201, 204, 207, 210].map((x) => (
                <path key={`rf${x}`} className="bp-ink-faint" d={`M${x},32.6 v5.8`} />
              ))}
              {[189, 192, 195, 198, 201, 204, 207, 210].map((x) => (
                <path key={`rv${x}`} className="bp-ink-faint" d={`M${x},57.6 v5.8`} />
              ))}
              <path className="bp-ink-faint" d="M193,39 v4.5 M205,39 v4.5 M193,57 v-4.5 M205,57 v-4.5" />
              {/* engine bells */}
              <path className="bp-ink-dim" d="M204,44.3 h8 l2.4,3 h-12.8 Z" />
              <path className="bp-ink" d="M204,46.9 h12 l3.4,4 h-18.8 Z" />
              <path className="bp-ink-dim" d="M204,52.2 h8 l2.4,-3 h-12.8 Z" />
              <circle className="bp-phos" cx={210} cy={48.9} r={0.35} />
            </g>
          </g>

          {/* ── station ruler along the spine ── */}
          <g>
            <path className="bp-ink-faint" d="M18,22 h168" />
            {Array.from({ length: 9 }, (_, i) => 25 + i * 20).map((x) => (
              <path key={x} className="bp-ink-faint" d={`M${x},21.4 v1.2`} />
            ))}
            {[45, 85, 125, 165].map((x, i) => (
              <text key={x} className="bp-txt-dim" x={x} y={20.3} textAnchor="middle">
                {i === 0 ? `STA 0${x - NOSE}` : `0${x - NOSE}`}
              </text>
            ))}
            {/* hardpoint registry — diamond per station */}
            {Object.entries(MOUNTS).map(([id, m]) => {
              const cx = m.x + m.w / 2;
              const on = selected.has(id);
              return (
                <g key={`hp-${id}`}>
                  <path
                    d={`M${cx - 1},22 L${cx},21 L${cx + 1},22 L${cx},23 Z`}
                    className={on ? "bp-phos" : "bp-ink-faint"}
                    fill={on ? "rgba(123,235,166,0.6)" : "none"}
                  />
                </g>
              );
            })}
          </g>

          {/* ── payload modules at their hardpoints ── */}
          {Object.entries(MOUNTS).map(([id, m]) => {
            if (!selected.has(id)) return null;
            const item = EQUIPMENT_BY_ID.get(id);
            const dir = m.side === "D" ? -1 : 1;
            return (
              <g
                key={id}
                transform={`translate(${m.x},${m.base}) scale(1,${dir})`}
                className={cn(hoverId === id && "bp-hover")}
                style={{ cursor: item?.required ? "default" : "pointer" }}
                onClick={() => onToggle(id)}
                onMouseEnter={() => onHover(id)}
                onMouseLeave={() => onHover(null)}
              >
                <title>{item ? `${item.name} — ${item.massT} T` : id}</title>
                {/* docking flash */}
                <rect
                  className="dock-flash"
                  x={-0.5}
                  y={-0.5}
                  width={m.w + 1}
                  height={m.h + 1}
                  fill="rgba(123,235,166,0.35)"
                  stroke="none"
                />
                <ModuleArt id={id} />
              </g>
            );
          })}

          {/* ── annotations: leaders + callouts ── */}
          <g>
            {/* command module */}
            <path className="bp-ink-faint" d="M12,40.8 v-6" />
            <text className="bp-txt" x={12} y={33} textAnchor="middle">
              COMMAND MODULE · 3 WATCH BERTHS
            </text>
            {/* cold-sleep stacks, routed below the ventral mounts */}
            <path className="bp-ink-faint" d="M26,53.5 l-2,2.4 v12" />
            <text className="bp-txt" x={24} y={70.5}>
              COLD-SLEEP STACK A — 102 BERTHS
            </text>
            <path className="bp-ink-faint" d="M64,53.5 l-2,2.4 v12" />
            <text className="bp-txt" x={62} y={70.5}>
              COLD-SLEEP STACK B — 102 BERTHS
            </text>
            {/* drive */}
            <path className="bp-ink-faint" d="M219,55.5 l-1.5,14" />
            <text className="bp-txt" x={217} y={72.6} textAnchor="middle">
              FUSION DRIVE · 0.1 C
            </text>
            {/* orientation */}
            <text className="bp-txt-dim" x={20} y={25.8}>
              +Z · DORSAL
            </text>
            <text className="bp-txt-dim" x={20} y={66}>
              −Z · VENTRAL
            </text>
            <text className="bp-txt-dim" x={1.5} y={47.6}>
              FWD
            </text>
            <text className="bp-txt-dim" x={233.5} y={47.6}>
              AFT
            </text>
          </g>

          {/* ── overall length dimension ── */}
          <g>
            <path className="bp-ink-faint" d={`M${NOSE},56 v21.5 M${TAIL},53 v21.5`} />
            <path className="bp-ink-dim" d={`M${NOSE},76 h${TAIL - NOSE}`} />
            <path className="bp-ink-dim" d={`M${NOSE - 0.7},76.7 l1.4,-1.4 M${TAIL - 0.7},76.7 l1.4,-1.4`} />
            <text className="bp-txt" x={117.5} y={74.6} textAnchor="middle">
              {OVERALL_M}.0 M OVERALL — OUTPOST CLASS
            </text>
          </g>

          {/* ── title block ── */}
          <g>
            <rect className="bp-ink-dim" x={6} y={80} width={106} height={16} fill="#030304" />
            <path className="bp-ink-faint" d="M6,86 h106 M6,91 h106 M78,80 v16" />
            <text className="bp-txt" x={8.5} y={84.4} fontWeight={600}>
              OUTPOST-CLASS · SEED SHIP EXODUS
            </text>
            <text className="bp-txt-dim" x={8.5} y={89.6}>
              GENERAL ARRANGEMENT — PAYLOAD CONFIG
            </text>
            <text className="bp-txt-dim" x={8.5} y={94.8}>
              DWG OE-104-GA · REV D · SCHEMATIC
            </text>
            <text className="bp-txt-dim" x={80.5} y={83.6}>
              MASS
            </text>
            <text className="bp-txt-phos" x={80.5} y={89.6}>
              {massTick.toLocaleString()} / 1,760 T
            </text>
            <text className="bp-txt-dim" x={80.5} y={94.8}>
              CREW 207 FROZEN
            </text>
          </g>

          {/* ── scale bar + true-scale human figure ── */}
          <g>
            <path className="bp-ink-dim" d="M200,90 h12" />
            <path className="bp-ink-dim" d="M200,89 v2 M206,89.4 v1.2 M212,89 v2" />
            <text className="bp-txt-dim" x={200} y={93.6} textAnchor="middle">0</text>
            <text className="bp-txt-dim" x={206} y={93.6} textAnchor="middle">5</text>
            <text className="bp-txt-dim" x={212} y={93.6} textAnchor="middle">10 M</text>
            {/* the human — 1.76 m at true scale */}
            <g className="bp-detail">
              <circle className="bp-ink" cx={221.5} cy={88.55} r={0.22} />
              <path className="bp-ink" d="M221.5,88.77 v0.75 M221.1,88.95 l0.8,0.18 M221.5,89.52 l-0.35,0.98 M221.5,89.52 l0.35,0.98" />
            </g>
            <path className="bp-ink-faint" d="M224.3,88.24 v1.76" />
            <path className="bp-ink-faint" d="M223.7,88.9 h1.2" />
            <text className="bp-txt-dim" x={225.6} y={89.3}>
              1.76 M
            </text>
          </g>
        </svg>
      </div>
    </figure>
  );
}
