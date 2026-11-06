"use client";

import { useState } from "react";
import type { Planet, StarSystem } from "@/lib/mission/types";
import type { EquipmentItem } from "@/lib/mission/types";
import { CARGO_CAPACITY_T } from "@/lib/mission/equipment";
import { transitYears } from "@/lib/mission/stars";
import { computePrognosis } from "@/lib/mission/engine";
import { HudPanel, DataRow, HudButton } from "@/components/common/HudPanel";
import { PlanetScan } from "@/components/common/PlanetScan";
import { Lissajous } from "@/components/common/Lissajous";
import { TypeLine } from "@/components/common/TypeLine";
import { halcyonAudio } from "@/lib/mission/audio";
import { HALCYON_LAUNCH_FINAL, HALCYON_LAUNCH_OVER, HALCYON_PROFILE_OPEN } from "@/lib/mission/halcyon";
import { cn } from "@/lib/utils";

export function MissionProfile({
  star,
  planet,
  equipment,
  hasProbe,
  onSpeak,
  onRestart,
}: {
  star: StarSystem;
  planet: Planet | null;
  equipment: EquipmentItem[];
  hasProbe: boolean;
  onSpeak: (line: string) => void;
  onRestart: () => void;
}) {
  const [launched, setLaunched] = useState(false);
  const [finalStage, setFinalStage] = useState(0);
  const prognosis = computePrognosis(planet, star, equipment, hasProbe);
  const mass = equipment.reduce((a, e) => a + e.massT, 0);
  const hasScience = equipment.some((e) => e.id === "science");

  const gradeColor =
    prognosis.score >= 78
      ? "text-phos border-phos/60"
      : prognosis.score >= 62
        ? "text-amber-200 border-amber-400/60"
        : prognosis.score >= 47
          ? "text-amber-300 border-amber-400/70"
          : "text-red-400 border-red-500/70";

  const launch = () => {
    halcyonAudio.confirm();
    setLaunched(true);
    onSpeak(HALCYON_LAUNCH_OVER);
    setTimeout(() => setFinalStage(1), 4200);
    setTimeout(() => setFinalStage(2), 7200);
  };

  return (
    <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[1fr_360px] lg:grid-rows-[minmax(0,1fr)]">
      {/* ── left: mission summary ── */}
      <div className="flex min-h-0 flex-col gap-3">
        <HudPanel title="Mission Profile" code="FINAL.01" accent="white" bodyClassName="p-0">
          <div className="grid gap-0 sm:grid-cols-2">
            <div className="border-b border-ink/10 p-4 sm:border-b-0 sm:border-r">
              <div className="hal-mono mb-2 text-[10px] tracking-widest text-neutral-500">
                DESTINATION
              </div>
              <div className="hal-display text-base tracking-[0.2em] text-ink">
                {star.name}
              </div>
              <div className="hal-mono mt-2 space-y-1 text-[11px] text-neutral-400">
                <div>{star.distanceLy.toFixed(2)} LY · {star.spectral}</div>
                <div>TRANSIT {Math.round(transitYears(star))} YR @ 0.1 C</div>
                <div>FLARE RISK: {star.flareRisk}</div>
              </div>
            </div>
            <div className="p-4">
              <div className="hal-mono mb-2 text-[10px] tracking-widest text-neutral-500">
                LANDING SITE
              </div>
              {planet ? (
                <>
                  <div className="hal-display text-base tracking-[0.2em] text-ink">
                    {planet.designation}
                  </div>
                  <div className="hal-mono mt-2 space-y-1 text-[11px] text-neutral-400">
                    <div>
                      {planet.orbitAu.toFixed(2)} AU ·{" "}
                      {planet.massEarth.toFixed(1)} M⊕
                    </div>
                    {hasProbe ? (
                      <div>
                        {planet.gravityG.toFixed(2)} G ·{" "}
                        {planet.tempC.toFixed(0)} °C ·{" "}
                        {planet.atmosphere.composition.split("·")[0].trim()}
                      </div>
                    ) : (
                      <div className="text-amber-300/80">
                        SURFACE CONDITIONS UNKNOWN — BLIND LANDING
                      </div>
                    )}
                    {planet.abioticRisk && hasProbe && (
                      <div className={hasScience ? "text-phos/80" : "text-amber-300/80"}>
                        {hasScience
                          ? "FREE O₂ UNRESOLVED — SCIENCE LANDER ABOARD FOR ASSAY"
                          : "FREE O₂ UNRESOLVED — QUARANTINE DOCTRINE, NO BIO-CABINET ABOARD"}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="hal-mono text-xs text-neutral-500">—</div>
              )}
            </div>
          </div>
        </HudPanel>

        <HudPanel
          title="Payload Manifest"
          code="FINAL.02"
          className="flex min-h-0 flex-1 flex-col"
          bodyClassName="flex min-h-0 flex-1 flex-col p-0"
        >
          <div className="hal-scroll min-h-0 flex-1 overflow-y-auto">
            {equipment.map((e) => (
              <div
                key={e.id}
                className="hal-mono flex items-baseline justify-between gap-3 border-b border-ink/5 px-3 py-1.5 text-[11px]"
              >
                <span className="text-neutral-300">
                  <span className="text-neutral-500">■</span> {e.name}
                </span>
                <span className="shrink-0 text-neutral-500">
                  <span className="text-phos">{e.massT}</span> T
                </span>
              </div>
            ))}
          </div>
          <div className="hal-mono flex justify-between border-t border-ink/10 px-3 py-2 text-[11px]">
            <span className="text-neutral-500">TOTAL MASS</span>
            <span className="text-neutral-200">
              {mass.toLocaleString()} / {CARGO_CAPACITY_T.toLocaleString()} T
            </span>
          </div>
        </HudPanel>
      </div>

      {/* ── right: prognosis ── */}
      <div className="flex min-h-0 flex-col gap-3">
        <HudPanel
          title="Colony Prognosis"
          code="SIM.4096"
          accent={prognosis.score >= 62 ? "phos" : prognosis.score >= 47 ? "amber" : "red"}
          className="flex min-h-0 flex-col"
          bodyClassName="flex min-h-0 flex-1 flex-col p-0"
        >
          <div className="hal-scroll min-h-0 flex-1 overflow-y-auto p-4">
            <div className="mb-4 flex items-end justify-between">
              <div>
                <div className="hal-display glow-ink text-4xl leading-none text-ink">
                  {prognosis.score}
                </div>
                <div className="hal-mono mt-1 text-[9px] tracking-widest text-neutral-500">
                  PROBABILITY INDEX / 100
                </div>
              </div>
              <div
                className={cn(
                  "hal-display border px-2.5 py-1.5 text-right text-xs tracking-[0.2em]",
                  gradeColor
                )}
              >
                {prognosis.grade}
              </div>
            </div>

            <div className="space-y-2">
              {prognosis.factors.map((f) => (
                <div key={f.label} className="space-y-1">
                  <div className="hal-mono flex justify-between text-[9px] tracking-widest text-neutral-500">
                    <span>{f.label}</span>
                    <span>
                      {f.value > 0 ? "+" : ""}
                      {f.value.toFixed(1)} / {f.max}
                    </span>
                  </div>
                  <div className="h-1 w-full border border-ink/10 bg-ink/5">
                    <div
                      className={cn(
                        "h-full",
                        f.value / f.max > 0.5
                          ? "bg-phos/70"
                          : f.value > 0
                            ? "bg-amber-400/70"
                            : "bg-red-500/70"
                      )}
                      style={{
                        width: `${Math.max(2, Math.min(100, (Math.max(f.value, 0) / f.max) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <p className="hal-mono mt-4 border-l-2 border-ink/30 pl-3 text-[10px] leading-relaxed text-neutral-400">
              {prognosis.verdict}
            </p>
          </div>
          <div className="space-y-2 border-t border-ink/10 p-3">
            <HudButton className="w-full" onClick={launch}>
              ▸ OUTPOST — MISSION START
            </HudButton>
            <HudButton variant="ghost" size="sm" className="w-full" onClick={onRestart}>
              ◂ REVISE MISSION FROM STAR SELECT
            </HudButton>
          </div>
        </HudPanel>

        {planet && (
          <HudPanel
            title="Final Approach Render"
            code="VLBI.STILL"
            className="flex min-h-32 flex-1 flex-col"
            bodyClassName="flex min-h-0 flex-1 overflow-hidden p-0"
          >
            <div className="min-h-0 flex-1 bg-black">
              <PlanetScan planet={planet} blind={!hasProbe} className="h-full w-full object-cover" />
            </div>
          </HudPanel>
        )}
      </div>

      {/* ── launch overlay — HALCYON signs off with the waveform ── */}
      {launched && (
        <div
          className="fade-in fixed inset-0 z-[90] flex flex-col items-center justify-center gap-6 bg-black px-4"
          role="dialog"
          aria-label="Mission launch"
        >
          <Lissajous size={208} label="HALCYON — SIGNING OFF" />
          <div className="hal-mono max-w-2xl text-center text-sm leading-relaxed text-neutral-200">
            {finalStage === 0 && (
              <TypeLine text={HALCYON_LAUNCH_OVER} speed={34} />
            )}
            {finalStage >= 1 && (
              <>
                <p className="mb-3 text-neutral-500">{HALCYON_LAUNCH_OVER}</p>
                <TypeLine
                  key="final"
                  text={HALCYON_LAUNCH_FINAL}
                  speed={30}
                />
              </>
            )}
          </div>
          {finalStage >= 2 && (
            <div className="fade-up flex flex-col items-center gap-3">
              <div className="hal-display glow-phos text-lg tracking-[0.35em] text-phos">
                GOOD LUCK, COMMANDER
              </div>
              <HudButton variant="ghost" onClick={onRestart}>
                ↺ RUN MISSION START AGAIN
              </HudButton>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
