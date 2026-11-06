"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { paintFace } from "@/lib/mission/portraits";
import type { CrewMember } from "@/lib/mission/crew";

// ─── Portrait — the mustered photograph, read off the member seed ────────────
// The dossier plate is a 48×48 canvas shown at 2× with nearest-neighbor
// upscale; on selection it reveals top-to-bottom with a phosphor read cursor,
// like a file coming off tape — the draw-on language, applied to raster.
// REV D: the plate is painted in real colors (RGBA out of the painter); the
// instrument around it stays ivory-on-black — a color print in a monochrome
// file. Roster rows use the dedicated 16×16 composition on its own tiny
// canvas (207 rows × 1 KiB is nothing; no cache, no data URLs, no SSR dance).
// Reduced motion → the plate paints instantly.

const REVEAL_MS = 340;

function drawGrid(
  ctx: CanvasRenderingContext2D,
  px: Uint8Array,
  size: number,
  rows: number
) {
  const img = ctx.createImageData(size, size);
  img.data.set(px.subarray(0, rows * size * 4)); // reveal: rows 0..rows
  ctx.clearRect(0, 0, size, size);
  ctx.putImageData(img, 0, 0, 0, 0, size, Math.max(1, Math.min(size, rows)));
}

export function Portrait({
  member,
  px = 96,
  className,
}: {
  member: CrewMember;
  px?: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const cvs = ref.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    const grid = paintFace(member, 48);

    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      drawGrid(ctx, grid, 48, 48);
      return;
    }

    let raf = 0;
    let t0 = 0;
    const step = (t: number) => {
      if (!t0) t0 = t;
      const k = Math.min(1, (t - t0) / REVEAL_MS);
      const rows = Math.ceil(k * 48);
      drawGrid(ctx, grid, 48, rows);
      if (k < 1) {
        ctx.fillStyle = "#7beba6";
        ctx.fillRect(0, Math.min(47, rows), 48, 1);
        raf = requestAnimationFrame(step);
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [member]);

  return (
    <canvas
      ref={ref}
      width={48}
      height={48}
      style={{ width: px, height: px }}
      className={cn("portrait-pix shrink-0", className)}
      role="img"
      aria-label={`Mustered portrait — ${member.name}`}
    />
  );
}

export function PortraitThumb({
  member,
  px = 16,
  className,
}: {
  member: CrewMember;
  px?: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const cvs = ref.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    drawGrid(ctx, paintFace(member, 16), 16, 16);
  }, [member]);

  return (
    <canvas
      ref={ref}
      width={16}
      height={16}
      style={{ width: px, height: px }}
      aria-hidden="true"
      className={cn("portrait-pix shrink-0", className)}
    />
  );
}
