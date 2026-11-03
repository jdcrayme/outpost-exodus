"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { IntroStarfield } from "./IntroStarfield";
import { IntroLogo } from "./IntroLogo";

// ─── Phase −1 — title card: the impact prologue, then the logo ────────────────
//
// The narration moved here from the boot screen (it was BOOT_PRELUDE) so the
// story is told once, cinematically, before the cold start. All pacing hangs
// off the three constants below — tune to taste.

const PROLOGUE: { year: string | null; text: string }[] = [
  {
    year: "2096",
    text: "Survey station Galileo detects a 1.4 km nickel-iron body on an Earth-crossing trajectory.",
  },
  { year: "2098", text: "Impact. The Pacific basin ignites. The gardens are gone." },
  { year: null, text: "One ship survived the construction collapse." },
  {
    year: null,
    text: "OUTPOST-class seed ship EXODUS — 207 sleepers, one machine mind, one chance.",
  },
  {
    year: null,
    text: "Destination: a nearby star. Payload: whatever fits. After that — a world, chosen from the dark.",
  },
];

const BEAT_MS = 2900; // per prologue line: fade in, hold, fade out
const LOGO_HOLD_MS = 3400; // the title card rests before handing off to boot
const OUT_MS = 500; // crossfade into the boot screen

export function IntroScreen({ onDone }: { onDone: () => void }) {
  const [beat, setBeat] = useState(0);
  const [visible, setVisible] = useState(false);
  const [logo, setLogo] = useState(false);
  const [out, setOut] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const beatMs = reduced ? 1500 : BEAT_MS;
    const T = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));

    PROLOGUE.forEach((_, i) => {
      const t0 = i * beatMs + 60;
      T(() => setBeat(i), t0);
      T(() => setVisible(true), t0 + 40);
      T(() => setVisible(false), t0 + beatMs - 520);
    });

    const tLogo = PROLOGUE.length * beatMs + 250;
    T(() => setLogo(true), tLogo);
    T(() => setOut(true), tLogo + LOGO_HOLD_MS);
    T(onDone, tLogo + LOGO_HOLD_MS + OUT_MS);

    return () => timers.current.forEach(clearTimeout);
  }, []);

  const skip = useCallback(() => {
    timers.current.forEach(clearTimeout);
    setOut(true);
    setTimeout(onDone, OUT_MS);
  }, [onDone]);

  // any key skips — the standard courtesy of every game intro
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      skip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [skip]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-[70] cursor-pointer overflow-hidden bg-[#030304] transition-opacity duration-500",
        out && "pointer-events-none opacity-0"
      )}
      onClick={skip}
    >
      <IntroStarfield className="absolute inset-0 h-full w-full" />

      {/* prologue — one line at a time, centre screen */}
      {!logo && (
        <div className="absolute inset-x-0 top-[38%] flex -translate-y-1/2 justify-center px-6">
          <div className="w-full max-w-2xl text-center">
            <div
              key={`y-${beat}`}
              className={cn(
                "hal-display mb-4 min-h-[1em] text-[11px] tracking-[0.6em] text-amber-300/90 transition-opacity duration-500",
                visible && PROLOGUE[beat].year ? "opacity-100" : "opacity-0"
              )}
            >
              {PROLOGUE[beat].year ?? "\u00A0"}
            </div>
            <p
              key={beat}
              className={cn(
                "hal-mono mx-auto max-w-xl text-balance text-[13px] leading-relaxed tracking-[0.08em] text-neutral-300 transition-all duration-500 sm:text-sm",
                visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
              )}
            >
              {PROLOGUE[beat].text}
            </p>
          </div>
        </div>
      )}

      {/* title card */}
      {logo && <IntroLogo className="absolute inset-0" />}

      <button
        onClick={skip}
        className="hal-mono absolute right-4 top-4 z-10 border border-ink/20 bg-black/40 px-3 py-1.5 text-[10px] tracking-[0.25em] text-neutral-500 transition-colors hover:border-ink/50 hover:text-ink"
        aria-label="Skip intro"
      >
        SKIP ▸
      </button>
    </div>
  );
}
