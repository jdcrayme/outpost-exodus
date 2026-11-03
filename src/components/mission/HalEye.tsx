"use client";

import { cn } from "@/lib/utils";

// ─── HAL 9000 lens — concentric housing, gold ring, red iris ────────────────
// Drawn from the Discovery One pod-bay camera: brushed outer shell, black
// baffle, warm gold eyelid ring, deep red lens with dark pupil.

export function HalEye({
  size = 96,
  className,
  glow = true,
  label = true,
}: {
  size?: number;
  className?: string;
  glow?: boolean;
  label?: boolean;
}) {
  return (
    <div
      className={cn("flex flex-col items-center", className)}
      style={{ width: size }}
      role="img"
      aria-label="HAL 9000 camera lens"
    >
      <svg
        viewBox="0 0 200 200"
        width={size}
        height={size}
        className={glow ? "hal-eye-glow" : undefined}
      >
        <defs>
          <radialGradient id="hal-housing" cx="0.42" cy="0.36" r="0.85">
            <stop offset="0%" stopColor="#8a8f96" />
            <stop offset="35%" stopColor="#3c4046" />
            <stop offset="62%" stopColor="#14161a" />
            <stop offset="82%" stopColor="#565b63" />
            <stop offset="100%" stopColor="#0c0d10" />
          </radialGradient>
          <linearGradient id="hal-gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f0cf7e" />
            <stop offset="45%" stopColor="#b98d35" />
            <stop offset="70%" stopColor="#e8c169" />
            <stop offset="100%" stopColor="#6e5217" />
          </linearGradient>
          <radialGradient id="hal-lens" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#5c0300" />
            <stop offset="38%" stopColor="#a50c00" />
            <stop offset="72%" stopColor="#e3170d" />
            <stop offset="92%" stopColor="#ff3b23" />
            <stop offset="100%" stopColor="#c00d00" />
          </radialGradient>
          <radialGradient id="hal-pupil" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#1c0300" />
            <stop offset="70%" stopColor="#2e0500" />
            <stop offset="100%" stopColor="#4a0800" />
          </radialGradient>
        </defs>

        {/* outer machined housing */}
        <circle cx="100" cy="100" r="97" fill="url(#hal-housing)" />
        <circle cx="100" cy="100" r="97" fill="none" stroke="#000" strokeWidth="1.5" />
        <circle cx="100" cy="100" r="88" fill="none" stroke="#1b1d21" strokeWidth="2" />
        {/* baffle gap */}
        <circle cx="100" cy="100" r="79" fill="#070708" />
        {/* gold eyelid ring */}
        <circle cx="100" cy="100" r="70" fill="url(#hal-gold)" />
        <circle cx="100" cy="100" r="70" fill="none" stroke="#2a1e07" strokeWidth="1" />
        {/* inner black throat */}
        <circle cx="100" cy="100" r="62" fill="#000" />
        {/* red lens */}
        <circle cx="100" cy="100" r="52" fill="url(#hal-lens)" />
        <circle cx="100" cy="100" r="52" fill="none" stroke="#5c0400" strokeWidth="1.5" />
        {/* pupil */}
        <circle cx="100" cy="100" r="17" fill="url(#hal-pupil)" />
        {/* specular highlight */}
        <ellipse
          cx="82"
          cy="78"
          rx="14"
          ry="7"
          fill="#fff"
          opacity="0.16"
          transform="rotate(-28 82 78)"
        />
        <ellipse cx="76" cy="86" rx="5" ry="3" fill="#fff" opacity="0.28" />
      </svg>
      {label && (
        <div className="hal-mono mt-1 text-center leading-tight">
          <div
            className="font-semibold tracking-[0.35em] text-neutral-300"
            style={{ fontSize: Math.max(8, size * 0.07) }}
          >
            HAL 9000
          </div>
          {size >= 72 && (
            <div
              className="text-neutral-500 tracking-widest"
              style={{ fontSize: Math.max(7, size * 0.055) }}
            >
              COMPUTER
            </div>
          )}
        </div>
      )}
    </div>
  );
}
