"use client";

import { cn } from "@/lib/utils";

// ─── Phase dial — the mission clock face in the header ───────────────────────
// A ring divided into five phase arcs. Traversed arcs fill ivory, the active
// arc burns phosphor green, and a needle points to the current phase.
// Pure SVG, no animation loop — state-driven like a real instrument.

const PHASES = [
  { angle: 90 }, // 01 STAR SELECT — top
  { angle: 18 }, // 02 PAYLOAD
  { angle: -54 }, // 03 CREW
  { angle: -126 }, // 04 SURVEY
  { angle: -198 }, // 05 LANDING
];

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy - r * Math.sin(rad)];
}

/** Arc from a0 to a1 (math degrees, CCW positive) on a circle. */
function arcPath(cx: number, cy: number, r: number, a0: number, a1: number) {
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  const ccw = a1 < a0 ? 1 : 0; // SVG sweep flag for counter-clockwise in screen space
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  return `M${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 ${large} ${ccw} ${x1.toFixed(2)},${y1.toFixed(2)}`;
}

export function PhaseDial({
  phaseIdx,
  size = 38,
  className,
}: {
  /** 0–4 for the five mission phases; -1 (or less) for BOOT. */
  phaseIdx: number;
  size?: number;
  className?: string;
}) {
  const C = 50;
  const idx = Math.max(-1, Math.min(4, phaseIdx));

  // each arc spans 58° with 14° gaps (5 × 72° = 360°), clockwise from the top
  const segArc = (i: number) => {
    const mid = PHASES[i].angle;
    return arcPath(C, C, 40, mid - 29, mid + 29);
  };

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      role="img"
      aria-label={`Mission phase ${idx < 0 ? "boot" : idx + 1} of 5`}
    >
      {/* base ring */}
      <circle cx={C} cy={C} r="40" fill="none" stroke="rgba(232,230,220,0.14)" strokeWidth="1" />

      {/* phase arcs */}
      {PHASES.map((p, i) => {
        const done = i < idx;
        const active = i === idx;
        if (!done && !active) return null;
        return (
          <path
            key={i}
            d={segArc(i)}
            fill="none"
            stroke={active ? "#7beba6" : "#e8e6dc"}
            strokeOpacity={active ? 1 : done ? 0.62 : 0.2}
            strokeWidth={active ? 3 : 2}
            strokeLinecap="butt"
          />
        );
      })}

      {/* start tick at top */}
      <line x1={C} y1="6" x2={C} y2="12" stroke="#e8e6dc" strokeOpacity="0.7" strokeWidth="1.4" />

      {/* needle */}
      {idx >= 0 ? (
        <g>
          <line
            x1={C}
            y1={C}
            x2={polar(C, C, 25, PHASES[idx].angle)[0]}
            y2={polar(C, C, 25, PHASES[idx].angle)[1]}
            stroke="#e8e6dc"
            strokeWidth="1.6"
          />
          <circle cx={C} cy={C} r="3" fill="#e8e6dc" />
        </g>
      ) : (
        <circle cx={C} cy={C} r="3" fill="rgba(232,230,220,0.5)" />
      )}
    </svg>
  );
}
