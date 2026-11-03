"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { halAudio } from "@/lib/mission/audio";

// ─── Typewriter line — prints text progressively, optional tick per char ────

export function TypeLine({
  text,
  className,
  speed = 18,
  tick = false,
  cursor = true,
  onDone,
  startDelay = 0,
}: {
  text: string;
  className?: string;
  speed?: number;
  tick?: boolean;
  cursor?: boolean;
  onDone?: () => void;
  startDelay?: number;
}) {
  const [shown, setShown] = useState(0);

  // reset when the text prop changes (guarded render-time adjustment)
  const [prevText, setPrevText] = useState(text);
  if (prevText !== text) {
    setPrevText(text);
    setShown(0);
  }

  useEffect(() => {
    if (!text) return;
    let i = 0;
    let interval: ReturnType<typeof setInterval> | null = null;
    const timeout = setTimeout(() => {
      interval = setInterval(() => {
        i += 1;
        setShown(i);
        if (tick && i % 3 === 0) halAudio.tick();
        if (i >= text.length) {
          if (interval) clearInterval(interval);
          onDone?.();
        }
      }, speed);
    }, startDelay);
    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, [text, speed, startDelay]);

  const done = shown >= text.length;
  return (
    <span
      className={cn(done && !cursor && "hal-cursor-none", className)}
      aria-label={text}
    >
      {text.slice(0, shown)}
      {!done && cursor && (
        <span className="hal-cursor" aria-hidden="true" />
      )}
      {done && cursor && (
        <span
          className="ml-1 inline-block h-[1em] w-[0.55em] translate-y-[0.15em] bg-phos/80"
          aria-hidden="true"
        />
      )}
    </span>
  );
}

// ─── Full-screen CRT overlay: scanlines + vignette + refresh band ───────────

export function CrtOverlay() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-[80] crt-flicker"
      aria-hidden="true"
    >
      <div className="absolute inset-0 crt-overlay" />
      <div className="absolute inset-0 crt-band" />
      <div className="absolute inset-0 crt-vignette" />
    </div>
  );
}
