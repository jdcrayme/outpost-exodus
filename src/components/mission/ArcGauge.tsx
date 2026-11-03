"use client";

// ─── Circular gauge — needle instrument in the Discovery manner ──────────────
// 270° sweep dial: graduated ticks, a needle, and a thin outer track whose
// color marks the good / caution / alert zones. The numeric readout sits in
// the open sector at the bottom, as on a real panel instrument.

const CX = 60;
const CY = 56;
const R_TRACK = 46; // colored zone track
const R_TICK_OUT = 43; // tick outer radius
const START = 225; // math degrees for value 0 (lower-left)
const SWEEP = 270; // clockwise sweep to -45° (lower-right)

const PHOS = "#7beba6";
const AMBER = "#f5c76a";
const RED = "#ff5a4d";

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy - r * Math.sin(rad)];
}

/** Clockwise arc (screen space) between two fractions of the sweep. */
function arcBetween(r: number, f0: number, f1: number) {
  const a0 = START - Math.max(0, Math.min(1, f0)) * SWEEP;
  const a1 = START - Math.max(0, Math.min(1, f1)) * SWEEP;
  const [x0, y0] = polar(CX, CY, r, a0);
  const [x1, y1] = polar(CX, CY, r, a1);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  return `M${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 ${large} 1 ${x1.toFixed(2)},${y1.toFixed(2)}`;
}

export function ArcGauge({
  label,
  value,
  max = 100,
  invert = false,
  suffix = "",
  size = 132,
}: {
  label: string;
  value: number;
  max?: number;
  /** invert=true: high value is bad (seismic, radiation). */
  invert?: boolean;
  suffix?: string;
  size?: number;
}) {
  const f = Math.max(0, Math.min(1, value / max));
  const good = invert ? 1 - f : f;
  const zone = good >= 0.66 ? PHOS : good >= 0.4 ? AMBER : RED;

  // zone track boundaries on the value scale (0..1)
  const segs: { from: number; to: number; color: string }[] = invert
    ? [
        { from: 0, to: 0.34, color: PHOS },
        { from: 0.34, to: 0.6, color: AMBER },
        { from: 0.6, to: 1, color: RED },
      ]
    : [
        { from: 0, to: 0.4, color: RED },
        { from: 0.4, to: 0.66, color: AMBER },
        { from: 0.66, to: 1, color: PHOS },
      ];

  // ticks: majors every 10%, minors every 5%
  const ticks: { a: number; major: boolean }[] = [];
  for (let i = 0; i <= 20; i++) {
    ticks.push({ a: START - (i / 20) * SWEEP, major: i % 2 === 0 });
  }

  const needleA = START - f * SWEEP;
  const [nx, ny] = polar(CX, CY, 33, needleA);
  const [tx, ty] = polar(CX, CY, -9, needleA); // counterweight tail

  return (
    <svg
      viewBox="0 0 120 108"
      width={size}
      height={(size * 108) / 120}
      role="img"
      aria-label={`${label}: ${Math.round(value)}${suffix} of ${max}${invert ? ", lower is better" : ""}`}
    >
      {/* colored zone track */}
      {segs.map((s, i) => (
        <path
          key={i}
          d={arcBetween(R_TRACK, s.from, s.to)}
          fill="none"
          stroke={s.color}
          strokeOpacity="0.55"
          strokeWidth="1.6"
        />
      ))}

      {/* faint full rim under the ticks */}
      <circle cx={CX} cy={CY} r={R_TICK_OUT} fill="none" stroke="rgba(232,230,220,0.16)" strokeWidth="1" />

      {/* ticks */}
      {ticks.map((t, i) => {
        const inner = t.major ? R_TICK_OUT - 6 : R_TICK_OUT - 3;
        const [x0, y0] = polar(CX, CY, R_TICK_OUT, t.a);
        const [x1, y1] = polar(CX, CY, inner, t.a);
        return (
          <line
            key={i}
            x1={x0}
            y1={y0}
            x2={x1}
            y2={y1}
            stroke="#e8e6dc"
            strokeOpacity={t.major ? 0.55 : 0.25}
            strokeWidth={t.major ? 1.2 : 0.8}
          />
        );
      })}

      {/* needle + hub */}
      <line x1={tx} y1={ty} x2={nx} y2={ny} stroke="#e8e6dc" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx={CX} cy={CY} r="3.4" fill="#e8e6dc" />
      <circle cx={CX} cy={CY} r="6.5" fill="none" stroke="rgba(232,230,220,0.4)" strokeWidth="0.8" />

      {/* readout in the open bottom sector */}
      <text
        x={CX}
        y={CY + 32}
        textAnchor="middle"
        className="hal-mono"
        fontSize="15"
        fontWeight="600"
        fill={zone}
      >
        {Math.round(value)}
        {suffix}
      </text>
      <text
        x={CX}
        y={CY + 45}
        textAnchor="middle"
        className="hal-mono"
        fontSize="6.5"
        letterSpacing="1"
        fill="rgba(232,230,220,0.45)"
      >
        {label}
      </text>
    </svg>
  );
}
