"use client";

import { useEffect, useRef, useState } from "react";
import { Lissajous } from "./Lissajous";
import { HudButton } from "./HudPanel";
import { TypeLine } from "./TypeLine";
import { halAudio } from "@/lib/mission/audio";
import { BOOT_PRELUDE, HAL_BOOT, HAL_BOOT_READY } from "@/lib/mission/hal";

// ─── Phase 0 — cold start: diagnostics, the 9000 comes online, prelude ────────

export function BootScreen({ onInitiate }: { onInitiate: () => void }) {
  const [step, setStep] = useState(0); // 0 log, 1 eye+ready, 2 prelude, 3 go
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const t1 = setTimeout(() => setStep(1), HAL_BOOT.length * 420 + 600);
    const t2 = setTimeout(() => setStep(2), HAL_BOOT.length * 420 + 2300);
    const t3 = setTimeout(() => setStep(3), HAL_BOOT.length * 420 + 2300 + BOOT_PRELUDE.length * 2100 + 800);
    timers.current.push(t1, t2, t3);
    return () => timers.current.forEach(clearTimeout);
  }, []);

  const skip = () => {
    timers.current.forEach(clearTimeout);
    setStep(3);
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

        {/* ── boot log ── */}
        <div className="border border-ink/10 bg-black/50 p-4">
          <div className="hal-mono space-y-1 text-[11px] leading-relaxed">
            {HAL_BOOT.slice(0, step === 0 ? undefined : HAL_BOOT.length).map(
              (line, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-neutral-600">
                    [{String(i).padStart(2, "0")}]
                  </span>
                  {step === 0 && i === HAL_BOOT.length - 1 ? (
                    <TypeLine
                      text={line}
                      speed={16}
                      tick
                      cursor={false}
                      className="text-neutral-300"
                    />
                  ) : (
                    <span className="text-neutral-300">{line}</span>
                  )}
                </div>
              )
            )}
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

        {/* ── the 9000 comes online — neural pattern on a scope ── */}
        {step >= 1 && (
          <div className="fade-up flex flex-col items-center gap-4">
            <Lissajous size={188} label="9000 SERIES — NEURAL PATTERN — STABLE" />
            <div className="hal-mono min-h-8 max-w-xl text-center text-xs text-neutral-300 sm:text-sm">
              <TypeLine
                text={HAL_BOOT_READY}
                speed={26}
                startDelay={500}
                onDone={() => halAudio.confirm()}
              />
            </div>
          </div>
        )}

        {/* ── prelude ── */}
        {step >= 2 && (
          <div className="fade-up border-l-2 border-ink/25 pl-4">
            <div className="hal-mono space-y-2 text-[11px] leading-relaxed text-neutral-400 sm:text-xs">
              {BOOT_PRELUDE.slice(0, step === 2 ? undefined : undefined).map(
                (line, i) =>
                  step === 2 && i === BOOT_PRELUDE.length - 1 ? (
                    <p key={i}>
                      <TypeLine text={line} speed={20} cursor />
                    </p>
                  ) : (
                    <p key={i}>{line}</p>
                  )
              )}
            </div>
          </div>
        )}

        {/* ── initiate ── */}
        {step >= 3 && (
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
