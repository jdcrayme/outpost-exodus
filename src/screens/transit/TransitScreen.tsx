"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Planet, StarSystem } from "@/lib/mission/types";
import { transitYears } from "@/lib/mission/stars";
import { transitEvents } from "@/lib/mission/events";
import { Lissajous } from "@/components/common/Lissajous";
import { halcyonAudio } from "@/lib/mission/audio";
import {
  HALCYON_ARRIVAL,
  HALCYON_BLIND_SURVEY,
  HALCYON_JOVIAN_LINE,
  HALCYON_KINETIC_LINE,
  HALCYON_MAGSAIL_LINE,
  HALCYON_SURVEY_DONE,
  halcyonApproach,
  halcyonTransit,
} from "@/lib/mission/halcyon";

// KaTeX + plate ship with the transit bundle, not the initial payload
const TransitPlot = dynamic(() => import("./TransitPlot"), { ssr: false });

// ─── Phase 3 — probe separation, then one continuous transit plate ───────────
// The plot owns the clock: departure, cruise, the magsail's long fall, the
// VLBI relay printing its findings as the light catches up, and the camera
// zoom down the range ladder into the destination system — no cuts. This
// screen is just the shell: separation card, HALCYON's lines, and the exit.

export function TransitScreen({
  star,
  planets,
  hasProbe,
  payloadMassT,
  equipment,
  onDone,
  onSpeak,
}: {
  star: StarSystem;
  planets: Planet[];
  hasProbe: boolean;
  payloadMassT: number;
  equipment: string[];
  onDone: () => void;
  onSpeak: (line: string) => void;
}) {
  const totalYears = transitYears(star);
  const events = useMemo(() => transitEvents(star, equipment), [star, equipment]);
  const [step, setStep] = useState(0); // 0 separation, 1 transit plate, 2 gone
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
    at(2900, () => onSpeak(halcyonTransit(star, Math.round(totalYears))));
    at(3200, () => setStep(1));

    timers.current = all;
    return () => all.forEach(clearTimeout);
  }, []);

  // cruise chatter, once the plate is up
  useEffect(() => {
    if (step !== 1) return;
    const all: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => all.push(setTimeout(fn, ms));

    at(2600, () => onSpeak(HALCYON_JOVIAN_LINE));
    at(5600, () => onSpeak(HALCYON_KINETIC_LINE));
    at(7800, () => {
      // one mid-transit event, spoken — the decades are not kind
      const spoken = events.find((e) => e.speech);
      if (spoken?.speech) onSpeak(spoken.speech);
    });

    timers.current.push(...all);
    return () => all.forEach(clearTimeout);
  }, [step]);

  const finish = () => {
    if (!doneRef.current) {
      doneRef.current = true;
      halcyonAudio.confirm();
      onDone();
    }
  };

  const skip = () => {
    timers.current.forEach(clearTimeout);
    setStep(2); // unmounts the plate — its clock cleans up after itself
    finish();
  };

  return (
    <div className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-3 pb-4 pt-10">
      <button
        onClick={skip}
        className="hal-mono absolute right-4 top-3 border border-ink/20 bg-black/60 px-3 py-1.5 text-[10px] tracking-[0.25em] text-neutral-500 hover:border-ink/50 hover:text-ink"
        aria-label="Skip transit"
      >
        SKIP ▸
      </button>

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

      {/* ── the transit — one plate, one camera ── */}
      {step === 1 && (
        <div className="fade-up flex h-full min-h-0 w-full flex-1 flex-col">
          <TransitPlot
            star={star}
            planets={planets}
            hasProbe={hasProbe}
            payloadMassT={payloadMassT}
            onPrint={() => halcyonAudio.ping()}
            onMagsail={() => onSpeak(HALCYON_MAGSAIL_LINE)}
            onApproach={() => onSpeak(halcyonApproach(star))}
            onArrival={() => onSpeak(HALCYON_ARRIVAL)}
            onSurveyDone={() =>
              onSpeak(hasProbe ? HALCYON_SURVEY_DONE : HALCYON_BLIND_SURVEY)
            }
            onDone={finish}
          />
        </div>
      )}
    </div>
  );
}
