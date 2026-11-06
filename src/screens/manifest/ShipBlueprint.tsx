"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { EQUIPMENT_BY_ID } from "@/lib/mission/equipment";
import {
  BAYS,
  BAY_COUNT,
  BERTHS_PER_BAY,
  CELL_OWNER,
  RACK,
  STOWAGE,
  type RackRowId,
} from "@/lib/mission/ship";
import { cn } from "@/lib/utils";

// ─── GENERAL ARRANGEMENT — SEED SHIP EXODUS, side elevation · REV E ──────────
// A true engineering-drawing-style blueprint: 1 SVG user unit = 1 metre,
// hardpoints addressed as stations (STA = metres from the nose datum).
// Fore → aft: three-layer Whipple debris shield on standoff struts, command
// sphere (3 watch berths), the cargo ring — 44 container cells racked around
// the forward spine, deliberately outboard of the debris shadow (the cargo is
// the outermost sacrificial mass) — then twelve cold-sleep bays strung along
// the centreline INSIDE the shadow cone: one cohort (17 souls) per bay,
// staggered clock positions, alternating A/B power buses, no two bays sharing
// a frame. Aft: deployable radiator wings, copper fuel (D-He³ spheres plus
// departure drop-stages, jettisoned at the Jovian assist), neutron shadow
// shield, fusion drive. 204 berth dots stay individually countable.
//
// The camera has three presets — FULL SHIP / CARGO RING / CRYO BAYS — tweened
// on the viewBox like pushing a magnifier across paper, and the sheet is a
// free instrument: drag pans, the wheel zooms on the cursor, any station is
// clickable. A LOD layer (cell stamps, per-bay telemetry, plumbing labels)
// fades in whenever the camera is in close. The screen opens on the establish
// shot; the first loadout action pushes in to the cargo ring, where the work is.

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

// ── camera — presets tweened imperatively, plus free pan/zoom ────────────────

export type BlueprintView = "full" | "cargo" | "bays";

export const BLUEPRINT_VIEWS: { id: BlueprintView; label: string }[] = [
  { id: "full", label: "FULL SHIP" },
  { id: "cargo", label: "CARGO RING" },
  { id: "bays", label: "CRYO BAYS" },
];

type VB = readonly [number, number, number, number];

const VIEW_BOX: Record<BlueprintView, VB> = {
  full: [0, 12, 250, 88],
  cargo: [0.5, 26, 108, 38.02],
  bays: [70, 29, 96.6, 34],
};

// free-camera limits — viewBox width in metres; height keeps the drawing's
// 250:88 aspect so the sheet never skews
const CAM_W_MIN = 26;
const CAM_W_MAX = 260;
const LOD_W = 205; // closer than this, the zoom-level detail layer is on

function clampVB([x, y, w]: VB): VB {
  const h = (w * 88) / 250;
  return [
    Math.min(Math.max(x, -14), 264 - w),
    Math.min(Math.max(y, 4), 104 - h),
    w,
    h,
  ];
}

function fmtVB(vb: VB): string {
  return vb.map((n) => n.toFixed(2)).join(" ");
}

/** The blueprint camera. Presets tween the svg viewBox imperatively (no
 *  re-render per frame); wheel zoom and drag pan write the same viewBox
 *  directly. Returns whether the camera is currently "in close" (LOD). */
function useBlueprintCamera(svgRef: React.RefObject<SVGSVGElement | null>) {
  const cur = useRef<VB>(VIEW_BOX.full);
  const raf = useRef(0);
  const [zoomed, setZoomed] = useState(
    VIEW_BOX.full[2] < LOD_W // false — the establish shot is wide
  );

  const stop = useCallback(() => cancelAnimationFrame(raf.current), []);

  const set = useCallback(
    (vb: VB) => {
      cur.current = vb;
      svgRef.current?.setAttribute("viewBox", fmtVB(vb));
      const z = vb[2] < LOD_W;
      setZoomed((prev) => (prev === z ? prev : z)); // re-render only on the flip
    },
    [svgRef]
  );

  const tweenTo = useCallback(
    (to: VB, dur = 950) => {
      stop();
      const el = svgRef.current;
      const from = cur.current;
      const reduce =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (
        !el ||
        reduce ||
        (from[0] === to[0] &&
          from[1] === to[1] &&
          from[2] === to[2] &&
          from[3] === to[3])
      ) {
        set(to);
        return;
      }
      const t0 = performance.now();
      const step = (t: number) => {
        const k = Math.min(1, (t - t0) / dur);
        const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        set([
          from[0] + (to[0] - from[0]) * e,
          from[1] + (to[1] - from[1]) * e,
          from[2] + (to[2] - from[2]) * e,
          from[3] + (to[3] - from[3]) * e,
        ]);
        if (k < 1) raf.current = requestAnimationFrame(step);
      };
      raf.current = requestAnimationFrame(step);
    },
    [set, stop, svgRef]
  );

  useEffect(() => stop, [stop]);

  return { cur, set, tweenTo, zoomed };
}

// ── hull geometry (metres; nose datum x=5, centerline y=48) ──────────────────

const CL = 48;
const SPINE_TOP = 45.8;
const SPINE_BOT = 50.2;
const SPINE_X0 = 20;
const SPINE_X1 = 186;
const NOSE = 5;
const TAIL = 230;
const OVERALL_M = TAIL - NOSE; // 225

