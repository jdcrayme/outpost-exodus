"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// ─── HUD panel — hairline ivory border, header strip, corner brackets ────────
// Structure is ink (ivory). Accent marks the panel's semantic state:
// white = neutral reference · phos = live/computed · amber = caution · red = alert.

export type HudAccent = "white" | "phos" | "amber" | "red";

const ACCENT: Record<HudAccent, { bracket: string; title: string }> = {
  white: { bracket: "border-ink", title: "text-ink" },
  phos: { bracket: "border-phos", title: "text-phos" },
  amber: { bracket: "border-amber-400", title: "text-amber-300" },
  red: { bracket: "border-red-500", title: "text-red-400" },
};

export function HudPanel({
  title,
  code,
  children,
  className,
  bodyClassName,
  accent = "white",
}: {
  title: string;
  code?: string;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  accent?: HudAccent;
}) {
  const a = ACCENT[accent];

  return (
    <section
      className={cn(
        "relative border border-ink/15 bg-black/40 backdrop-blur-[1px]",
        className
      )}
    >
      {/* corner brackets */}
      <span
        className={cn(
          "pointer-events-none absolute -left-px -top-px h-3 w-3 border-l-2 border-t-2",
          a.bracket
        )}
      />
      <span
        className={cn(
          "pointer-events-none absolute -right-px -top-px h-3 w-3 border-r-2 border-t-2",
          a.bracket
        )}
      />
      <span
        className={cn(
          "pointer-events-none absolute -bottom-px -left-px h-3 w-3 border-b-2 border-l-2",
          a.bracket
        )}
      />
      <span
        className={cn(
          "pointer-events-none absolute -bottom-px -right-px h-3 w-3 border-b-2 border-r-2",
          a.bracket
        )}
      />

      {/* header strip */}
      <header className="flex items-center gap-3 border-b border-ink/15 px-3 py-1.5">
        <h2
          className={cn(
            "hal-display min-w-0 truncate text-[11px] font-normal tracking-[0.22em] uppercase",
            a.title
          )}
        >
          {title}
        </h2>
        <span className="tick-ruler hidden h-[5px] min-w-8 flex-1 sm:block" aria-hidden="true" />
        {code && (
          <span className="hal-mono shrink-0 text-[10px] tracking-widest text-neutral-500">
            {code}
          </span>
        )}
      </header>

      <div className={cn("p-3 sm:p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

// ─── Data row — label / value pair used across every dossier ────────────────

export function DataRow({
  label,
  value,
  warn,
  className,
}: {
  label: string;
  value: ReactNode;
  warn?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-3 border-b border-ink/5 py-1",
        className
      )}
    >
      <span className="hal-mono text-[10px] tracking-widest text-neutral-500 uppercase shrink-0">
        {label}
      </span>
      <span
        className={cn(
          "hal-mono text-right text-[11px] sm:text-xs",
          warn ? "text-amber-300" : "text-ink"
        )}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Circular gauge — re-exported under its original name ────────────────────
export { ArcGauge as Gauge } from "./ArcGauge";

// ─── HUD button — solid ivory primary, hairline ghost, amber caution ─────────

export function HudButton({
  children,
  onClick,
  disabled,
  variant = "primary",
  className,
  size = "md",
  "aria-label": ariaLabel,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "ghost" | "danger";
  className?: string;
  size?: "sm" | "md";
  "aria-label"?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        "hal-display group relative min-h-11 border uppercase transition-all duration-200",
        size === "sm"
          ? "px-3 py-1.5 text-[10px] tracking-[0.18em]"
          : "px-5 py-2.5 text-xs tracking-[0.24em]",
        variant === "primary" &&
          "border-ink bg-ink text-black hover:bg-white hover:shadow-[0_0_16px_rgba(232,230,220,0.25)]",
        variant === "ghost" &&
          "border-ink/25 bg-transparent text-ink/70 hover:border-ink/60 hover:text-ink",
        variant === "danger" &&
          "border-amber-400/60 bg-amber-400/10 text-amber-300 hover:border-amber-300 hover:bg-amber-400/20",
        disabled &&
          "cursor-not-allowed border-ink/10 bg-transparent text-neutral-600 hover:shadow-none",
        className
      )}
    >
      {children}
    </button>
  );
}
