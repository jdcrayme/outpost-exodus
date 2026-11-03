"use client";

import { useEffect, useRef } from "react";
import type { Planet, StarSystem } from "@/lib/mission/types";
import { hashString, mulberry32 } from "@/lib/mission/engine";

// ─── System orbital chart — star, orbits, animated planets, HZ band ─────────

export function OrbitMap({
  star,
  planets,
  selectedId,
  onSelect,
  className,
}: {
  star: StarSystem;
  planets: Planet[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const selRef = useRef(selectedId);
  const planetsRef = useRef(planets);
  useEffect(() => {
    selRef.current = selectedId;
    planetsRef.current = planets;
  }, [selectedId, planets]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // deterministic phase per planet + slow orbital motion
    const phases = new Map(
      planets.map((p) => [
        p.id,
        mulberry32(hashString(p.id))() * Math.PI * 2,
      ])
    );

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

    const L = star.luminositySolar;
    const hzIn = Math.sqrt(L / 1.1);
    const hzOut = Math.sqrt(L / 0.53);
    const rMax = Math.max(
      planets.reduce((a, p) => Math.max(a, p.orbitAu), 0) * 1.18,
      hzOut * 1.25
    );

    const mapR = (au: number) => Math.pow(au / rMax, 0.55);

    let projected: { id: string; x: number; y: number }[] = [];

    const draw = (t: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const cx = width / 2;
      const cy = height / 2;
      const R = Math.min(width, height) / 2 - 26;
      const flatten = 0.42;

      // habitable zone band
      const rIn = mapR(hzIn) * R;
      const rOut = mapR(hzOut) * R;
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(cx, cy, rOut, rOut * flatten, 0, 0, Math.PI * 2);
      ctx.ellipse(cx, cy, rIn, rIn * flatten, 0, 0, Math.PI * 2, true);
      ctx.fillStyle = "rgba(255,176,0,0.07)";
      ctx.fill("evenodd");
      ctx.setLineDash([3, 5]);
      ctx.strokeStyle = "rgba(255,176,0,0.35)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rOut, rOut * flatten, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(cx, cy, rIn, rIn * flatten, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = "rgba(255,176,0,0.55)";
      ctx.font = "9px 'IBM Plex Mono', monospace";
      ctx.fillText("HABITABLE ZONE", cx - 44, cy - rOut * flatten - 6);

      // orbits
      for (const p of planetsRef.current) {
        const r = mapR(p.orbitAu) * R;
        ctx.beginPath();
        ctx.ellipse(cx, cy, r, r * flatten, 0, 0, Math.PI * 2);
        ctx.strokeStyle =
          p.id === selRef.current
            ? "rgba(255,42,30,0.5)"
            : "rgba(255,255,255,0.16)";
        ctx.lineWidth = p.id === selRef.current ? 1.4 : 1;
        ctx.stroke();
      }

      // central star
      const sg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 20);
      sg.addColorStop(0, star.color);
      sg.addColorStop(0.4, star.color + "88");
      sg.addColorStop(1, "transparent");
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(cx, cy, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = star.color;
      ctx.beginPath();
      ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - 9, cy);
      ctx.lineTo(cx - 5, cy);
      ctx.moveTo(cx + 5, cy);
      ctx.lineTo(cx + 9, cy);
      ctx.stroke();

      // planets (animated along orbits)
      projected = [];
      for (const p of planetsRef.current) {
        const r = mapR(p.orbitAu) * R;
        const speed = 0.35 / Math.sqrt(p.orbitAu * p.orbitAu * p.orbitAu);
        const ang = (phases.get(p.id) ?? 0) + t / 1000 * speed;
        const x = cx + Math.cos(ang) * r;
        const y = cy + Math.sin(ang) * r * flatten;
        projected.push({ id: p.id, x, y });

        const size =
          p.kind === "GAS_GIANT" || p.kind === "ICE_GIANT"
            ? 5.5
            : 3 + Math.min(2.5, p.radiusKm / 6371);
        const pg = ctx.createRadialGradient(x, y, 0, x, y, size * 2.6);
        pg.addColorStop(0, p.color + "aa");
        pg.addColorStop(1, "transparent");
        ctx.fillStyle = pg;
        ctx.beginPath();
        ctx.arc(x, y, size * 2.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();

        const isSelected = p.id === selRef.current;
        if (p.inHabitableZone && !isSelected) {
          ctx.strokeStyle = "rgba(255,176,0,0.55)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(x, y, size + 3.5, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (isSelected) {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(t / 1400);
          ctx.strokeStyle = "rgba(255,42,30,0.95)";
          ctx.lineWidth = 1.4;
          for (let q = 0; q < 4; q++) {
            ctx.beginPath();
            ctx.arc(
              0,
              0,
              size + 7,
              q * (Math.PI / 2) + 0.25,
              q * (Math.PI / 2) + Math.PI / 2 - 0.25
            );
            ctx.stroke();
          }
          ctx.restore();
          // leader line + label
          ctx.strokeStyle = "rgba(255,42,30,0.5)";
          ctx.beginPath();
          ctx.moveTo(x, y - size - 9);
          ctx.lineTo(x, y - size - 20);
          ctx.stroke();
          ctx.fillStyle = "rgba(255,120,100,1)";
          ctx.font = "600 10px 'IBM Plex Mono', monospace";
          ctx.fillText(p.designation, x + 4, y - size - 23);
        }
      }

      // legend
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.font = "9px 'IBM Plex Mono', monospace";
      ctx.fillText(
        `${star.name} · SCALE ~AU^0.55 · 1 PX ≈ 10⁵ KM`,
        10,
        height - 10
      );

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    const findNearest = (mx: number, my: number) => {
      let best: string | null = null;
      let bestD = 15;
      for (const q of projected) {
        const d = Math.hypot(q.x - mx, q.y - my);
        if (d < bestD) {
          bestD = d;
          best = q.id;
        }
      }
      return best;
    };
    const onClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const h = findNearest(e.clientX - rect.left, e.clientY - rect.top);
      if (h) onSelect(h);
    };
    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const h = findNearest(e.clientX - rect.left, e.clientY - rect.top);
      canvas.style.cursor = h ? "pointer" : "default";
    };
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("mousemove", onMove);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("mousemove", onMove);
    };
  }, [star, onSelect]);

  return (
    <canvas
      ref={canvasRef}
      className={className ?? "h-full w-full"}
      aria-label={`Orbital chart of ${star.name}`}
    />
  );
}
