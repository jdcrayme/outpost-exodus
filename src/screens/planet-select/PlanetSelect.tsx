"use client";

import { useState } from "react";
import type { Planet, StarSystem } from "@/lib/mission/types";
import { HudPanel, DataRow, HudButton, Gauge } from "@/components/common/HudPanel";
import { OrbitMap } from "./OrbitMap";
import { PlanetScan } from "@/components/common/PlanetScan";
import { halcyonAudio } from "@/lib/mission/audio";
import { halcyonPlanetSelected } from "@/lib/mission/halcyon";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<Planet["kind"], string> = {
  TERRESTRIAL: "TERRESTRIAL",
  GAS_GIANT: "GAS GIANT",
  ICE_GIANT: "ICE GIANT",
  ICE_WORLD: "ICE WORLD",
  SCORCHED: "SCORCHED ROCK",
};

function ratingColor(r: string) {
  if (r.startsWith("A") || r.startsWith("B")) return "text-phos border-phos/60";
  if (r.startsWith("C")) return "text-amber-300 border-amber-400/60";
  return "text-red-400 border-red-500/60";
}

function Redacted({ label }: { label: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-ink/5 py-1">
      <span className="hal-mono text-[10px] tracking-widest text-neutral-500 uppercase">
        {label}
      </span>
      <span className="hal-mono text-right text-[11px] tracking-widest text-neutral-600">
        ▮▮▮▮ UNRESOLVED
      </span>
    </div>
  );
}

