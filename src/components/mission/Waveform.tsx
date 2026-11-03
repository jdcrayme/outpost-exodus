"use client";

import { useEffect, useRef } from "react";

// ─── Oscilloscope trace — the 9000's voice channel on the comm panel ─────────
// Idle: a quiet carrier line with a noise floor. Active: a speech-like
// composite waveform, phosphor green on a faint grid. Drawn on canvas with
// a drifting bank of harmonics so it never loops visibly.

export function Waveform({
  active = false,
  width = 132,
  height = 30,
  className,
}: {
  active?: boolean;
  width?: number;
  height?: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef(active);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    // drifting harmonic bank — speech-envelope feel
    const modes = [2.3, 3.9, 5.7, 9.1].map((f, i) => ({
      f,
      ph: Math.random() * Math.PI * 2,
      amp: 0.52 / (i + 1),
      drift: 0.31 + i * 0.23,
    }));

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const t0 = performance.now();
    let level = 0; // smoothed activity level

    const draw = (t: number) => {
      const sec = (t - t0) / 1000;
      const target = activeRef.current ? 1 : 0;
      level += (target - level) * 0.07;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      // faint graticule: center line + quarter divisions
      ctx.strokeStyle = "rgba(232,230,220,0.12)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, height / 2 + 0.5);
      ctx.lineTo(width, height / 2 + 0.5);
      ctx.moveTo(width * 0.25, 2);
      ctx.lineTo(width * 0.25, height - 2);
      ctx.moveTo(width * 0.5, 2);
      ctx.lineTo(width * 0.5, height - 2);
      ctx.moveTo(width * 0.75, 2);
      ctx.lineTo(width * 0.75, height - 2);
      ctx.stroke();

      // trace
      ctx.strokeStyle = "rgba(123,235,166,0.9)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let x = 0; x <= width; x++) {
        let y = 0;
        for (const m of modes) {
          const a = m.amp * (0.55 + 0.45 * Math.sin(sec * m.drift + m.ph));
          y += Math.sin((x / width) * Math.PI * 2 * m.f + sec * (2 + m.f) + m.ph) * a;
        }
        y = y * level + (Math.random() - 0.5) * 0.055;
        const py = height / 2 - y * (height / 2 - 3);
        if (x === 0) ctx.moveTo(x, py);
        else ctx.lineTo(x, py);
      }
      ctx.stroke();

      if (!reduced) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [width, height]);

  return (
    <canvas
      ref={ref}
      style={{ width, height }}
      className={className}
      role="img"
      aria-label={active ? "HAL speaking — voice waveform active" : "HAL voice channel idle"}
    />
  );
}
