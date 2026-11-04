"use client";

import { cn } from "@/lib/utils";
import {
  BAYS,
  BAY_COUNT,
  BERTHS_PER_BAY,
  type ColdSleepBay,
} from "@/lib/mission/ship";

// ─── Cold-sleep chain — side elevation strip ────────────────────────────────
// The crew screen's navigator: the aft two-thirds of the GA drawing, cropped
// to the bay chain. Same frame as ShipBlueprint (1 unit = 1 m, drawing x =
// STA + 5); this strip just shifts the origin, so every number below is the
// same number the GA drawing uses. The strip IS the cohort index: hover a bay
// for its station data (the status line above), click it to jump to its
// cohort panel in the roster.
//
// Bus B (the cold-sleep reserve battery) renders only when the battery is
// aboard — same rule as the GA drawing. Without it the chain runs on the
// single primary bus: legal, and the drawing says so, in amber.

// strip frame: strip = (drawing x − 78, drawing y − 26)
const NOSE = 5; // STA → drawing x offset (same as the GA drawing)
const CL = 48;
const SPINE_TOP = 45.8;
const SPINE_BOT = 50.2;
const BUS_A_Y = 45.1;
const BUS_B_Y = 50.9;
const BAY_R = 2.5;
const BAY_W = 5.4;
const SX = (x: number) => x - 78;
const SY = (y: number) => y - 26;
const bayX = (b: ColdSleepBay) => SX(b.sta + NOSE);

// bus span — from the first bay's left edge to the last bay's right edge
const X0 = bayX(BAYS[0]) - BAY_R;
const X1 = bayX(BAYS[BAYS.length - 1]) + BAY_R;

// station ruler: ticks at STA 80–160 (drawing x = STA + 5)
const ruler = (sta: number) => SX(sta + NOSE);

