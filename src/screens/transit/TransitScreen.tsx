"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Planet, StarSystem } from "@/lib/mission/types";
import { transitYears } from "@/lib/mission/stars";
import { missionState } from "@/lib/mission/astro";
import { Lissajous } from "@/components/common/Lissajous";
import { HudButton } from "@/components/common/HudPanel";
import { halcyonAudio } from "@/lib/mission/audio";
import {
  HALCYON_ARRIVAL,
  HALCYON_BLIND_SURVEY,
  HALCYON_JOVIAN_LINE,
  HALCYON_KINETIC_LINE,
  HALCYON_SURVEY_DONE,
  halcyonTransit,
} from "@/lib/mission/halcyon";
import { cn } from "@/lib/utils";

// KaTeX + plate ship with the transit bundle, not the initial payload
const TransitPlot = dynamic(() => import("./TransitPlot"), { ssr: false });

// ─── Phase 3 — probe launch, decades of transit, arrival survey ─────────────

export function TransitScreen({
  star,
  planets,
  hasProbe,
  payloadMassT,
  onDone,
  onSpeak,
}: {
  star: StarSystem;
  planets: Planet[];
  hasProbe: boolean;
  payloadMassT: number;
  onDone: () => void;
  onSpeak: (line: string) => void;
}) {
  const totalYears = transitYears(star);
  const [step, setStep] = useState(0); // 0 sep, 1 transit, 2 arrival, 3 survey, 4 complete
  const [years, setYears] = useState(0);
  const [signals, setSignals] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const doneRef = useRef(false);

  useEffect(() => {
    const all: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => all.push(setTimeout(fn, ms));

    // step 0 — probe separation
    at(400, () => {
      halcyonAudio.confirm();
      onSpeak(
        hasProbe
          ? "VLBI probe separation confirmed. The little courier will outrun us by thirty years."
          : "No survey probe aboard. I hope you know something about this system that I do not, Commander."
      );
    });
    at(3400, () => setStep(1));
    at(3800, () => onSpeak(halcyonTransit(star, Math.round(totalYears))));
    at(6000, () => onSpeak(HALCYON_JOVIAN_LINE));
    at(8800, () => onSpeak(HALCYON_KINETIC_LINE));

    // step 1 — transit counting (7 s of screen time = decades)
    at(11000, () => {
      setStep(2);
      halcyonAudio.ping();
      onSpeak(HALCYON_ARRIVAL);
    });

    // step 2 — arrival
    at(15000, () => setStep(3));

    // step 3 — survey signals
    if (hasProbe) {
      planets.forEach((_, i) => {
        at(15600 + i * 850, () => {
          setSignals(i + 1);
          halcyonAudio.ping();
        });
      });
      at(15600 + planets.length * 850 + 900, () => {
        setStep(4);
        halcyonAudio.confirm();
        onSpeak(HALCYON_SURVEY_DONE);
      });
      at(16500 + planets.length * 850 + 2400, () => {
        if (!doneRef.current) {
          doneRef.current = true;
          onDone();
        }
      });
    } else {
      at(17200, () => {
        halcyonAudio.scan();
        setSignals(planets.length);
      });
      at(20000, () => {
        setStep(4);
        onSpeak(HALCYON_BLIND_SURVEY);
      });
      at(23000, () => {
        if (!doneRef.current) {
          doneRef.current = true;
          onDone();
        }
      });
    }

    timers.current = all;
    return () => all.forEach(clearTimeout);
  }, []);

  // year counter during transit
  useEffect(() => {
    if (step !== 1) return;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 6800);
      setYears(p * totalYears);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [step, totalYears]);

  const skip = () => {
    (timers.current as ReturnType<typeof setTimeout>[]).forEach(clearTimeout);
    if (!doneRef.current) {
      doneRef.current = true;
      halcyonAudio.confirm();
      onDone();
    }
  };

  const remainingLy = missionState(star.distanceLy, years).remainingLy;
  const landable = planets.filter((p) => p.landable).length;

  return (
    <div className="relative mx-auto flex min-h-[calc(100vh-8.5rem)] max-w-5xl flex-col items-center justify-center px-4 py-8">
      <button
        onClick={skip}
        className="hal-mono absolute right-4 top-0 border border-ink/20 px-3 py-1.5 text-[10px] tracking-[0.25em] text-neutral-500 hover:border-ink/50 hover:text-ink"
        aria-label="Skip transit"
      >
        SKIP ▸
      </button>

      <div className="w-full space-y-8">
        {/* ── separation ── */}
        {step === 0 && (
          <div className="fade-up flex flex-col items-center gap-6 text-center">
            <Lissajous
              size={148}
              a={2}
              b={3}
              label={hasProbe ? "COURIER TELEMETRY — LINK NOMINAL" : "TELEMETRY — LINK LIMITED"}
            />
            <div className="hal-display text-xl tracking-[0.3em] text-ink sm:text-2xl">
              {hasProbe ? "VLBI PROBE SEPARATION" : "FINAL MANIFEST REVIEW"}
            </div>
            <div className="hal-mono text-xs text-neutral-400">
              {hasProbe
                ? "COURIER STAGE AWAY — BURN 0.135 C — TELEMETRY LINK NOMINAL"
                : "NO SURVEY PROBE ABOARD — TELEMETRY WILL BE LIMITED"}
            </div>
          </div>
        )}

        {/* ── transit ── */}
        {step >= 1 && step < 3 && (
          <div className="fade-up space-y-4 sm:space-y-5">
            <div className="text-center">
              <div className="hal-display text-lg tracking-[0.3em] text-ink sm:text-2xl">
                INTERSTELLAR TRANSIT
              </div>
              <div className="hal-mono mt-2 text-[10px] tracking-[0.4em] text-neutral-400">
                DESTINATION {star.name} · JOVIAN DEPARTURE SOLUTION · CRUISE 0.100 C
              </div>
            </div>

            <div className="mx-auto grid max-w-2xl grid-cols-3 gap-3 border border-ink/10 bg-black/40 p-3 text-center sm:p-4">
              <div>
                <div className="hal-display glow-phos text-xl text-phos sm:text-3xl">
                  {years.toFixed(1)}
                </div>
                <div className="hal-mono mt-1 text-[9px] tracking-widest text-neutral-500">
                  YEARS ELAPSED
                </div>
              </div>
              <div>
                <div className="hal-display text-xl text-ink sm:text-3xl">
                  {remainingLy.toFixed(2)}
                </div>
                <div className="hal-mono mt-1 text-[9px] tracking-widest text-neutral-500">
                  LY REMAINING
                </div>
              </div>
              <div>
                <div className="hal-display text-xl text-ink sm:text-3xl">
                  207
                </div>
                <div className="hal-mono mt-1 text-[9px] tracking-widest text-neutral-500">
                  CREW · COLD SLEEP
                </div>
              </div>
            </div>

            <TransitPlot star={star} payloadMassT={payloadMassT} years={years} />

            <div className="mx-auto max-w-4xl">
              <div className="relative h-2 border border-ink/15 bg-ink/5">
                <div
                  className="h-full bg-ink/85 transition-[width] duration-100"
                  style={{ width: `${(years / totalYears) * 100}%` }}
                />
              </div>
              <div className="hal-mono mt-1.5 flex justify-between text-[9px] tracking-widest text-neutral-600">
                <span>TJI BURN 2098.274</span>
                <span>ARRIVAL {Math.round(2098.274 + totalYears)}</span>
              </div>
            </div>
          </div>
        )}

        {/* ── arrival + survey ── */}
        {step >= 3 && (
          <div className="fade-up space-y-6">
            <div className="text-center">
              <div className="hal-display text-xl tracking-[0.3em] text-ink sm:text-2xl">
                {hasProbe ? "VLBI SURVEY RELAY" : "PASSIVE GRAVIMETRIC SCAN"}
              </div>
              <div className="hal-mono mt-2 text-[10px] tracking-[0.4em] text-neutral-400">
                SYSTEM ENTRY — {star.name} — {new Date().getFullYear() + Math.round(totalYears) - 2026 + 2098} SHIP CALENDAR
              </div>
            </div>

            <div className="mx-auto grid max-w-3xl grid-cols-2 gap-2 sm:grid-cols-3">
              {planets.map((p, i) => {
                const found = i < signals;
                return (
                  <div
                    key={p.id}
                    className={cn(
                      "hal-mono border px-3 py-3 text-center transition-all duration-500",
                      found
                        ? "border-phos/60 bg-phos/10 opacity-100"
                        : "border-ink/10 opacity-30"
                    )}
                  >
                    <div
                      className={cn(
                        "text-xs tracking-widest",
                        found ? "text-phos" : "text-neutral-600"
                      )}
                    >
                      {found ? p.designation : "——"}
                    </div>
                    <div className="mt-1 text-[9px] text-neutral-500">
                      {found
                        ? `${p.massEarth.toFixed(1)} M⊕ · ${p.orbitAu.toFixed(2)} AU`
                        : "ACQUIRING…"}
                    </div>
                  </div>
                );
              })}
            </div>

            {step >= 4 && (
              <div className="fade-in text-center">
                <div className="hal-mono glow-phos text-xs text-phos">
                  {hasProbe
                    ? `SURVEY COMPLETE — ${planets.length} WORLDS · ${landable} LANDABLE`
                    : "MASS DETECTION ONLY — SURFACE CONDITIONS UNKNOWN"}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
