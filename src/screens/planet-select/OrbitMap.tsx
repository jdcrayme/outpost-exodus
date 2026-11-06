"use client";

import { useEffect, useRef } from "react";
import type { Planet, StarSystem } from "@/lib/mission/types";
import { hashString, mulberry32 } from "@/lib/mission/engine";

// ─── System orbital chart — star, orbits, animated planets, HZ band ─────────
// The ship's arrival is part of the chart: the deceleration arc is plotted
// from the Sol direction into the parking orbit. It targets the intended
// parking orbit on entry, then re-plots — gliding, not cutting — to
// whichever world the Commander selects.

export function OrbitMap({
  star,
  planets,
  selectedId,
  onSelect,
  parkingOrbitAu,
  className,
}: {
  star: StarSystem;
  planets: Planet[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Orbit radius of HALCYON's intended parking target, AU — used until the
   *  Commander selects a world. */
  parkingOrbitAu?: number | null;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const selRef = useRef(selectedId);
  const planetsRef = useRef(planets);
  const parkingRef = useRef(parkingOrbitAu ?? null);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    selRef.current = selectedId;
    planetsRef.current = planets;
    parkingRef.current = parkingOrbitAu ?? null;
    onSelectRef.current = onSelect;
  }, [selectedId, planets, parkingOrbitAu, onSelect]);

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

    // ── arrival arc state — glide-replots as the parking target changes ──
    let arcR = -1; // current target ring radius, px
    let arcAlpha = 0;
    let arcBornAt = -1;
    const smoothS = (s: number) => s * s * (3 - 2 * s);
    const clamp01 = (s: number) => Math.max(0, Math.min(1, s));

    const draw = (t: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const cx = width / 2;
      const cy = height / 2;
      const R = Math.min(width, height) / 2 - 30;
      const flatten = 0.46;

      // habitable zone band
      const rIn = mapR(hzIn) * R;
      const rOut = mapR(hzOut) * R;
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(cx, cy, rOut, rOut * flatten, 0, 0, Math.PI * 2);
      ctx.ellipse(cx, cy, rIn, rIn * flatten, 0, 0, Math.PI * 2, true);
      ctx.fillStyle = "rgba(123,235,166,0.06)";
      ctx.fill("evenodd");
      ctx.setLineDash([3, 5]);
      ctx.strokeStyle = "rgba(123,235,166,0.35)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rOut, rOut * flatten, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(cx, cy, rIn, rIn * flatten, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = "rgba(123,235,166,0.55)";
      ctx.font = "9px 'IBM Plex Mono', monospace";
      ctx.fillText("HABITABLE ZONE", cx - 44, cy - rOut * flatten - 6);

      // orbits
      for (const p of planetsRef.current) {
        const r = mapR(p.orbitAu) * R;
        ctx.beginPath();
        ctx.ellipse(cx, cy, r, r * flatten, 0, 0, Math.PI * 2);
        ctx.strokeStyle =
          p.id === selRef.current
            ? "rgba(232,230,220,0.55)"
            : "rgba(255,255,255,0.16)";
        ctx.lineWidth = p.id === selRef.current ? 1.4 : 1;
        ctx.stroke();
      }

      // central star
      const sg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 26);
      sg.addColorStop(0, star.color);
      sg.addColorStop(0.4, star.color + "88");
      sg.addColorStop(1, "transparent");
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(cx, cy, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = star.color;
      ctx.beginPath();
      ctx.arc(cx, cy, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - 11, cy);
      ctx.lineTo(cx - 6, cy);
      ctx.moveTo(cx + 6, cy);
      ctx.lineTo(cx + 11, cy);
      ctx.stroke();

      // planets (animated along orbits)
      projected = [];
      for (const p of planetsRef.current) {
        const r = mapR(p.orbitAu) * R;
        const speed = 0.035 / Math.sqrt(p.orbitAu * p.orbitAu * p.orbitAu);
        const ang = (phases.get(p.id) ?? 0) + t / 1000 * speed;
        const x = cx + Math.cos(ang) * r;
        const y = cy + Math.sin(ang) * r * flatten;
        projected.push({ id: p.id, x, y });

        const size =
          p.kind === "GAS_GIANT" || p.kind === "ICE_GIANT"
            ? 7
            : 4.2 + Math.min(3, p.radiusKm / 6371);
        const pg = ctx.createRadialGradient(x, y, 0, x, y, size * 2.8);
        pg.addColorStop(0, p.color + "aa");
        pg.addColorStop(1, "transparent");
        ctx.fillStyle = pg;
        ctx.beginPath();
        ctx.arc(x, y, size * 2.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();

        const isSelected = p.id === selRef.current;
        if (p.inHabitableZone && !isSelected) {
          ctx.strokeStyle = "rgba(123,235,166,0.5)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(x, y, size + 4, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (isSelected) {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(t / 1400);
          ctx.strokeStyle = "rgba(232,230,220,0.95)";
          ctx.lineWidth = 1.4;
          for (let q = 0; q < 4; q++) {
            ctx.beginPath();
            ctx.arc(
              0,
              0,
              size + 8,
              q * (Math.PI / 2) + 0.25,
              q * (Math.PI / 2) + Math.PI / 2 - 0.25
            );
            ctx.stroke();
          }
          ctx.restore();
          // leader line + label
          ctx.strokeStyle = "rgba(232,230,220,0.5)";
          ctx.beginPath();
          ctx.moveTo(x, y - size - 10);
          ctx.lineTo(x, y - size - 22);
          ctx.stroke();
          ctx.fillStyle = "rgba(232,230,220,1)";
          ctx.font = "600 10px 'IBM Plex Mono', monospace";
          ctx.fillText(p.designation, x + 4, y - size - 25);
        }
      }

      // legend
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.font = "9px 'IBM Plex Mono', monospace";
      ctx.fillText(
        `${star.name} · RADIAL SCALE ~AU^0.55 · NON-LINEAR`,
        10,
        height - 10
      );

      // ── deceleration arc — from Sol, wrapping into the parking orbit ──
      const sel = planetsRef.current.find(
        (p) => p.id === selRef.current
      );
      const selAu = sel ? sel.orbitAu : parkingRef.current;
      if (selAu != null) {
        const targetR = mapR(selAu) * R;
        if (arcR < 0) arcR = targetR; // snap on first sight, glide after
        arcR += (targetR - arcR) * 0.07;
        arcAlpha = Math.min(1, arcAlpha + 0.035);
        if (arcBornAt < 0) arcBornAt = t;
        const reveal = smoothS(clamp01((t - arcBornAt) / 1600));

        // the intended parking orbit, emphasized — the arc lands on it
        ctx.save();
        ctx.setLineDash([7, 4]);
        ctx.strokeStyle = `rgba(232,230,220,${0.6 * arcAlpha})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, arcR, arcR * flatten, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        const ARC_N = 84;
        const SWEEP = 5.25;
        const enter = Math.PI * 0.98; // from the Sol direction, screen left
        ctx.beginPath();
        let endX = cx;
        let endY = cy;
        let capX = cx;
        let capY = cy;
        for (let i = 0; i <= ARC_N; i++) {
          const a = (i / ARC_N) * reveal;
          const rr = (R + 60) + (arcR - (R + 60)) * smoothS(a);
          const ang = enter - a * SWEEP;
          const x = cx + Math.cos(ang) * rr;
          const y = cy + Math.sin(ang) * rr * flatten;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          if (i === Math.floor(ARC_N * 0.86)) {
            capX = x;
            capY = y;
          }
          endX = x;
          endY = y;
        }
        ctx.strokeStyle = `rgba(232,230,220,${0.75 * arcAlpha})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // leading dot rides the arc while it draws
        if (reveal > 0.02 && reveal < 1) {
          const lg = ctx.createRadialGradient(endX, endY, 0, endX, endY, 10);
          lg.addColorStop(0, "rgba(123,235,166,0.8)");
          lg.addColorStop(1, "transparent");
          ctx.fillStyle = lg;
          ctx.beginPath();
          ctx.arc(endX, endY, 10, 0, Math.PI * 2);
          ctx.fill();
        }

        // capture burn marker
        ctx.save();
        ctx.translate(capX, capY);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = `rgba(245,199,106,${arcAlpha})`;
        ctx.fillRect(-3.4, -3.4, 6.8, 6.8);
        ctx.restore();

        // the ship, parked on the ring
        if (reveal >= 1) {
          const sg2 = ctx.createRadialGradient(endX, endY, 0, endX, endY, 18);
          sg2.addColorStop(0, "rgba(123,235,166,0.6)");
          sg2.addColorStop(1, "transparent");
          ctx.fillStyle = sg2;
          ctx.beginPath();
          ctx.arc(endX, endY, 18, 0, Math.PI * 2);
          ctx.fill();
          // reticle — this is the ship, not a planet
          ctx.strokeStyle = "rgba(123,235,166,0.9)";
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(endX, endY, 8, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = "#7beba6";
          ctx.beginPath();
          ctx.arc(endX, endY, 4.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.font = "600 10px 'IBM Plex Mono', monospace";
          const shipLabel = `EXODUS · PARKING ORBIT ${selAu.toFixed(2)} AU`;
          ctx.strokeStyle = "rgba(3,3,4,0.9)";
          ctx.lineWidth = 3;
          ctx.strokeText(shipLabel, endX - 12, endY + 22);
          ctx.fillStyle = "rgba(165,240,195,0.95)";
          ctx.fillText(shipLabel, endX - 12, endY + 22);
        }

        // provenance — where the arc came from
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.font = "9px 'IBM Plex Mono', monospace";
        ctx.fillText(
          "◀ FROM SOL — DECELERATION ARC",
          cx - R + 8,
          cy + 30
        );
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    const findNearest = (mx: number, my: number) => {
      let best: string | null = null;
      let bestD = 17;
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
      if (h) onSelectRef.current(h);
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
  }, [star]);

  return (
    <canvas
      ref={canvasRef}
      className={className ?? "h-full w-full"}
      aria-label={`Orbital chart of ${star.name}`}
    />
  );
}
