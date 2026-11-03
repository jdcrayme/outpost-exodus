"use client";

import { useEffect, useRef } from "react";
import type { Planet } from "@/lib/mission/types";
import { hashString, makeFbm, mulberry32 } from "@/lib/mission/engine";

// ─── VLBI surface render — chunky 90s pixels, scanline reveal, slow spin ────
// Renders a deterministic texture from the planet's physical parameters.
// In BLIND mode (no probe aboard) it degrades to receiver static.

const W = 144;
const H = 72;

export function PlanetScan({
  planet,
  blind = false,
  className,
}: {
  planet: Planet;
  blind?: boolean;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const off = document.createElement("canvas");
    off.width = W;
    off.height = H;
    const offCtx = off.getContext("2d");
    if (!offCtx) return;
    const img = offCtx.createImageData(W, H);

    const rand = mulberry32(hashString("planet:" + planet.id));
    const fbm = makeFbm(rand);
    const cloudFbm = makeFbm(rand);

    // static noise buffer for unscanned rows / blind mode
    const staticRand = mulberry32(hashString("static:" + planet.id));

    // pre-bake scrollable texture (2x width for wrap)
    const tex = new Float32Array(W * 2 * H);
    for (let y = 0; y < H; y++) {
      const lat = (y / H) * 2 - 1; // -1..1
      for (let x = 0; x < W * 2; x++) {
        tex[y * W * 2 + x] = fbm(x * 0.065, y * 0.13 + lat * 0.5);
      }
    }

    const water = planet.waterFraction;
    const icy =
      planet.tempC < -15 ||
      planet.kind === "ICE_WORLD" ||
      planet.kind === "ICE_GIANT";
    const gas = planet.kind === "GAS_GIANT" || planet.kind === "ICE_GIANT";

    const rafRef = { id: 0 };
    const startT = performance.now();
    const scanMs = 1600;

    const colorAt = (v: number, latAbs: number, cloud: number) => {
      let r = 0;
      let g = 0;
      let b = 0;
      if (gas) {
        // banded tans / creams
        const band = Math.sin(latAbs * Math.PI * 9 + v * 2.4) * 0.5 + 0.5;
        r = 150 + band * 90;
        g = 120 + band * 70;
        b = 80 + band * 40;
      } else if (icy) {
        const t = v * 0.6 + 0.4;
        r = 165 + t * 80;
        g = 180 + t * 65;
        b = 195 + t * 55;
      } else if (v < water) {
        // ocean by depth
        const d = (water - v) / Math.max(water, 0.001);
        r = 22 + (1 - d) * 26;
        g = 52 + (1 - d) * 34;
        b = 60 + (1 - d) * 28;
      } else {
        // land: elevation-driven olive → tan → rock
        const e = (v - water) / Math.max(1 - water, 0.001);
        if (e < 0.35) {
          r = 96 + e * 120;
          g = 108 + e * 100;
          b = 64 + e * 60;
        } else {
          r = 150 + e * 80;
          g = 132 + e * 70;
          b = 96 + e * 60;
        }
      }
      // polar caps (terrestrial, cold enough)
      if (!gas && !icy && planet.tempC < 30 && latAbs > 0.78) {
        const cap = (latAbs - 0.78) / 0.22;
        r = r * (1 - cap) + 232 * cap;
        g = g * (1 - cap) + 240 * cap;
        b = b * (1 - cap) + 246 * cap;
      }
      // clouds
      if (planet.atmosphere.pressureAtm > 0.15 && cloud > 0.62) {
        const c = (cloud - 0.62) / 0.38 * 0.55;
        r = r * (1 - c) + 235 * c;
        g = g * (1 - c) + 238 * c;
        b = b * (1 - c) + 240 * c;
      }
      return [r, g, b] as const;
    };

    const draw = (t: number) => {
      const elapsed = t - startT;
      const reveal = blind ? 0 : Math.min(1, elapsed / scanMs);
      const spin = (t / 1000) * (14 / Math.max(planet.dayHours, 1)) * 18;

      const cx = W / 2;
      const cy = H / 2;
      const rr = H / 2 - 1; // square radius → the sphere stays circular on screen

      const data = img.data;
      for (let y = 0; y < H; y++) {
        const revealed = y / H <= reveal;
        for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4;
          // sphere mask (circular)
          const nx = (x - cx) / rr;
          const ny = (y - cy) / rr;
          const d2 = nx * nx + ny * ny;
          if (d2 > 1) {
            data[i] = 4;
            data[i + 1] = 4;
            data[i + 2] = 6;
            data[i + 3] = 255;
            continue;
          }
          if (!revealed) {
            // unscanned: receiver static
            const s = staticRand() * 70 + 8;
            data[i] = s;
            data[i + 1] = s * 0.9;
            data[i + 2] = s * 0.95;
            data[i + 3] = 255;
            continue;
          }
          // texture sample with wrap-around scroll
          const tx = Math.floor((x + spin) % (W * 2));
          const v = tex[y * W * 2 + tx];
          const cloud =
            planet.atmosphere.pressureAtm > 0.15
              ? cloudFbm((x + spin * 1.6) * 0.05, y * 0.1)
              : 0;
          const latAbs = Math.abs(ny);
          const [r, g, b] = colorAt(v, latAbs, cloud);
          // sphere shading: light from upper-left
          const nz = Math.sqrt(Math.max(0, 1 - d2));
          const lx = -0.62;
          const ly = -0.55;
          const lz = 0.56;
          let shade = nx * lx + ny * ly + nz * lz;
          shade = Math.max(0.06, shade);
          // limb darkening
          shade *= 0.55 + 0.45 * nz;
          data[i] = Math.min(255, r * shade);
          data[i + 1] = Math.min(255, g * shade);
          data[i + 2] = Math.min(255, b * shade);
          data[i + 3] = 255;
        }
      }
      offCtx.putImageData(img, 0, 0);

      // main canvas: upscale with chunky pixels
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, 0, 0, W, H, 0, 0, canvas.width, canvas.height);

      // atmosphere rim
      if (planet.atmosphere.pressureAtm > 0.2 && !blind) {
        ctx.strokeStyle =
          planet.atmosphere.breathable
            ? "rgba(140,235,190,0.5)"
            : "rgba(255,170,110,0.4)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        // hug the planet circle (radius = (H/2-1) cells × 4 px/cell)
        const rimR = (H / 2 - 1) * 4 + 2;
        ctx.arc(canvas.width / 2, canvas.height / 2, rimR, 0, Math.PI * 2);
        ctx.stroke();
      }

      // scan sweep line
      if (reveal < 1) {
        const sy = (canvas.height * (reveal * 1.05)) | 0;
        ctx.fillStyle = "rgba(123,235,166,0.85)";
        ctx.fillRect(0, sy, canvas.width, 2);
        ctx.fillStyle = "rgba(123,235,166,0.15)";
        ctx.fillRect(0, sy - 12, canvas.width, 12);
      }

      if (blind) {
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "rgba(245,199,106,0.95)";
        ctx.font = "600 22px 'IBM Plex Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText("NO SIGNAL", canvas.width / 2, canvas.height / 2 - 2);
        ctx.font = "12px 'IBM Plex Mono', monospace";
        ctx.fillStyle = "rgba(245,199,106,0.8)";
        ctx.fillText(
          "VLBI PROBE NOT ABOARD",
          canvas.width / 2,
          canvas.height / 2 + 20
        );
        ctx.textAlign = "left";
      }

      rafRef.id = requestAnimationFrame(draw);
    };
    rafRef.id = requestAnimationFrame(draw);

    return () => cancelAnimationFrame(rafRef.id);
  }, [planet, blind]);

  return (
    <canvas
      ref={canvasRef}
      width={576}
      height={288}
      className={className ?? "h-full w-full"}
      aria-label={`Scan render of ${planet.designation}`}
    />
  );
}
