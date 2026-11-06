"use client";

import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { HudPanel } from "./HudPanel";

// ─── HUD dialog — instrument-style modal over the console ────────────────────
// Backdrop click and Escape both dismiss. The panel is a HudPanel so the
// chrome (corner brackets, header strip, tick ruler) stays identical to the
// rest of the console; children own their internal scrolling.

export function HudDialog({
  title,
  code,
  accent = "phos",
  onClose,
  children,
  className,
}: {
  title: string;
  code?: string;
  accent?: "white" | "phos" | "amber" | "red";
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fade-in fixed inset-0 z-[75] flex items-center justify-center bg-black/70 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <HudPanel
        title={title}
        code={code}
        accent={accent}
        className={cn(
          "flex max-h-[80dvh] w-[min(560px,94vw)] flex-col bg-black/95",
          className
        )}
        bodyClassName="flex min-h-0 flex-1 flex-col p-0"
      >
        {children}
      </HudPanel>
    </div>
  );
}