// debris shield — three Whipple plates on standoff struts ahead of the sphere
const SHIELD_PLATES = [5.5, 6.4, 7.3];
const SHIELD_TOP = 35;
const SHIELD_BOT = 61;
// the shadow cone the shield casts down the spine (drawn inline below);
// every crew berth lives inside it, the cargo ring deliberately straddles it
const CONE_AFT_X = 186;

// cargo ring — 4 rows × 11 cells racked around the forward spine
const RACK_X0 = 33;
const RACK_Y: Record<RackRowId, number> = { D2: 37.0, D1: 40.2, V1: 53.4, V2: 56.6 };
const RACK_X1 = RACK_X0 + (RACK.cellsPerRow - 1) * RACK.pitch + RACK.cellW; // 84.2

// baseline stores — dim stamps on a few never-owned cells, mid-rack so the
// rack-frame diagonals never cross them
const BASELINE_STAMPS: Record<string, string> = {
  "D2-02": "RAT",
  "D2-05": "O2",
  "D2-08": "H2O",
  "V2-03": "TOOL",
  "V2-06": "CH4",
  "V2-09": "LAB",
};

// cold-sleep bays
const BAY_W = 5.4;
const BAY_R = 2.5; // capsules nest around the spine; ±0.4 stagger keeps them clear of dock art
const BUS_A_Y = 45.1; // primary bus, above the spine
const BUS_B_Y = 50.9; // redundant bus (cold-sleep reserve battery), below it
const BAY_X0 = BAYS[0].sta + NOSE - BAY_R; // 88.0
const BAY_X1 = BAYS[BAYS.length - 1].sta + NOSE + BAY_R; // 163.25

// strongback docks — silhouette footprints (local frame: +x aft, +y outward)
const DOCK_ART: Record<string, { w: number; h: number }> = {
  vlbi: { w: 10.2, h: 7.2 },
  residential: { w: 25, h: 10.5 },
  sps: { w: 28, h: 8 },
  reactor: { w: 13.6, h: 6 },
  seed: { w: 21.8, h: 11.2 },
  industrial: { w: 20.4, h: 12.4 },
  science: { w: 13, h: 8.2 },
};

/** Station-data label for an equipment item's stowage address. */
export function stowLabel(id: string): string {
  const s = STOWAGE[id];
  if (!s) return "";
  if (s.kind === "bays") return `ALL ${BAY_COUNT} BAYS`;
  if (s.kind === "dock")
    return `STA ${String(
      Math.round(s.sta + (DOCK_ART[id]?.w ?? 0) / 2)
    ).padStart(3, "0")} ${s.side}`;
  const first = s.cells[0];
  return s.cells.length > 1
    ? `RACK ${first}–${s.cells[s.cells.length - 1].slice(3)}`
    : `RACK ${first}`;
}

// ── module silhouettes — schematic, drawn in a local frame where ─────────────
// (0,0) is the attach corner, +x runs fore→aft, +y runs OUT from the hull.
// Rendered inside a scaled group, so: no text in here. Only strongback
// modules get silhouettes; containerized cargo rides the rack as cells.

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
    default:
      return null;
  }
}

// ── the drawing ───────────────────────────────────────────────────────────────

/** What the player just touched on the drawing. */
export type StationClick =
  | { kind: "dock"; id: string } // strongback dock — payload module position
  | { kind: "cell"; id: string } // occupied rack cell / bus-B fit (equipment id)
  | { kind: "rackEmpty" } // empty cargo-ring cell — open the rack picker
  | { kind: "bay"; index: number } // cold-sleep bay 0–11 → its cohort
  | { kind: "watch" }; // command sphere → the watch

export interface ShipBlueprintHandle {
  /** Tween the camera to a named preset. */
  focusView(v: BlueprintView): void;
  /** Tween the camera in close on an equipment item's stowage position. */
  focusStation(id: string): void;
}

interface ShipBlueprintProps {
  equipment: string[];
  onStationClick: (s: StationClick) => void;
  hoverId: string | null;
  onHover: (id: string | null) => void;
}

/** viewBox centered close on an item's stowage position. */
function stationVB(id: string): VB {
  const s = STOWAGE[id];
  if (!s) return VIEW_BOX.full;
  if (s.kind === "bays") return VIEW_BOX.bays;
  const W = 90;
  const H = (W * 88) / 250;
  if (s.kind === "dock") {
    const art = DOCK_ART[id] ?? { w: 10, h: 8 };
    const cx = s.sta + NOSE + art.w / 2;
    const cy = s.side === "D" ? SPINE_TOP - art.h / 2 : SPINE_BOT + art.h / 2;
    return clampVB([cx - W / 2, cy - H / 2, W, H]);
  }
  // rack cells — frame the whole run at reading distance
  const first = s.cells[0];
  const row = first.slice(0, 2) as RackRowId;
  const x0 = RACK_X0 + (Number(first.slice(3)) - 1) * RACK.pitch;
  const cx = x0 + (s.cells.length * RACK.pitch) / 2;
  const cy = RACK_Y[row] + RACK.cellH / 2;
  const w = Math.max(44, s.cells.length * RACK.pitch + 26);
  return clampVB([cx - w / 2, cy - H / 2, w, (w * 88) / 250]);
}

