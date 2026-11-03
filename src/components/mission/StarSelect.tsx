"use client";

import { useState } from "react";
import type { FlareRisk, StarSystem } from "@/lib/mission/types";
import { STARS, transitYears } from "@/lib/mission/stars";
import { HudPanel, DataRow, HudButton } from "./HudPanel";
import { Starfield3D } from "./Starfield3D";
import { halAudio } from "@/lib/mission/audio";
import { halStarSelected } from "@/lib/mission/hal";
import { cn } from "@/lib/utils";

const FLARE_STYLE: Record<FlareRisk, string> = {
  NONE: "text-neutral-400 border-neutral-600",
  LOW: "text-phos border-phos/50",
  MODERATE: "text-amber-300 border-amber-400/60",
  HIGH: "text-orange-400 border-orange-500/70",
  EXTREME: "text-red-400 border-red-500/70",
};

export function StarSelect({
  onCommit,
  onSpeak,
}: {
  onCommit: (starId: string) => void;
  onSpeak: (line: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const star: StarSystem | null =
    selected ? (STARS.find((s) => s.id === selected) ?? null) : null;

  const pick = (id: string) => {
    setSelected(id);
    const s = STARS.find((x) => x.id === id);
    if (s) onSpeak(halStarSelected(s));
  };

  return (
    <div className="grid gap-3 lg:grid-cols-[290px_1fr_330px] lg:items-stretch">
      {/* ── catalog ── */}
      <div className="order-2 lg:order-1">
        <HudPanel
          title="Stellar Catalog"
          code="SYS.01 / DEST"
          bodyClassName="p-0"
          className="h-full"
        >
          <div className="hal-scroll max-h-[26rem] overflow-y-auto lg:max-h-[calc(100vh-22rem)]">
            {STARS.map((s) => {
              const isSel = s.id === selected;
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    halAudio.select();
                    pick(s.id);
                  }}
                  className={cn(
                    "block w-full border-b border-ink/5 px-3 py-2.5 text-left transition-colors hover:bg-ink/5",
                    isSel && "hud-row-selected"
                  )}
                  aria-pressed={isSel}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      className={cn(
                        "hal-mono text-xs tracking-wider",
                        isSel ? "text-ink" : "text-neutral-200"
                      )}
                    >
                      {s.name}
                    </span>
                    <span className="hal-mono text-[10px] text-neutral-500">
                      {s.distanceLy.toFixed(2)} LY
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="hal-mono text-[10px] text-neutral-500">
                      {s.spectral} · {s.luminositySolar.toFixed(2)} L☉
                    </span>
                    <span
                      className={cn(
                        "hal-mono border px-1 text-[9px] tracking-wider",
                        FLARE_STYLE[s.flareRisk]
                      )}
                    >
                      FLARE {s.flareRisk[0]}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="hal-mono border-t border-ink/10 px-3 py-1.5 text-[9px] tracking-widest text-neutral-600">
            {STARS.length} CANDIDATES · R ≤ 12 LY · DRAG CHART TO ROTATE
          </div>
        </HudPanel>
      </div>

      {/* ── neighborhood chart ── */}
      <div className="order-1 lg:order-2">
        <HudPanel
          title="Local Neighborhood"
          code="CHART-3D"
          bodyClassName="p-0"
          className="h-full"
        >
          <div className="h-[300px] sm:h-[380px] lg:h-[calc(100vh-21rem)] lg:min-h-[420px]">
            <Starfield3D selectedId={selected} onSelect={pick} />
          </div>
        </HudPanel>
      </div>

      {/* ── dossier ── */}
      <div className="order-3">
        <HudPanel
          title="Destination Dossier"
          code={star ? `DOSS-${star.shortName}` : "DOSS-—"}
          accent="white"
          className="h-full"
          bodyClassName="p-0"
        >
          {!star ? (
            <div className="hal-mono flex h-full min-h-48 flex-col items-center justify-center gap-3 p-6 text-center text-[11px] text-neutral-600">
              <span className="reticle-spin text-2xl text-neutral-400/60">◎</span>
              AWAITING DESTINATION SELECTION
              <span className="text-neutral-700">
                SELECT FROM CATALOG OR CHART
              </span>
            </div>
          ) : (
            <div className="hal-scroll max-h-[26rem] overflow-y-auto p-4 lg:max-h-[calc(100vh-22rem)]">
              <h3 className="hal-display mb-1 text-sm tracking-[0.2em] text-ink">
                {star.name}
              </h3>
              <div className="hal-mono mb-3 text-[10px] tracking-widest text-phos/80">
                {star.catalog}
              </div>

              <DataRow label="DISTANCE" value={`${star.distanceLy.toFixed(3)} LY`} />
              <DataRow label="SPECTRAL CLASS" value={star.spectral} />
              <DataRow label="MASS" value={`${star.massSolar.toFixed(3)} M☉`} />
              <DataRow
                label="LUMINOSITY"
                value={`${star.luminositySolar.toFixed(4)} L☉`}
              />
              <DataRow label="COMPANIONS" value={star.companions} />
              <DataRow
                label="FLARE CLASS"
                value={star.flareRisk}
                warn={star.flareRisk === "EXTREME" || star.flareRisk === "HIGH"}
              />
              <DataRow label="KNOWN WORLDS" value={star.knownWorlds} />

              <div className="my-3 border border-phos/25 bg-phos/5 p-2.5">
                <div className="hal-mono text-[10px] tracking-widest text-phos">
                  TRANSIT SOLUTION @ 0.1 C
                </div>
                <div className="hal-display glow-phos mt-1 text-xl tracking-widest text-phos">
                  {Math.round(transitYears(star))} YEARS
                </div>
                <div className="hal-mono mt-1 text-[10px] text-neutral-500">
                  CREW IN COLD SLEEP · HAL 9000 ON WATCH
                </div>
              </div>

              <p className="hal-mono mt-3 text-[11px] leading-relaxed text-neutral-400">
                {star.notes}
              </p>
            </div>
          )}
          <div className="border-t border-ink/10 p-3">
            <HudButton
              disabled={!star}
              className="w-full"
              onClick={() => {
                if (star) {
                  halAudio.confirm();
                  onCommit(star.id);
                }
              }}
            >
              ▸ COMMIT DESTINATION
            </HudButton>
          </div>
        </HudPanel>
      </div>
    </div>
  );
}
