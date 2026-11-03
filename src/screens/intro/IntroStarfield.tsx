"use client";

import { useEffect, useRef } from "react";

// ─── Drifting 2-D starfield — the quiet before the prologue ──────────────────

interface Star {
  x: number;
  y: number;
  r: number;
  base: number; // base alpha
  amp: number; // twinkle amplitude
  speed: number; // twinkle speed
  phase: number;
  drift: number; // px/s, slow fall
  tint: string; // "r,g,b"
}

// ivory field, a few cold whites, rare phosphor and amber grains
const TINTS = [
  "232,230,220",
  "232,230,220",
  "232,230,220",
  "232,230,220",
  "232,230,220",
  "236,240,255",
  "123,235,166",
  "255,190,120",
];

export function IntroStarfield({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let raf = 0;
    let stars: Star[] = [];
    let w = 0;
    let h = 0;

    const seed = () => {
      const count = Math.round((w * h) / 9000);
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.3 + Math.random() * 1.1,
        base: 0.1 + Math.random() * 0.45,
        amp: 0.08 + Math.random() * 0.28,
        speed: 0.25 + Math.random() * 0.8,
        phase: Math.random() * Math.PI * 2,
        drift: 1.2 + Math.random() * 2.2,
        tint: TINTS[Math.floor(Math.random() * TINTS.length)],
      }));
    };

    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    };

    const draw = (t: number, dt: number) => {
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        if (!reduced) {
          s.y += (s.drift * dt) / 1000;
          if (s.y > h + 2) {
            s.y = -2;
            s.x = Math.random() * w;
          }
        }
        const a = reduced
          ? s.base
          : Math.max(
              0.04,
              s.base + s.amp * Math.sin((t / 1000) * s.speed + s.phase)
            );
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${s.tint},${a.toFixed(3)})`;
        ctx.fill();
      }
    };

    resize();
    window.addEventListener("resize", resize);

    if (reduced) {
      draw(0, 0);
    } else {
      let last = performance.now();
      const loop = (now: number) => {
        draw(now, now - last);
        last = now;
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
