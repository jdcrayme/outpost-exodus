"use client";

// ─── Title card — vector recreation of the OUTPOST // EXODUS logo ────────────
// Planet limb with a rising amber corona, wordmark above. Drawn, not painted:
// SVG geometry + the house mono — no raster assets (per the charter).

export function IntroLogo({ className }: { className?: string }) {
  return (
    <div className={className} role="img" aria-label="OUTPOST // EXODUS">
      {/* planet limb + corona — full bleed, crops to any aspect */}
      <svg
        viewBox="0 0 1200 675"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="intro-corona" cx="50%" cy="68%" r="60%">
            <stop offset="0%" stopColor="#ffb347" stopOpacity="0.55" />
            <stop offset="38%" stopColor="#ff8c1a" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#ff8c1a" stopOpacity="0" />
          </radialGradient>
          <filter id="intro-soft" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="18" />
          </filter>
          <filter id="intro-soft-core" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="9" />
          </filter>
          <linearGradient
            id="intro-rim"
            gradientUnits="userSpaceOnUse"
            x1="300"
            y1="0"
            x2="960"
            y2="0"
          >
            <stop offset="0%" stopColor="#ffd9a0" stopOpacity="0" />
            <stop offset="52%" stopColor="#ffd9a0" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#ffd9a0" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* light spilling over the limb, brightest right of centre */}
        <g className="intro-bloom">
          <ellipse
            cx="744"
            cy="476"
            rx="470"
            ry="200"
            fill="url(#intro-corona)"
            filter="url(#intro-soft)"
          />
          <ellipse
            cx="744"
            cy="478"
            rx="185"
            ry="66"
            fill="#ffdfae"
            opacity="0.5"
            filter="url(#intro-soft-core)"
          />
        </g>

        {/* the world itself — dark against the field, ivory rim */}
        <circle
          className="intro-planet"
          cx="600"
          cy="1420"
          r="950"
          fill="#07070a"
          stroke="rgba(232,230,220,0.22)"
          strokeWidth="1"
        />

        {/* rim light along the arc, tracing on like everything here */}
        <path
          className="intro-rim"
          pathLength={1}
          d="M 300 532 A 950 950 0 0 1 960 517"
          fill="none"
          stroke="url(#intro-rim)"
          strokeWidth="2"
        />
      </svg>

      {/* wordmark — HTML so it scales with the viewport, not the crop */}
      <div className="absolute inset-x-0 top-[30%] flex flex-col items-center gap-5 px-6 text-center">
        <h1 className="intro-word hal-display glow-ink mr-[-0.32em] text-[clamp(2.4rem,8.5vw,5rem)] font-normal leading-none tracking-[0.32em] text-[#f2f0e6]">
          OUTPOST
        </h1>
        <div className="intro-sub flex w-full items-center justify-center gap-4 sm:gap-6">
          <span className="intro-rule-l h-px w-10 bg-ink/50 sm:w-24" aria-hidden="true" />
          <span className="hal-display mr-[-0.55em] text-[0.65rem] tracking-[0.55em] text-ink/85 sm:text-sm">
            EXODUS
          </span>
          <span className="intro-rule-r h-px w-10 bg-ink/50 sm:w-24" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
