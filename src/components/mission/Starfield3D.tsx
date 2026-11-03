"use client";

import { useEffect, useRef } from "react";
import type { StarSystem } from "@/lib/mission/types";
import { SOL, STARS, starPosition } from "@/lib/mission/stars";
import { mulberry32, hashString } from "@/lib/mission/engine";

// ─── 3-D local neighborhood: 16 candidate systems + Sol, drag to rotate ─────
// Equatorial-rectangular coordinates, parsecs, Sol at origin. Auto-rotates;
// drag to steer; click a star to select it as destination.

interface Pt3 {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  color: string;
}

export function Starfield3D({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    yaw: 0.6,
    pitch: -0.42,
    drag: false,
    lastX: 0,
    lastY: 0,
    moved: 0,
    lastInteract: -9999,
    hover: null as string | null,
  });
  const selectedRef = useRef(selectedId);
  useEffect(() => {
    selectedRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const pts: Pt3[] = [
      { id: "sol", name: "SOL", x: 0, y: 0, z: 0, color: SOL.color },
      ...STARS.map((s) => {
        const [x, y, z] = starPosition(s);
        return { id: s.id, name: s.name, x, y, z, color: s.color };
      }),
    ];

    // fixed background star noise (deterministic)
    const bgRand = mulberry32(hashString("bg-stars"));
    const bg: { x: number; y: number; r: number; a: number }[] = [];
    for (let i = 0; i < 170; i++) {
      bg.push({
        x: bgRand(),
        y: bgRand(),
        r: bgRand() * 1.1 + 0.3,
        a: bgRand() * 0.32 + 0.06,
      });
    }

    let raf = 0;
    let width = 0;
    let height = 0;
    let dpr = Math.min(2, window.devicePixelRatio || 1);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const project = (
      p: { x: number; y: number; z: number },
      yaw: number,
      pitch: number,
      scale: number,
      cx: number,
      cy: number
    ) => {
      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);
      const x1 = p.x * cosY - p.z * sinY;
      const z1 = p.x * sinY + p.z * cosY;
      const cosP = Math.cos(pitch);
      const sinP = Math.sin(pitch);
      const y2 = p.y * cosP - z1 * sinP;
      const z2 = p.y * sinP + z1 * cosP;
      const fov = 7.5;
      const persp = fov / (fov + z2);
      return { x: cx + x1 * scale * persp, y: cy - y2 * scale * persp, z: z2 };
    };

    let lastT = performance.now();
    let projected: { id: string; x: number; y: number }[] = [];

    const draw = (t: number) => {
      const dt = Math.min(0.05, (t - lastT) / 1000);
      lastT = t;
      const st = stateRef.current;
      if (!st.drag && (t - st.lastInteract) / 1000 > 3) st.yaw += dt * 0.014;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      const scale = (Math.min(width, height) / 2) * 0.82 / 1.15; // ~3.7 pc radius fits

      // background stars
      for (const s of bg) {
        ctx.globalAlpha = s.a;
        ctx.fillStyle = "#fff";
        ctx.fillRect(s.x * width, s.y * height, s.r, s.r);
      }
      ctx.globalAlpha = 1;

      // reference rings at 4 / 8 / 12 ly in the ecliptic plane
      for (const ly of [4, 8, 12]) {
        const pc = ly / 3.26156;
        ctx.beginPath();
        for (let a = 0; a <= 64; a++) {
          const ang = (a / 64) * Math.PI * 2;
          const q = project(
            { x: Math.cos(ang) * pc, y: 0, z: Math.sin(ang) * pc },
            st.yaw,
            st.pitch,
            scale,
            cx,
            cy
          );
          if (a === 0) ctx.moveTo(q.x, q.y);
          else ctx.lineTo(q.x, q.y);
        }
        ctx.strokeStyle = "rgba(255,255,255,0.09)";
        ctx.lineWidth = 1;
        ctx.stroke();
        // ring label
        const lq = project(
          { x: pc * 0.7071, y: 0, z: pc * 0.7071 },
          st.yaw,
          st.pitch,
          scale,
          cx,
          cy
        );
        ctx.fillStyle = "rgba(255,255,255,0.28)";
        ctx.font = "9px 'IBM Plex Mono', monospace";
        ctx.fillText(`${ly} LY`, lq.x + 4, lq.y - 4);
      }

      // project all stars
      const ptsP = pts.map((p) => ({
        p,
        s: project(p, st.yaw, st.pitch, scale, cx, cy),
      }));
      ptsP.sort((a, b) => b.s.z - a.s.z);
      projected = ptsP.map(({ p, s }) => ({ id: p.id, x: s.x, y: s.y }));

      // selected link line from Sol
      const selP = ptsP.find(({ p }) => p.id === selectedRef.current);
      const solP = ptsP.find(({ p }) => p.id === "sol");
      if (selP && solP && selP.p.id !== "sol") {
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.lineDashOffset = -t / 40;
        ctx.strokeStyle = "rgba(232,230,220,0.5)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(solP.s.x, solP.s.y);
        ctx.lineTo(selP.s.x, selP.s.y);
        ctx.stroke();
        ctx.restore();
        // distance tag at midpoint
        const star = STARS.find((s) => s.id === selP.p.id);
        if (star) {
          const mx = (solP.s.x + selP.s.x) / 2;
          const my = (solP.s.y + selP.s.y) / 2;
          ctx.fillStyle = "rgba(123,235,166,0.95)";
          ctx.font = "10px 'IBM Plex Mono', monospace";
          ctx.fillText(`${star.distanceLy.toFixed(2)} LY`, mx + 6, my - 6);
        }
      }

      for (const { p, s } of ptsP) {
        const isSol = p.id === "sol";
        const isSelected = p.id === selectedRef.current;
        const isHover = p.id === st.hover;
        const base = isSol ? 3.4 : 2.6;

        // glow
        const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, base * 4);
        g.addColorStop(0, p.color + "cc");
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(s.x, s.y, base * 4, 0, Math.PI * 2);
        ctx.fill();

        // point
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, base, 0, Math.PI * 2);
        ctx.fill();
        if (isSol) {
          ctx.strokeStyle = "rgba(255,233,168,0.7)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(s.x, s.y, base + 4, 0, Math.PI * 2);
          ctx.stroke();
        }

        // label
        ctx.font = `${isSelected ? "600 " : ""}10px 'IBM Plex Mono', monospace`;
        ctx.fillStyle = isSelected
          ? "rgba(232,230,220,1)"
          : isHover
            ? "rgba(255,255,255,0.95)"
            : "rgba(255,255,255,0.55)";
        ctx.fillText(p.name, s.x + base + 5, s.y + 3);

        // reticle
        if (isSelected || isHover) {
          const r = 13;
          ctx.save();
          ctx.translate(s.x, s.y);
          ctx.rotate((t / 1000) * (isSelected ? 0.7 : 0.35));
          ctx.strokeStyle = isSelected
            ? "rgba(232,230,220,0.9)"
            : "rgba(255,255,255,0.6)";
          ctx.lineWidth = 1.2;
          for (let q = 0; q < 4; q++) {
            ctx.beginPath();
            ctx.arc(0, 0, r, q * (Math.PI / 2) + 0.18, q * (Math.PI / 2) + Math.PI / 2 - 0.18);
            ctx.stroke();
          }
          ctx.restore();
        }
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    // ── interaction ──
    const findNearest = (mx: number, my: number) => {
      let best: string | null = null;
      let bestD = 16;
      for (const q of projected) {
        if (q.id === "sol") continue;
        const d = Math.hypot(q.x - mx, q.y - my);
        if (d < bestD) {
          bestD = d;
          best = q.id;
        }
      }
      return best;
    };

    const onPointerDown = (e: PointerEvent) => {
      const st = stateRef.current;
      st.drag = true;
      st.moved = 0;
      st.lastX = e.clientX;
      st.lastY = e.clientY;
      st.lastInteract = performance.now();
      canvas.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      const st = stateRef.current;
      const rect = canvas.getBoundingClientRect();
      if (st.drag) {
        const dx = e.clientX - st.lastX;
        const dy = e.clientY - st.lastY;
        st.moved += Math.abs(dx) + Math.abs(dy);
        st.yaw += dx * 0.006;
        st.pitch = Math.max(-1.35, Math.min(1.35, st.pitch + dy * 0.005));
        st.lastX = e.clientX;
        st.lastY = e.clientY;
        st.lastInteract = performance.now();
      } else {
        const h = findNearest(e.clientX - rect.left, e.clientY - rect.top);
        if (h !== st.hover) {
          st.hover = h;
          canvas.style.cursor = h ? "pointer" : "grab";
        }
      }
    };
    const onPointerUp = (e: PointerEvent) => {
      const st = stateRef.current;
      st.drag = false;
      st.lastInteract = performance.now();
      if (st.moved < 6) {
        const rect = canvas.getBoundingClientRect();
        const h = findNearest(e.clientX - rect.left, e.clientY - rect.top);
        if (h) onSelect(h);
      }
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
    };
  }, [onSelect]);

  return (
    <canvas
      ref={canvasRef}
      className="h-full w-full cursor-grab touch-none select-none"
      aria-label="Interactive 3D map of candidate star systems"
    />
  );
}