export const ShipBlueprint = forwardRef<ShipBlueprintHandle, ShipBlueprintProps>(
  function ShipBlueprint(
    { equipment, onStationClick, hoverId, onHover },
    ref
  ) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const { cur, set, tweenTo, zoomed } = useBlueprintCamera(svgRef);
  // last camera preset touched — buttons read active only while the camera
  // still sits on their framing; free pan/zoom marks the camera custom
  const [view, setView] = useState<BlueprintView>("full");
  const [custom, setCustom] = useState(false);
  const [hoverBay, setHoverBay] = useState<number | null>(null);

  // free pan / zoom — pointer drag with a click-vs-drag threshold, wheel zoom
  // anchored at the cursor (native listener: React's onWheel is passive)
  const drag = useRef<{
    x: number;
    y: number;
    vb: VB;
    moved: boolean;
    id: number;
    el: SVGSVGElement;
  } | null>(null);
  const suppressClick = useRef(false);

  const userAt = (e: { clientX: number; clientY: number }) => {
    const el = svgRef.current;
    const vb = cur.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const scale = Math.min(rect.width / vb[2], rect.height / vb[3]); // meet
    const ox = (rect.width - vb[2] * scale) / 2;
    const oy = (rect.height - vb[3] * scale) / 2;
    return {
      x: vb[0] + (e.clientX - rect.left - ox) / scale,
      y: vb[1] + (e.clientY - rect.top - oy) / scale,
    };
  };

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const u = userAt(e);
      if (!u) return;
      const vb = cur.current;
      const f = Math.exp(e.deltaY * 0.0011);
      const w = Math.min(CAM_W_MAX, Math.max(CAM_W_MIN, vb[2] * f));
      const k = w / vb[2];
      setCustom(true);
      set(clampVB([u.x - (u.x - vb[0]) * k, u.y - (u.y - vb[1]) * k, w, (w * 88) / 250]));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [set]);

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    suppressClick.current = false;
    // no pointer capture yet — capture would retarget the click to the svg
    // root and the stations would never see it; capture once it's a drag
    drag.current = {
      x: e.clientX,
      y: e.clientY,
      vb: cur.current,
      moved: false,
      id: e.pointerId,
      el: e.currentTarget,
    };
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved) {
      if (Math.hypot(dx, dy) < 4) return;
      d.moved = true;
      d.el.setPointerCapture(d.id); // now it's a drag — take the pointer
    }
    const el = svgRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const scale = Math.min(rect.width / d.vb[2], rect.height / d.vb[3]);
    setCustom(true);
    set(clampVB([d.vb[0] - dx / scale, d.vb[1] - dy / scale, d.vb[2], d.vb[3]]));
  };
  const endDrag = () => {
    if (drag.current?.moved) suppressClick.current = true;
    drag.current = null;
  };
  /** true if this click should be swallowed (it ended a drag) */
  const clickSuppressed = () => {
    const s = suppressClick.current;
    suppressClick.current = false;
    return s;
  };
  const station = (s: StationClick) => {
    if (clickSuppressed()) return;
    onStationClick(s);
  };

  useImperativeHandle(
    ref,
    () => ({
      focusView(v) {
        setCustom(false);
        setView(v);
        tweenTo(VIEW_BOX[v]);
      },
      focusStation(id) {
        setCustom(true);
        tweenTo(stationVB(id));
      },
    }),
    [tweenTo]
  );

  const selected = new Set(equipment);
  const mass = equipment.reduce(
    (a, id) => a + (EQUIPMENT_BY_ID.get(id)?.massT ?? 0),
    0
  );
  const massTick = useTickNumber(mass, 700);
  const hoverItem = hoverId ? EQUIPMENT_BY_ID.get(hoverId) : null;
  const hasColdsleep = selected.has("coldsleep");

  // spine truss diagonals
  const truss = Array.from({ length: Math.floor((SPINE_X1 - SPINE_X0) / 4) }, (_, i) => {
    const x = SPINE_X0 + i * 4;
    return (
      <g key={x}>
        <path className="bp-ink-faint" d={`M${x},${SPINE_TOP} l4,${SPINE_BOT - SPINE_TOP}`} />
        <path className="bp-ink-faint" d={`M${x},${SPINE_BOT} l4,${SPINE_TOP - SPINE_BOT}`} />
      </g>
    );
  });

  // status line — bay hover wins, then equipment hover, then the default
  const bay = hoverBay !== null ? BAYS[hoverBay] : null;
  let statusLeft: React.ReactNode;
  let statusRight: React.ReactNode = null;
  if (bay) {
    statusLeft = (
      <span className="text-ink">
        BAY {bay.id} · STA {Math.round(bay.sta)} · {bay.clock}
      </span>
    );
    statusRight = (
      <span>
        COHORT {String(bay.cohort).padStart(2, "0")} ·{" "}
        <span className="text-phos">{BERTHS_PER_BAY} SOULS</span> · TORPOR{" "}
        {bay.loopK.toFixed(1)} K · BUS {bay.bus}
      </span>
    );
  } else if (hoverItem) {
    statusLeft = (
      <span className="text-ink">
        {stowLabel(hoverItem.id)} · {hoverItem.name}
      </span>
    );
    statusRight = (
      <span>
        <span className="text-phos">{hoverItem.massT} T</span>
        {hoverItem.required ? " · MANDATORY" : ""} · REL {hoverItem.reliability}% ·{" "}
        {hoverItem.powerKw > 0
          ? `DRAW ${hoverItem.powerKw} kW`
          : `SUPPLY ${Math.abs(hoverItem.powerKw) / 1000} MW`}
      </span>
    );
  } else {
    statusLeft = (
      <span>
        44-CELL CARGO RING · {BAY_COUNT} COLD-SLEEP BAYS · 7 STRONGBACK DOCKS —
        HOVER FOR STATION DATA
      </span>
    );
  }

  return (
    <figure className="m-0 flex min-h-0 flex-1 flex-col">
      {/* status line + camera control */}
      <figcaption className="hal-mono mb-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-b border-ink/10 px-1 pb-1.5 text-[10px] tracking-widest text-neutral-500">
        <span className="min-w-0 flex-1 truncate">{statusLeft}{statusRight && <> · {statusRight}</>}</span>
        <span
          className="flex shrink-0 items-center gap-1"
          role="group"
          aria-label="Blueprint camera"
        >
          {BLUEPRINT_VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => {
                setCustom(false);
                setView(v.id);
                tweenTo(VIEW_BOX[v.id]);
              }}
              aria-pressed={!custom && view === v.id}
              className={cn(
                "border px-1.5 py-0.5 text-[9px] tracking-[0.18em] transition-colors",
                !custom && view === v.id
                  ? "border-phos/60 text-phos"
                  : "border-ink/15 text-neutral-500 hover:border-ink/40 hover:text-ink"
              )}
            >
              {v.label}
            </button>
          ))}
        </span>
      </figcaption>

      <div className="relative min-h-0 flex-1">
        <svg
          ref={svgRef}
          viewBox="0 12 250 88"
          className="h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
          role="img"
          aria-label={`General arrangement drawing of the seed ship Exodus, ${OVERALL_M} metres overall: Whipple debris shield forward, magsail drum, cargo ring, twelve distributed cold-sleep bays inside the debris shadow, deployable droplet-curtain radiators, aft fuel tanks and fusion drive, with docked payload modules`}
          preserveAspectRatio="xMidYMid meet"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {/* ── debris shadow cone (under everything) ── */}
          <g opacity={0.4}>
            <path
              className="bp-ink-faint"
              d={`M5.5,${SHIELD_TOP} L${CONE_AFT_X},${SHIELD_TOP + 7.6} M5.5,${SHIELD_BOT} L${CONE_AFT_X},${SHIELD_BOT - 7.6}`}
              strokeDasharray="1.2 0.9"
            />
          </g>

          {/* ── spine truss ── */}
          <g>
            <path className="bp-ink-dim" d={`M${SPINE_X0},${SPINE_TOP} h${SPINE_X1 - SPINE_X0}`} />
            <path className="bp-ink-dim" d={`M${SPINE_X0},${SPINE_BOT} h${SPINE_X1 - SPINE_X0}`} />
            {truss}
          </g>

          {/* ── Whipple debris shield ── */}
          <g>
            {SHIELD_PLATES.map((x) => (
              <rect key={x} className="bp-hull" x={x - 0.25} y={SHIELD_TOP} width={0.5} height={SHIELD_BOT - SHIELD_TOP} />
            ))}
            {/* plate cross-ties */}
            <path className="bp-ink-faint" d={`M5.25,40 h2.3 M5.25,56 h2.3`} />
            {/* standoff struts back to the command sphere */}
            <path className="bp-ink-dim" d="M7.55,38.5 L10.8,42.9 M7.55,48 H8.2 M7.55,57.5 L10.8,53.1" />
          </g>

          {/* ── command sphere ── */}
          <g
            style={{ cursor: "pointer" }}
            onClick={() => station({ kind: "watch" })}
          >
            <title>COMMAND SPHERE · 3 WATCH BERTHS — CLICK TO OPEN THE WATCH</title>
            <circle className="bp-hull" cx={14} cy={CL} r={6} />
            <g className="bp-detail">
              <rect className="bp-ink-dim" x={10} y={46.4} width={8} height={1.1} rx={0.55} />
              <rect className="bp-ink-dim" x={6.2} y={46.8} width={1.4} height={2.4} rx={0.3} />
              <path className="bp-ink-faint" d="M7.6,44.5 h-1.2 M7.6,51.5 h-1.2" />
              {/* high-gain dish on a boom */}
              <path className="bp-ink-dim" d="M17.5,42.8 L19.4,39.6" />
              <circle className="bp-ink-dim" cx={20} cy={38.6} r={1.3} />
              <circle className="bp-phos" cx={20} cy={38.6} r={0.22} />
              {/* three command watch berths */}
              <circle cx={12.4} cy={44.7} r={0.42} fill="rgba(123,235,166,0.85)" />
              <circle cx={14} cy={44.4} r={0.42} fill="rgba(123,235,166,0.85)" />
              <circle cx={15.6} cy={44.7} r={0.42} fill="rgba(123,235,166,0.85)" />
            </g>
          </g>

          {/* ── VLBI probe launch cradle (mast under the module) ── */}
          <g>
            <path className="bp-ink-faint" d="M24.5,45.8 V39" />
            <path className="bp-ink-faint" d="M27.5,45.8 L24.5,40.6 M30.5,45.8 L24.5,43.4" />
          </g>

          {/* ── cargo ring — frames + cells ── */}
          <g>
            {/* rails + frames */}
            <path className="bp-ink-faint" d={`M${RACK_X0 - 0.2},36.7 H${RACK_X1 + 0.4} M${RACK_X0 - 0.2},59.3 H${RACK_X1 + 0.4}`} />
            {[RACK_X0 - 0.2, 58.8, RACK_X1 + 0.4].map((x) => (
              <path key={x} className="bp-ink-faint" d={`M${x},36.7 V59.3`} />
            ))}
            <path className="bp-ink-faint" d="M32.8,36.7 L37,45.8 M32.8,59.3 L37,50.2 M58.8,36.7 L63.5,45.8 M58.8,59.3 L63.5,50.2 M84.6,36.7 L80.5,45.8 M84.6,59.3 L80.5,50.2" />
            {/* cells */}
            {RACK.rows.map((row) =>
              Array.from({ length: RACK.cellsPerRow }, (_, i) => {
                const addr = `${row}-${String(i + 1).padStart(2, "0")}`;
                const x = RACK_X0 + i * RACK.pitch;
                const y = RACK_Y[row];
                const owner = CELL_OWNER.get(addr);
                if (!owner || !selected.has(owner)) {
                  return (
                    <rect
                      key={addr}
                      className="bp-cell"
                      x={x}
                      y={y}
                      width={RACK.cellW}
                      height={RACK.cellH}
                      style={{ cursor: "pointer", pointerEvents: "all" }}
                      onClick={() => station({ kind: "rackEmpty" })}
                    >
                      <title>{`RACK ${addr} — EMPTY · CLICK TO STOW CARGO`}</title>
                    </rect>
                  );
                }
                const item = EQUIPMENT_BY_ID.get(owner);
                const first = STOWAGE[owner]?.kind === "rack" && STOWAGE[owner].cells[0] === addr;
                return (
                  <g
                    key={addr}
                    className={cn(hoverId === owner && "bp-hover")}
                    style={{ cursor: "pointer" }}
                    onClick={() => station({ kind: "cell", id: owner })}
                    onMouseEnter={() => onHover(owner)}
                    onMouseLeave={() => onHover(null)}
                  >
                    <title>{item ? `${item.name} — ${item.massT} T` : owner}</title>
                    <rect
                      className="dock-flash"
                      x={x - 0.3}
                      y={y - 0.3}
                      width={RACK.cellW + 0.6}
                      height={RACK.cellH + 0.6}
                      fill="rgba(123,235,166,0.35)"
                      stroke="none"
                    />
                    <rect
                      pathLength={1}
                      className="bp-phos bp-draw"
                      x={x}
                      y={y}
                      width={RACK.cellW}
                      height={RACK.cellH}
                      style={{ fill: "rgba(123,235,166,0.05)" }}
                    />
                    {/* mass on the first cell of the run (zoom-level text) */}
                    {first && item && (
                      <text className="bp-stamp-dim" x={x + 0.35} y={y + 0.95}>
                        {item.massT}T
                      </text>
                    )}
                  </g>
                );
              })
            )}
          </g>

          {/* ── cold-sleep bays — one cohort per bay ── */}
          <g>
            {BAYS.map((b, i) => {
              const cx = b.sta + NOSE;
              const cy = CL + b.offset;
              return (
                <g
                  key={b.id}
                  className={cn(hoverBay === i && "bp-hover")}
                  style={{ cursor: "pointer" }}
                  onClick={() => station({ kind: "bay", index: i })}
                  onMouseEnter={() => setHoverBay(i)}
                  onMouseLeave={() => setHoverBay(null)}
                >
                  <title>{`BAY ${b.id} · COHORT ${String(b.cohort).padStart(2, "0")} · ${BERTHS_PER_BAY} souls · BUS ${b.bus}`}</title>
                  <rect className="bp-hull" x={cx - BAY_R} y={cy - BAY_R} width={BAY_W} height={BAY_R * 2} rx={BAY_R} />
                  {/* scan sweep — one bay at a time, cycling down the chain */}
                  <rect x={cx - 2.45} y={cy - 2.0} width={1.3} height={4.0} fill="rgba(123,235,166,0.09)">
                    <animateTransform
                      attributeName="transform"
                      type="translate"
                      from="0 0"
                      to={`${BAY_W - 2.6} 0`}
                      dur="8s"
                      begin={`${((i * 8) / BAY_COUNT).toFixed(2)}s`}
                      repeatCount="indefinite"
                    />
                  </rect>
                  {/* 17 berths, countable: 9 above, 8 below */}
                  {Array.from({ length: 9 }, (_, j) => (
                    <circle key={`t${j}`} cx={cx - 2 + j * 0.5} cy={cy - 0.55} r={0.3} fill="rgba(123,235,166,0.8)" />
                  ))}
                  {Array.from({ length: 8 }, (_, j) => (
                    <circle key={`b${j}`} cx={cx - 1.75 + j * 0.5} cy={cy + 0.55} r={0.3} fill="rgba(123,235,166,0.8)" />
                  ))}
                  <text
                    className="bp-txt-dim"
                    x={cx}
                    y={cy - 1.4}
                    textAnchor="middle"
                    style={{ fontSize: "1.05px" }}
                  >
                    {b.id}
                  </text>
                </g>
              );
            })}
            {/* primary bus A — above the spine, stub into every bay */}
            <path className="bp-ink-faint" d={`M${BAY_X0},${BUS_A_Y} H${BAY_X1}`} />
            {BAYS.map((b) => {
              const cx = b.sta + NOSE;
              const cy = CL + b.offset;
              return (
                <path key={`sa${b.id}`} className="bp-ink-faint" d={`M${cx},${BUS_A_Y} V${cy - BAY_R}`} />
              );
            })}
            {/* redundant bus B + per-bay packs — the cold-sleep reserve battery */}
            {hasColdsleep && (
              <g
                className={cn(hoverId === "coldsleep" && "bp-hover")}
                style={{ cursor: "pointer" }}
                onClick={() => station({ kind: "cell", id: "coldsleep" })}
                onMouseEnter={() => onHover("coldsleep")}
                onMouseLeave={() => onHover(null)}
              >
                <title>COLD-SLEEP RESERVE BATTERY — fitted to all twelve bays</title>
                <path className="bp-phos" d={`M${BAY_X0},${BUS_B_Y} H${BAY_X1}`} opacity={0.55} />
                {BAYS.map((b) => {
                  const cx = b.sta + NOSE;
                  const cy = CL + b.offset;
                  return (
                    <g key={`pk${b.id}`}>
                      <path className="bp-phos" d={`M${cx},${BUS_B_Y} V${cy + BAY_R}`} opacity={0.55} />
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
              </g>
            )}
          </g>

          {/* ── deployable radiators — droplet curtains, shown broken ── */}
          {/* 1,900 m × 4,500 m wetted curtains; 34 km² at 1,450 K rejects the
              torch's ~1% waste heat. True length won't fit on the drawing —
              standard drafting break, honestly labelled. */}
          <g>
            <path className="bp-ink-faint" d="M165.5,45.8 h2 M165.5,50.2 h2" />
            {/* ventral curtains draw shorter — full reach would crowd the aft
                drop-stages on the sheet; the break says true length anyway */}
            {[
              { y: SPINE_TOP, a: -30, len: 19 },
              { y: SPINE_TOP, a: -50, len: 19 },
              { y: SPINE_BOT, a: 30, len: 15.6 },
              { y: SPINE_BOT, a: 50, len: 15.6 },
            ].map(({ y, a, len }) => (
              <g key={`${y}-${a}`} transform={`translate(168,${y}) rotate(${a})`}>
                <circle className="bp-ink-dim" cx={0} cy={0} r={0.65} />
                <rect
                  pathLength={1}
                  className="bp-ink bp-draw"
                  x={1.4}
                  y={-2.6}
                  width={len - 2.6}
                  height={5.2}
                  style={{ fill: "rgba(214,162,106,0.06)" }}
                />
                {Array.from({ length: 6 }, (_, k) => 2.8 + k * ((len - 4.2) / 5)).map((x) => (
                  <path key={x} className="bp-ink-faint" d={`M${x},-2.6 v5.2`} />
                ))}
                {/* break marks — the curtain continues off-drawing */}
                <path
                  className="bp-ink-dim"
                  d={`M${len - 0.8},-2.6 l1.2,5.2 M${len + 1.2},-2.6 l1.2,5.2`}
                />
                <circle cx={len} cy={0} r={0.35} fill="rgba(251,191,36,0.85)" />
              </g>
            ))}
          </g>

          {/* ── aft fuel — tank truss, D-He³ spheres, departure drop-stages ── */}
          <g>
            {/* thrust shaft + tank truss */}
            <path className="bp-ink-faint" d="M186,48 H212" />
            <path className="bp-ink-faint" d="M186,39.5 H212 M186,56.5 H212" />
            {[186, 199, 212].map((x) => (
              <path key={x} className="bp-ink-faint" d={`M${x},39.5 V56.5`} />
            ))}
            <path className="bp-ink-faint" d="M186,39.5 L199,56.5 M199,39.5 L212,56.5 M199,56.5 L212,39.5" />
            {/* copper cruise-stock spheres, 2 × 3 */}
            {[191.5, 200.5, 209.5].map((x, i) => (
              <g key={`sp${x}`}>
                <circle pathLength={1} className="bp-copper bp-draw" cx={x} cy={41.8} r={3.2} />
                <circle pathLength={1} className="bp-copper bp-draw" cx={x} cy={54.2} r={3.2} />
                <g className="bp-detail">
                  <path className="bp-copper-dim" d={`M${x - 1.4},41.8 h2.8 M${x},40.4 v2.8 M${x - 1.4},54.2 h2.8 M${x},52.8 v2.8`} opacity={0.6} />
                </g>
                {/* plumbing to the drive core */}
                <path className="bp-copper-dim" d={`M${x},45 L213.6,47.3 M${x},51 L213.6,48.7`} />
              </g>
            ))}
            {/* departure drop-stages — jettisoned at the Jovian assist */}
            <rect className="bp-copper" x={188} y={33.6} width={24} height={4} rx={2} />
            <rect className="bp-copper" x={188} y={58.4} width={24} height={4} rx={2} />
            <path className="bp-copper-dim" d="M194,33.6 v4 M206,33.6 v4 M194,58.4 v4 M206,58.4 v4" />
            <path className="bp-copper-dim" d="M198,33.3 v4.6 M198,58.1 v4.6" strokeDasharray="0.7 0.5" />
          </g>

          {/* ── neutron shadow shield + fusion drive ── */}
          <g>
            <ellipse className="bp-hull" cx={213.2} cy={CL} rx={1.1} ry={3.2} />
            <path className="bp-ink-faint" d="M212.5,46 L214,50 M212.5,50 L214,46" />
            <path className="bp-hull" d="M212.4,45.4 L214.8,44.2 L214.8,51.8 L212.4,50.6 Z" />
            <rect className="bp-hull" x={214.8} y={43.6} width={5} height={8.8} rx={0.8} />
            <g className="bp-detail">
              <path className="bp-ink-faint" d="M215.8,45.8 h3 M215.8,48 h3 M215.8,50.2 h3" />
            </g>
            <path className="bp-ink-dim" d="M219.8,44.9 h6.4 l2.1,2.6 h-10.6 Z" />
            <path className="bp-ink" d="M219.8,46.9 h8 l2.2,3 h-12.4 Z" />
            <path className="bp-ink-dim" d="M219.8,52.2 h6.4 l2.1,-2.6 h-10.6 Z" />
            <circle className="bp-phos" cx={217.3} cy={48} r={0.35} />
          </g>

          {/* ── magsail drum — 1,900 km of superconducting cable, stowed ── */}
          <g>
            <rect
              pathLength={1}
              className="bp-ink bp-draw"
              x={22}
              y={46.4}
              width={9}
              height={3.2}
              rx={1.4}
              style={{ fill: "rgba(123,235,166,0.04)" }}
            />
            <g className="bp-detail">
              <path className="bp-ink-faint" d="M23.5,46.4 v3.2 M26.5,46.4 v3.2 M29.5,46.4 v3.2" />
            </g>
            <circle className="bp-phos" cx={31.6} cy={48} r={0.3} />
          </g>

          {/* ── station ruler — diamonds for docks, circles for bays ── */}
          <g>
            <path className="bp-ink-faint" d="M20,22 h166" />
            {Array.from({ length: 9 }, (_, i) => 25 + i * 20).map((x) => (
              <path key={x} className="bp-ink-faint" d={`M${x},21.4 v1.2`} />
            ))}
            {[25, 65, 105, 145].map((x, i) => (
              <text key={x} className="bp-txt-dim" x={x} y={20.3} textAnchor="middle">
                {i === 0 ? `STA ${String(x - NOSE).padStart(3, "0")}` : String(x - NOSE).padStart(3, "0")}
              </text>
            ))}
            {Object.entries(STOWAGE).map(([id, s]) => {
              if (s.kind !== "dock") return null;
              const art = DOCK_ART[id];
              if (!art) return null;
              const cx = s.sta + NOSE + art.w / 2;
              const y = s.side === "D" ? 21.2 : 22.8;
              const on = selected.has(id);
              return (
                <path
                  key={`hp-${id}`}
                  d={`M${cx - 1},${y + 0.5} L${cx},${y} L${cx + 1},${y + 0.5} L${cx},${y + 1} Z`}
                  className={on ? "bp-phos" : "bp-ink-faint"}
                  fill={on ? "rgba(123,235,166,0.6)" : "none"}
                />
              );
            })}
            {BAYS.map((b) => (
              <circle key={`by-${b.id}`} className="bp-ink-faint" cx={b.sta + NOSE} cy={22} r={0.5} fill="none" />
            ))}
          </g>

          {/* ── payload modules at their strongback docks ── */}
          {Object.entries(STOWAGE).map(([id, s]) => {
            if (s.kind !== "dock") return null;
            const item = EQUIPMENT_BY_ID.get(id);
            const art = DOCK_ART[id] ?? { w: 10, h: 8 };
            const dir = s.side === "D" ? -1 : 1;
            const base = s.side === "D" ? SPINE_TOP : SPINE_BOT;
            if (!selected.has(id)) {
              // empty strongback station — dashed footprint, waiting for its module
              return (
                <g
                  key={id}
                  transform={`translate(${s.sta + NOSE},${base}) scale(1,${dir})`}
                  style={{ cursor: "pointer" }}
                  onClick={() => station({ kind: "dock", id })}
                  onMouseEnter={() => onHover(id)}
                  onMouseLeave={() => onHover(null)}
                >
                  <title>{`${item ? item.name : id} — EMPTY DOCK · CLICK TO STOW`}</title>
                  <rect
                    className="bp-ink-dim"
                    x={0.5}
                    y={0.5}
                    width={art.w}
                    height={art.h}
                    strokeDasharray="0.9 0.7"
                    style={{ pointerEvents: "all" }}
                  />
                  <path
                    className="bp-ink-faint"
                    d={`M1.5,0.5 v-0.9 M${art.w - 1.5},0.5 v-0.9`}
                  />
                </g>
              );
            }
            return (
              <g
                key={id}
                transform={`translate(${s.sta + NOSE},${base}) scale(1,${dir})`}
                className={cn(hoverId === id && "bp-hover")}
                style={{ cursor: "pointer" }}
                onClick={() => station({ kind: "dock", id })}
                onMouseEnter={() => onHover(id)}
                onMouseLeave={() => onHover(null)}
              >
                <title>{item ? `${item.name} — ${item.massT} T` : id}</title>
                <rect
                  className="dock-flash"
                  x={-0.5}
                  y={-0.5}
                  width={art.w + 1}
                  height={art.h + 1}
                  fill="rgba(123,235,166,0.35)"
                  stroke="none"
                />
                <ModuleArt id={id} />
              </g>
            );
          })}

          {/* ── annotations: leaders + callouts ── */}
          <g>
            {/* debris shield */}
            <path className="bp-ink-faint" d="M5.6,34.8 L4.5,29.4" />
            <text className="bp-txt" x={3} y={28.4}>
              WHIPPLE SHIELD · 26 M
            </text>
            {/* command module */}
            <path className="bp-ink-faint" d="M14,41.9 V33.4" />
            <text className="bp-txt" x={20} y={32.4} textAnchor="middle">
              COMMAND · 3 WATCH BERTHS
            </text>
            {/* debris shadow cone */}
            <path className="bp-ink-faint" d="M56,37.1 L55.2,35.4" />
            <text className="bp-txt-dim" x={56} y={34.4} textAnchor="middle">
              DEBRIS SHADOW CONE
            </text>
            {/* cargo ring */}
            <path className="bp-ink-faint" d="M49,59.6 V60.9" />
            <text className="bp-txt" x={49} y={62.2} textAnchor="middle">
              CARGO RING · SACRIFICIAL MASS
            </text>
            {/* cold-sleep bays — leader rises through the dock gap */}
            <path className="bp-ink-faint" d="M117,45.7 V33.2" />
            <text className="bp-txt" x={109} y={31.5}>
              COLD-SLEEP BAYS — 1 COHORT (17) PER BAY
            </text>
            {/* radiators */}
            <path className="bp-ink-faint" d="M176,25.6 L180,29.4" />
            <text className="bp-txt" x={150} y={24}>
              THERMAL REJECTION — 34 KM² (SHOWN BROKEN)
            </text>
            {/* fuel */}
            <path className="bp-ink-faint" d="M200,62.4 V65.9" />
            <text className="bp-txt" x={200} y={67.8} textAnchor="middle">
              PROPELLANT 96,000 T · D-He³ + STAGES
            </text>
            {/* drive */}
            <path className="bp-ink-faint" d="M221,55.5 L218.5,70.8" />
            <text className="bp-txt" x={219.5} y={72.6} textAnchor="end">
              FUSION DRIVE · 0.1 C
            </text>
            {/* orientation — margin notes flanking the centerline, aft right */}
            <text className="bp-txt-dim" x={235} y={44.9}>
              +Z · DORSAL
            </text>
            <text className="bp-txt-dim" x={235} y={50.4}>
              −Z · VENTRAL
            </text>
            {/* fore/aft under the overall dimension */}
            <text className="bp-txt-dim" x={5} y={79.4}>
              FWD
            </text>
            <text className="bp-txt-dim" x={226} y={79.4} textAnchor="end">
              AFT
            </text>
          </g>

          {/* ── zoom-level detail (fades in when the camera is in close) ── */}
          {/* pure annotation — never intercepts station clicks */}
          <g
            className="bp-lod"
            style={{ opacity: zoomed ? 1 : 0, pointerEvents: "none" }}
            aria-hidden="true"
          >
            {/* rack stamps — occupied cells carry their cargo code + mass */}
            {RACK.rows.map((row) =>
              Array.from({ length: RACK.cellsPerRow }, (_, i) => {
                const addr = `${row}-${String(i + 1).padStart(2, "0")}`;
                const x = RACK_X0 + i * RACK.pitch;
                const y = RACK_Y[row];
                const owner = CELL_OWNER.get(addr);
                if (owner && selected.has(owner)) {
                  const s = STOWAGE[owner];
                  if (s?.kind === "rack") {
                    return (
                      <text key={addr} className="bp-stamp" x={x + 0.35} y={y + 1.75}>
                        {s.stamp}
                      </text>
                    );
                  }
                }
                const base = BASELINE_STAMPS[addr];
                if (base) {
                  return (
                    <text key={addr} className="bp-stamp-dim" x={x + 0.35} y={y + 1.75}>
                      {base}
                    </text>
                  );
                }
                return null;
              })
            )}
            <text className="bp-stamp-dim" x={34} y={35.4}>
              44 CELLS · 4 ROWS
            </text>
            {/* per-bay telemetry */}
            {BAYS.map((b) => (
              <text
                key={`tm${b.id}`}
                className="bp-stamp-dim"
                x={b.sta + NOSE}
                y={CL + b.offset + 2.0}
                textAnchor="middle"
              >
                {BERTHS_PER_BAY} · {b.bus}
              </text>
            ))}
            <text className="bp-stamp-dim" x={163.6} y={44.5}>
              BUS A
            </text>
            <text className="bp-stamp-dim" x={163.6} y={51.6}>
              BUS B
            </text>
            {/* probe cradle */}
            <text className="bp-stamp-dim" x={27} y={37.7} textAnchor="middle">
              PROBE CRADLE
            </text>
            {/* shield stack */}
            <path className="bp-ink-faint" d="M6.2,61.3 L6.6,62.2" />
            <text className="bp-stamp-dim" x={6.5} y={62.9}>
              WHIPPLE STACK ×3
            </text>
            {/* radiator temperature */}
            <text className="bp-stamp-dim" x={176.5} y={38.4}>
              ×4 · 1,450 K · DROPLET
            </text>
            {/* magsail drum — label hangs below, clear of the VLBI dock above */}
            <path className="bp-ink-faint" d="M26.5,49.6 V51.2" />
            <text className="bp-stamp-dim" x={26.5} y={52.4} textAnchor="middle">
              MAGSAIL — 1,900 KM LOOP
            </text>
            {/* fuel labels */}
            <text className="bp-stamp-dim" x={200} y={32.4} textAnchor="end">
              STAGES · JETTISON +2.7 YR
            </text>
            <text className="bp-stamp-dim" x={191.5} y={42.1} textAnchor="middle">
              D
            </text>
            <text className="bp-stamp-dim" x={200.5} y={42.1} textAnchor="middle">
              HE3
            </text>
            <text className="bp-stamp-dim" x={209.5} y={42.1} textAnchor="middle">
              D
            </text>
            <text className="bp-stamp-dim" x={200.5} y={54.9} textAnchor="middle">
              HE3
            </text>
          </g>

          {/* ── overall length dimension ── */}
          <g>
            <path className="bp-ink-faint" d={`M${NOSE},56 v21.5 M${TAIL},52.5 v21.5`} />
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
              DWG OE-104-GA · REV F · SCHEMATIC
            </text>
            <text className="bp-txt-dim" x={80.5} y={83.6}>
              MASS
            </text>
            <text className="bp-txt-phos" x={80.5} y={89.6}>
              {massTick.toLocaleString()} / 1,760 T
            </text>
            <text className="bp-txt-dim" x={80.5} y={94.8}>
              CREW 207 · {BAY_COUNT} BAYS × {BERTHS_PER_BAY}
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
});
