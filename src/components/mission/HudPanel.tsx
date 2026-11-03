"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// ─── HUD panel — hairline border, header strip, corner brackets ─────────────

export function HudPanel({
  title,
  code,
  children,
  className,
  bodyClassName,
  accent = "red",
}: {
  title: string;
  code?: string;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  accent?: "red" | "amber" | "white";
}) {
  const bracket =
    accent === "amber"
      ? "border-amber-400"
      : accent === "white"
        ? "border-neutral-300"
        : "border-red-500";
  const titleColor =
    accent === "amber"
      ? "text-amber-300"
      : accent === "white"
        ? "text-neutral-200"
        : "text-red-400";

  return (
    <section
      className={cn(
        "relative border border-white/15 bg-black/40 backdrop-blur-[1px]",
        className
      )}
    >
      {/* corner brackets */}
      <span
        className={cn(
          "pointer-events-none absolute -left-px -top-px h-3 w-3 border-l-2 border-t-2",
          bracket
        )}
      />
      <span
        className={cn(
          "pointer-events-none absolute -right-px -top-px h-3 w-3 border-r-2 border-t-2",
          bracket
        )}
      />
      <span
        className={cn(
          "pointer-events-none absolute -bottom-px -left-px h-3 w-3 border-b-2 border-l-2",
          bracket
        )}
      />
      <span
        className={cn(
          "pointer-events-none absolute -bottom-px -right-px h-3 w-3 border-b-2 border-r-2",
          bracket
        )}
      />

      {/* header strip */}
      <header className="flex items-center justify-between border-b border-white/15 px-3 py-1.5">
        <h2
          className={cn(
            "hal-display text-[11px] font-normal tracking-[0.22em] uppercase",
            titleColor
          )}
        >
          {title}
        </h2>
        {code && (
          <span className="hal-mono text-[10px] tracking-widest text-neutral-500">
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
        "flex items-baseline justify-between gap-3 border-b border-white/5 py-1",
        className
      )}
    >
      <span className="hal-mono text-[10px] tracking-widest text-neutral-500 uppercase shrink-0">
        {label}
      </span>
      <span
        className={cn(
          "hal-mono text-right text-[11px] sm:text-xs",
          warn ? "text-red-400 glow-red" : "text-neutral-200"
        )}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Horizontal gauge (0–100) with HAL-grade coloring ───────────────────────

export function Gauge({
  label,
  value,
  max = 100,
  invert = false,
  suffix = "",
}: {
  label: string;
  value: number;
  max?: number;
  invert?: boolean;
  suffix?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  // invert=true: high value is bad (seismic, radiation)
  const good = invert ? 100 - pct : pct;
  const color =
    good >= 66
      ? "bg-emerald-400"
      : good >= 40
        ? "bg-amber-400"
        : "bg-red-500";
  const textColor =
    good >= 66
      ? "text-emerald-300"
      : good >= 40
        ? "text-amber-300"
        : "text-red-400";

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between">
        <span className="hal-mono text-[10px] tracking-widest text-neutral-500 uppercase">
          {label}
        </span>
        <span className={cn("hal-mono text-[11px]", textColor)}>
          {Math.round(value)}
          {suffix}
        </span>
      </div>
      <div className="h-1.5 w-full border border-white/10 bg-white/5">
        <div
          className={cn("h-full transition-all duration-500", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── HUD button ─────────────────────────────────────────────────────────────

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
          "border-red-500/60 bg-red-500/10 text-red-300 hover:border-red-400 hover:bg-red-500/25 hover:text-red-100 hover:shadow-[0_0_18px_rgba(255,42,30,0.35)]",
        variant === "ghost" &&
          "border-white/20 bg-transparent text-neutral-400 hover:border-white/50 hover:text-white",
        variant === "danger" &&
          "border-amber-400/60 bg-amber-400/10 text-amber-300 hover:border-amber-300 hover:bg-amber-400/20",
        disabled &&
          "cursor-not-allowed border-white/10 bg-transparent text-neutral-600 hover:shadow-none",
        className
      )}
    >
      {children}
    </button>
  );
}
