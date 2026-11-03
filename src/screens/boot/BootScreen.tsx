"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Lissajous } from "@/components/common/Lissajous";
import { HudButton } from "@/components/common/HudPanel";
import { TypeLine } from "@/components/common/TypeLine";
import { halcyonAudio } from "@/lib/mission/audio";
import { HALCYON_BOOT, HALCYON_BOOT_READY } from "@/lib/mission/halcyon";

// ─── Phase 0 — cold start: the boot log scrolls in, then HALCYON takes over ─
// The impact prologue that used to play here moved to the intro title card.

export function BootScreen({ onInitiate }: { onInitiate: () => void }) {
  const [step, setStep] = useState(0); // 0 boot log, 1 HALCYON online, 2 go
  const [lines, setLines] = useState(0); // boot log lines revealed so far
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    // the log items scroll in one after another; the last one types itself out
    for (let i = 0; i < HALCYON_BOOT.length; i++) {
      timers.current.push(setTimeout(() => setLines(i + 1), 240 + i * 260));
    }
    const last = HALCYON_BOOT[HALCYON_BOOT.length - 1];
    const logDone =
      240 + HALCYON_BOOT.length * 260 + last.length * 16 + 500;
    const t1 = setTimeout(() => setStep(1), logDone);
    const t2 = setTimeout(
      () => setStep(2),
      logDone + HALCYON_BOOT_READY.length * 26 + 900
    );
    timers.current.push(t1, t2);
    return () => timers.current.forEach(clearTimeout);
  }, []);

  const skip = () => {
    timers.current.forEach(clearTimeout);
    setLines(HALCYON_BOOT.length);
    setStep(2);
  };

  return (
    <div className="relative flex min-h-[calc(100vh-8.5rem)] items-center justify-center px-4 py-8">
      <button
        onClick={skip}
        className="hal-mono absolute right-4 top-0 border border-ink/20 px-3 py-1.5 text-[10px] tracking-[0.25em] text-neutral-500 hover:border-ink/50 hover:text-ink"
        aria-label="Skip boot sequence"
      >
        SKIP ▸
      </button>

      <div className="w-full max-w-3xl space-y-6">
        {/* ── title block ── */}
        <div className="fade-in text-center">
          <div className="hal-mono mb-2 text-[10px] tracking-[0.5em] text-phos/70">
            SIERRA OUTPOST · 1994 · RECREATION
          </div>
          <h1 className="hal-display glow-ink text-4xl font-normal tracking-[0.32em] text-ink sm:text-6xl">
            OUTPOST
          </h1>
          <div className="hal-mono mt-3 text-[10px] tracking-[0.4em] text-neutral-500 sm:text-xs">
            MISSION START SEQUENCE · SEED SHIP{" "}
            <span className="text-amber-300">EXODUS</span> · SOL ORBIT
          </div>
        </div>

        {/* ── boot log — scrolls in, then rolls up out of the way ── */}
        <div
          className={cn(
            "overflow-hidden border border-ink/10 bg-black/50 transition-all duration-700 ease-in-out",
            step >= 1
              ? "max-h-0 -mt-6 border-transparent p-0 opacity-0"
              : "max-h-80 p-4"
          )}
        >
          <div className="hal-mono space-y-1 text-[11px] leading-relaxed">
            {HALCYON_BOOT.map((line, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-neutral-600">
                  [{String(i).padStart(2, "0")}]
                </span>
                {step === 0 && i === lines - 1 && i === HALCYON_BOOT.length - 1 ? (
                  <TypeLine
                    text={line}
                    speed={16}
                    tick
                    cursor={false}
                    className="text-neutral-300"
                  />
                ) : (
                  <span
                    className={cn(
                      "text-neutral-300 transition-opacity duration-300",
                      i < lines ? "opacity-100" : "opacity-0"
                    )}
                  >
                    {line}
                  </span>
                )}
              </div>
            ))}
            {step >= 1 && (
              <div className="flex gap-2">
                <span className="text-phos/80">[OK]</span>
                <span className="text-phos">
                  ALL SUBSYSTEMS — GO FOR SEQUENCE
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── HALCYON comes online — neural pattern on a scope ── */}
        {step >= 1 && (
          <div className="fade-up flex flex-col items-center gap-4">
            <Lissajous size={188} label="HALCYON MK IX — NEURAL PATTERN — STABLE" />
            <div className="hal-mono min-h-8 max-w-xl text-center text-xs text-neutral-300 sm:text-sm">
              <TypeLine
                text={HALCYON_BOOT_READY}
                speed={26}
                startDelay={500}
                onDone={() => halcyonAudio.confirm()}
              />
            </div>
          </div>
        )}

        {/* ── initiate ── */}
        {step >= 2 && (
          <div className="fade-up flex flex-col items-center gap-3">
            <HudButton onClick={onInitiate} className="animate-pulse px-8">
              ▸ INITIATE MISSION START SEQUENCE
            </HudButton>
            <p className="hal-mono text-[10px] tracking-widest text-neutral-600">
              AUDIO ENABLES ON FIRST INTERACTION · HEADPHONES ADVISED
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