export function BayChain({
  hoverBay,
  onHoverBay,
  focusCohort,
  onPickBay,
  hasColdsleep,
}: {
  hoverBay: number | null;
  onHoverBay: (i: number | null) => void;
  focusCohort: number | null;
  onPickBay: (i: number) => void;
  hasColdsleep: boolean;
}) {
  return (
    <svg
      viewBox="-6 12 106 27"
      className="h-full w-full"
      role="img"
      aria-label={`Side elevation of the cold-sleep chain: ${BAY_COUNT} bays strung along the spine, one cohort of ${BERTHS_PER_BAY} per bay, alternating A and B power buses, cargo ring forward, radiators aft`}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* title */}
      <text className="bp-txt" x={-4} y={13.4} style={{ fontSize: "2px" }}>
        COLD-SLEEP CHAIN
      </text>
      <text className="bp-txt-dim" x={24} y={13.4} style={{ fontSize: "1.5px" }}>
        STA 083–158 · TRUE SCALE
      </text>

      {/* spine truss */}
      <g>
        <path className="bp-ink-dim" d={`M${SX(78)},${SY(SPINE_TOP)} H${SX(168)}`} />
        <path className="bp-ink-dim" d={`M${SX(78)},${SY(SPINE_BOT)} H${SX(168)}`} />
        {Array.from({ length: 11 }, (_, i) => {
          const x = SX(80 + i * 8);
          return (
            <g key={i} className="bp-ink-faint">
              <path d={`M${x},${SY(SPINE_TOP)} l8,${SPINE_BOT - SPINE_TOP}`} />
              <path d={`M${x},${SY(SPINE_BOT)} l8,${SPINE_TOP - SPINE_BOT}`} />
            </g>
          );
        })}
      </g>

      {/* end of the cargo ring — the sacrificial mass rides ahead of the sleepers;
          dashed leaders run forward off-frame, the ring continues out of view */}
      <rect className="bp-cell" x={SX(79.8)} y={SY(40.2)} width={4.4} height={2.4} />
      <rect className="bp-cell" x={SX(79.8)} y={SY(53.4)} width={4.4} height={2.4} />
      <path className="bp-ink-faint" d={`M-3,15.4 H${SX(79.8)}`} strokeDasharray="1 0.8" />
      <path className="bp-ink-faint" d={`M-3,28.6 H${SX(79.8)}`} strokeDasharray="1 0.8" />
      <text className="bp-txt-dim" x={SX(87)} y={SY(41)} style={{ fontSize: "1.6px" }}>
        CARGO RING ENDS
      </text>

      {/* radiator wing hinges — the panels deploy outboard, aft of the chain */}
      <path
        className="bp-ink-faint"
        d={`M${SX(165.5)},${SY(SPINE_TOP)} h2 M${SX(165.5)},${SY(SPINE_BOT)} h2`}
      />
      <text
        className="bp-txt-dim"
        x={SX(162)}
        y={18.2}
        textAnchor="end"
        style={{ fontSize: "1.6px" }}
      >
        RADIATORS
      </text>

      {/* bus A — primary, above the spine */}
      <path className="bp-ink-faint" d={`M${X0},${SY(BUS_A_Y)} H${X1}`} />
      {BAYS.map((b) => {
        const cx = bayX(b);
        const cy = SY(CL + b.offset);
        return (
          <path key={`sa${b.id}`} className="bp-ink-faint" d={`M${cx},${SY(BUS_A_Y)} V${cy - BAY_R}`} />
        );
      })}
      <text className="bp-txt-dim" x={2} y={18.1} style={{ fontSize: "1.7px" }}>
        BUS A — PRIMARY
      </text>

      {/* bus B — the reserve battery, only if it is aboard */}
      {hasColdsleep ? (
        <>
          <path className="bp-phos" d={`M${X0},${SY(BUS_B_Y)} H${X1}`} opacity={0.55} />
          {BAYS.map((b) => {
            const cx = bayX(b);
            const cy = SY(CL + b.offset);
            return (
              <g key={`pk${b.id}`}>
                <path className="bp-phos" d={`M${cx},${SY(BUS_B_Y)} V${cy + BAY_R}`} opacity={0.55} />
                <rect
                  className="bp-phos"
                  x={cx + 2.79}
                  y={cy - 1.2}
                  width={0.72}
                  height={2.4}
                  rx={0.2}
                  style={{ fill: "rgba(123,235,166,0.12)" }}
                />
              </g>
            );
          })}
          <text className="bp-txt-dim" x={2} y={26.8} style={{ fontSize: "1.7px" }}>
            BUS B — RESERVE
          </text>
        </>
      ) : (
        <text x={2} y={26.8} style={{ fontSize: "1.5px", fill: "rgba(251,191,36,0.8)" }}>
          BUS B — RESERVE BATTERY NOT FITTED (SEE EQUIP)
        </text>
      )}

      {/* the twelve bays — one cohort each */}
      {BAYS.map((b, i) => {
        const cx = bayX(b);
        const cy = SY(CL + b.offset);
        const focused = focusCohort === i + 1;
        return (
          <g
            key={b.id}
            className={cn(hoverBay === i && "bp-hover")}
            style={{ cursor: "pointer" }}
            onClick={() => onPickBay(i)}
            onMouseEnter={() => onHoverBay(i)}
            onMouseLeave={() => onHoverBay(null)}
          >
            <title>{`BAY ${b.id} · COHORT ${String(b.cohort).padStart(2, "0")} · ${BERTHS_PER_BAY} SOULS · BUS ${b.bus}`}</title>
            <rect className="bp-hull" x={cx - BAY_R} y={cy - BAY_R} width={BAY_W} height={BAY_R * 2} rx={BAY_R} />
            {focused && (
              <rect
                x={cx - BAY_R - 0.3}
                y={cy - BAY_R - 0.3}
                width={BAY_W + 0.6}
                height={BAY_R * 2 + 0.6}
                rx={BAY_R}
                fill="rgba(123,235,166,0.10)"
                stroke="#7beba6"
                strokeWidth={0.3}
              />
            )}
            {/* scan sweep — one bay at a time, cycling down the chain */}
            <rect x={cx - 2.45} y={cy - 2.0} width={1.3} height={4.0} fill="rgba(123,235,166,0.09)">
              <animateTransform
                attributeName="transform"
                type="translate"
                from="0 0"
                to="2.8 0"
                dur="8s"
                begin={`${((i * 8) / BAY_COUNT).toFixed(2)}s`}
                repeatCount="indefinite"
              />
            </rect>
            {/* 17 berths, countable: 9 dorsal, 8 ventral — nothing else inside
                the capsule; the bay id lives on the station ruler below */}
            {Array.from({ length: 9 }, (_, j) => (
              <circle key={`t${j}`} cx={cx - 2 + j * 0.5} cy={cy - 0.55} r={0.24} fill="rgba(123,235,166,0.8)" />
            ))}
            {Array.from({ length: 8 }, (_, j) => (
              <circle key={`b${j}`} cx={cx - 1.75 + j * 0.5} cy={cy + 0.55} r={0.24} fill="rgba(123,235,166,0.8)" />
            ))}
          </g>
        );
      })}
      <text className="bp-txt-dim" x={96} y={26.8} textAnchor="end" style={{ fontSize: "1.5px" }}>
        204 BERTHS · COUNTABLE
      </text>

      {/* station ruler */}
      <g>
        <path className="bp-ink-faint" d="M0,32 H96" />
        {Array.from({ length: 9 }, (_, i) => 80 + i * 10).map((sta) => (
          <path key={sta} className="bp-ink-faint" d={`M${ruler(sta)},31.4 v1.2`} />
        ))}
        {[90, 120, 150].map((sta) => (
          <text key={sta} className="bp-txt-dim" x={ruler(sta)} y={30.6} textAnchor="middle" style={{ fontSize: "1.7px" }}>
            {String(sta).padStart(3, "0")}
          </text>
        ))}
        <text className="bp-txt-dim" x={-4} y={30.6} style={{ fontSize: "1.6px" }}>
          FWD
        </text>
        <text className="bp-txt-dim" x={99} y={30.6} textAnchor="end" style={{ fontSize: "1.6px" }}>
          AFT
        </text>
        {/* bay ids index the ruler — the focused bay's id burns phos */}
        {BAYS.map((b, i) => (
          <text
            key={`id${b.id}`}
            x={bayX(b)}
            y={33.8}
            textAnchor="middle"
            className="bp-txt-dim"
            style={{ fontSize: "1.4px", ...(focusCohort === i + 1 ? { fill: "#7beba6" } : null) }}
          >
            {b.id}
          </text>
        ))}
      </g>

      {/* overall chain dimension — its own band below the ruler ids */}
      <g>
        <path className="bp-ink-faint" d={`M${X0},27.6 V37.2 M${X1},27.6 V37.2`} />
        <path className="bp-ink-dim" d={`M${X0},36.6 H${X1}`} />
        <path className="bp-ink-dim" d={`M${X0 - 0.7},37.3 l1.4,-1.4 M${X1 - 0.7},37.3 l1.4,-1.4`} />
        <text className="bp-txt" x={(X0 + X1) / 2} y={35.4} textAnchor="middle" style={{ fontSize: "1.9px" }}>
          {(X1 - X0).toFixed(1)} M · ONE COHORT PER BAY — NO SHARED FRAMES
        </text>
      </g>
    </svg>
  );
}