export function PlanetSelect({
  star,
  planets,
  hasProbe,
  onCommit,
  onSpeak,
}: {
  star: StarSystem;
  planets: Planet[];
  hasProbe: boolean;
  onCommit: (planetId: string) => void;
  onSpeak: (line: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const planet = planets.find((p) => p.id === selected) ?? null;

  const pick = (id: string) => {
    setSelected(id);
    const p = planets.find((x) => x.id === id);
    if (p) {
      halcyonAudio.ping();
      onSpeak(halcyonPlanetSelected(p, !hasProbe));
    }
  };

  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_390px]">
      {/* ── left: chart + world list ── */}
      <div className="space-y-3">
        <HudPanel
          title={`System Chart — ${star.name}`}
          code="SURV.02 / CHART"
          bodyClassName="p-0"
        >
          <div className="h-[340px] sm:h-[420px] lg:h-[calc(100vh-26rem)] lg:min-h-[400px]">
            <OrbitMap
              star={star}
              planets={planets}
              selectedId={selected}
              onSelect={pick}
            />
          </div>
        </HudPanel>

        <HudPanel
          title="Candidate Worlds"
          code={hasProbe ? "VLBI DATA" : "GRAVIMETRIC ONLY"}
          accent={hasProbe ? "phos" : "red"}
          bodyClassName="p-0"
        >
          <div className="hal-scroll max-h-52 overflow-y-auto">
            {planets.map((p) => {
              const isSel = p.id === selected;
              return (
                <button
                  key={p.id}
                  onClick={() => pick(p.id)}
                  aria-pressed={isSel}
                  className={cn(
                    "flex w-full items-center gap-3 border-b border-ink/5 px-3 py-2.5 text-left transition-colors hover:bg-ink/5",
                    isSel && "hud-row-selected"
                  )}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      background: p.color,
                      boxShadow: `0 0 8px ${p.color}88`,
                    }}
                    aria-hidden="true"
                  />
                  <span
                    className={cn(
                      "hal-mono w-24 shrink-0 text-xs tracking-widest",
                      isSel ? "text-ink" : "text-neutral-200"
                    )}
                  >
                    {p.designation}
                  </span>
                  <span className="hal-mono hidden shrink-0 text-[10px] text-neutral-500 sm:block">
                    {KIND_LABEL[p.kind]}
                  </span>
                  <span className="hal-mono ml-auto shrink-0 text-[10px] text-neutral-500">
                    {p.orbitAu.toFixed(2)} AU · {p.massEarth < 20 ? `${p.massEarth.toFixed(1)} M⊕` : `${(p.massEarth / 317.8).toFixed(1)} M♃`}
                  </span>
                  {hasProbe ? (
                    <span
                      className={cn(
                        "hal-mono shrink-0 border px-1.5 text-[10px]",
                        ratingColor(p.rating)
                      )}
                    >
                      {p.rating}
                    </span>
                  ) : (
                    <span className="hal-mono shrink-0 border border-amber-400/40 px-1.5 text-[9px] text-amber-400/70">
                      ??
                    </span>
                  )}
                  {p.inHabitableZone && (
                    <span className="hal-mono hidden shrink-0 border border-amber-400/50 px-1 text-[9px] text-amber-300 md:block">
                      HZ
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </HudPanel>
      </div>

      {/* ── right: dossier ── */}
      <div className="lg:sticky lg:top-3 lg:self-start">
        <HudPanel
          title="Landing Dossier"
          code={planet ? `DOSS-${planet.designation}` : "DOSS-—"}
          bodyClassName="p-0"
          className="h-full"
        >
          {!planet ? (
            <div className="hal-mono flex h-full min-h-64 flex-col items-center justify-center gap-3 p-6 text-center text-[11px] text-neutral-600">
              <span className="reticle-spin text-2xl text-neutral-400/60">◎</span>
              AWAITING WORLD SELECTION
            </div>
          ) : (
            <div className="hal-scroll max-h-[32rem] overflow-y-auto lg:max-h-[calc(100vh-26rem)]">
              {/* scan render */}
              <div className="relative border-b border-ink/10 bg-black">
                <PlanetScan planet={planet} blind={!hasProbe} />
                <div className="hal-mono absolute left-2 top-2 text-[9px] tracking-widest text-phos/80">
                  {hasProbe ? "VLBI RENDER · LIVE" : "RECEIVER STATIC"}
                </div>
              </div>

              <div className="p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <h3 className="hal-display text-sm tracking-[0.2em] text-ink">
                      {planet.designation}
                    </h3>
                    <div className="hal-mono mt-0.5 text-[10px] tracking-widest text-neutral-500">
                      {KIND_LABEL[planet.kind]}
                      {planet.inHabitableZone && (
                        <span className="ml-2 text-amber-300">· HABITABLE ZONE</span>
                      )}
                    </div>
                  </div>
                  {hasProbe && (
                    <div className="text-right">
                      <div className="hal-display glow-ink text-2xl leading-none text-ink">
                        {planet.suitability}
                      </div>
                      <div
                        className={cn(
                          "hal-mono mt-1 inline-block border px-1.5 text-[10px]",
                          ratingColor(planet.rating)
                        )}
                      >
                        CLASS {planet.rating}
                      </div>
                    </div>
                  )}
                </div>

                {!hasProbe && (
                  <div className="hal-mono mb-3 border border-red-500/40 bg-red-500/10 p-2.5 text-[10px] leading-relaxed text-red-300">
                    ⚠ BLIND LANDING PROTOCOL — NO SURVEY TELEMETRY. ONLY MASS AND
                    ORBIT ARE KNOWN. SURFACE CONDITIONS ARE A COIN TOSS IN THE
                    DARK.
                  </div>
                )}

                <DataRow label="ORBIT" value={`${planet.orbitAu.toFixed(3)} AU`} />
                <DataRow label="MASS" value={`${planet.massEarth.toFixed(2)} M⊕`} />
                {hasProbe ? (
                  <>
                    <DataRow
                      label="RADIUS"
                      value={`${planet.radiusKm.toLocaleString()} KM`}
                    />
                    <DataRow
                      label="SURFACE GRAVITY"
                      value={`${planet.gravityG.toFixed(2)} g`}
                      warn={Math.abs(planet.gravityG - 1) > 0.5}
                    />
                    <DataRow
                      label="DAY LENGTH"
                      value={
                        planet.tidalLock
                          ? "TIDALLY LOCKED"
                          : `${planet.dayHours.toFixed(1)} H`
                      }
                    />
                    <DataRow
                      label="MEAN TEMP"
                      value={`${planet.tempC.toFixed(0)} °C (±${Math.round(planet.tempSwingC / 2)})`}
                      warn={planet.tempC < -20 || planet.tempC > 60}
                    />
                    <DataRow
                      label="ATMOSPHERE"
                      value={
                        planet.atmosphere.pressureAtm < 0
                          ? "— NO SURFACE —"
                          : `${planet.atmosphere.composition} · ${planet.atmosphere.pressureAtm.toFixed(2)} ATM`
                      }
                      warn={!planet.atmosphere.breathable}
                    />
                    <DataRow
                      label="HYDROSPHERE"
                      value={`${Math.round(planet.waterFraction * 100)}% ${
                        planet.tempC < 0 ? "ICE" : "LIQUID"
                      }`}
                    />
                    <DataRow label="MOONS" value={planet.moons} />

                    <div className="mt-4 grid grid-cols-2 justify-items-center gap-2">
                      <Gauge label="MINERAL DENSITY" value={planet.mineralDensity} size={124} />
                      <Gauge label="SEISMIC ACTIVITY" value={planet.seismic} invert size={124} />
                      <Gauge label="RADIATION" value={planet.radiation} invert size={124} />
                      <Gauge label="SUITABILITY" value={planet.suitability} size={124} />
                    </div>
                  </>
                ) : (
                  <>
                    <Redacted label="RADIUS" />
                    <Redacted label="GRAVITY" />
                    <Redacted label="TEMPERATURE" />
                    <Redacted label="ATMOSPHERE" />
                    <Redacted label="HYDROSPHERE" />
                    <Redacted label="MINERALS" />
                  </>
                )}

                {hasProbe && (
                  <p className="hal-mono mt-3 border-l border-phos/40 pl-2.5 text-[10px] leading-relaxed text-neutral-400">
                    {planet.notes}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="border-t border-ink/10 p-3">
            <HudButton
              disabled={!planet || !planet.landable}
              className="w-full"
              onClick={() => {
                if (planet) {
                  halcyonAudio.confirm();
                  onCommit(planet.id);
                }
              }}
            >
              {planet && !planet.landable
                ? "✕ NO SOLID SURFACE"
                : "▸ DESIGNATE LANDING SITE"}
            </HudButton>
            {planet && !planet.landable && (
              <p className="hal-mono mt-2 text-center text-[10px] text-red-400/80">
                HALCYON DECLINES — LANDER REQUIRES A SURFACE
              </p>
            )}
          </div>
        </HudPanel>
      </div>
    </div>
  );
}
