"use client";

import { useEffect, useRef } from "react";

// ─── Lissajous monitor — the 9000's neural pattern on a scope ────────────────
// x = sin(a·t + δ), y = sin(b·t). The phase δ drifts continuously, so the
// figure quietly re-draws itself forever — a pure mathematical presence in
// place of an eye. Phosphor trace, faint graticule.

export function Lissajous({
  size = 160,
  a = 3,
  b = 2,
  className,
  label,
}: {
  size?: number;
  a?: number;
  b?: number;
  className?: string;
  label?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);

    const pad = size * 0.12;
    const rr = (size / 2) - pad;
    const cx = size / 2;
    const cy = size / 2;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const t0 = performance.now();

    const draw = (t: number) => {
      const sec = (t - t0) / 1000;
      const delta = sec * 0.14; // slow phase drift — the figure breathes

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);

      // graticule: crosshair + bounding circle
      ctx.strokeStyle = "rgba(232,230,220,0.12)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, pad - 3);
      ctx.lineTo(cx, size - pad + 3);
      ctx.moveTo(pad - 3, cy);
      ctx.lineTo(size - pad + 3, cy);
      ctx.stroke();
      ctx.strokeStyle = "rgba(232,230,220,0.08)";
      ctx.beginPath();
      ctx.arc(cx, cy, rr, 0, Math.PI * 2);
      ctx.stroke();

      // Lissajous trace with a fading tail (two passes: dim full figure, bright head)
      const N = 540;
      const trace = (from: number, to: number, alpha: number, width: number) => {
        ctx.strokeStyle = `rgba(123,235,166,${alpha})`;
        ctx.lineWidth = width;
        ctx.beginPath();
        for (let i = from; i <= to; i++) {
          const tt = (i / N) * Math.PI * 2;
          const x = cx + Math.sin(a * tt + delta) * rr;
          const y = cy - Math.sin(b * tt) * rr;
          if (i === from) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      };
      trace(0, N, 0.28, 1);
      const head = Math.floor(N * 0.82);
      trace(head, N, 0.95, 1.5);

      if (!reduced) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [size, a, b]);

  return (
    <div className={className} role="img" aria-label="Lissajous figure — neural pattern display">
      <canvas ref={ref} style={{ width: size, height: size }} />
      {label && (
        <div className="hal-mono mt-1 text-center text-[9px] tracking-[0.28em] text-neutral-500">
          {label}
        </div>
      )}
    </div>
  );
}
