"use client";

import { useMemo, useRef, useState } from "react";
import type { EquipmentItem } from "@/lib/mission/types";
import {
  CARGO_CAPACITY_T,
  CATEGORIES,
  CATEGORY_CODE,
  EQUIPMENT,
  EQUIPMENT_BY_ID,
} from "@/lib/mission/equipment";
import { HudPanel, HudButton, DataRow } from "@/components/common/HudPanel";
import { ShipBlueprint, useTickNumber, type BlueprintView } from "./ShipBlueprint";
import { halcyonAudio } from "@/lib/mission/audio";
import {
  HALCYON_EQUIP_LOADING,
  HALCYON_NO_VLBI,
  HALCYON_VLBI_ON,
} from "@/lib/mission/halcyon";
import { cn } from "@/lib/utils";

function Check({ on, locked }: { on: boolean; locked?: boolean }) {
  return (
    <span
      className={cn(
        "hal-mono flex h-4 w-4 shrink-0 items-center justify-center border text-[11px] leading-none",
        on
          ? "border-ink bg-ink/15 text-ink"
          : "border-ink/25 text-transparent",
        locked && "border-amber-400/70 bg-amber-400/10 text-amber-300"
      )}
      aria-hidden="true"
    >
      {on || locked ? "✓" : ""}
    </span>
  );
}

export function EquipmentScreen({
  equipment,
  onToggle,
  onConfirm,
  onSpeak,
}: {
  equipment: string[];
  onToggle: (id: string) => void;
  onConfirm: () => void;
  onSpeak: (line: string) => void;
}) {
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [view, setView] = useState<BlueprintView>("full");
  const loadStarted = useRef(false);
  const selected = useMemo(() => new Set(equipment), [equipment]);
  const items = useMemo(
    () => equipment.map((id) => EQUIPMENT_BY_ID.get(id)).filter(Boolean) as EquipmentItem[],
    [equipment]
  );
  const mass = items.reduce((a, e) => a + e.massT, 0);
  const massTick = useTickNumber(mass, 650);
  const over = mass - CARGO_CAPACITY_T;
  const hasVlbi = selected.has("vlbi");
  const hasPower = selected.has("sps") || selected.has("reactor");
  const hasComms = selected.has("commsat");

  const byCat = (cat: string) =>
    items.filter((e) => e.category === cat).reduce((a, e) => a + e.massT, 0);

  const toggle = (id: string) => {
    const item = EQUIPMENT_BY_ID.get(id);
    if (!item || item.required) return;
    halcyonAudio.select();
    if (id === "vlbi" && selected.has("vlbi")) onSpeak(HALCYON_NO_VLBI);
    else if (id === "vlbi" && !selected.has("vlbi")) onSpeak(HALCYON_VLBI_ON);
    onToggle(id);
    // first loadout action: push the camera in to the cargo ring, where the work is
    if (!loadStarted.current) {
      loadStarted.current = true;
      setView("cargo");
      onSpeak(HALCYON_EQUIP_LOADING);
    }
  };

  return (
    <div className="space-y-3">
      {/* ── general arrangement blueprint — modules dock at spine stations ── */}
      <HudPanel
        title="General Arrangement — Side Elevation"
        code="OE-104-GA"
        accent="phos"
        bodyClassName="p-2 sm:p-3"
      >
        <ShipBlueprint
          equipment={equipment}
          onToggle={toggle}
          hoverId={hoverId}
          onHover={setHoverId}
          view={view}
          onViewChange={setView}
        />
      </HudPanel>

      <div className="grid gap-3 lg:grid-cols-[1fr_330px]">
        {/* ── manifest items ── */}
        <div className="space-y-3">
          <div className="hal-mono flex flex-wrap items-center justify-between gap-2 border border-ink/10 bg-black/40 px-3 py-2 text-[10px] tracking-widest text-neutral-500">
            <span>
              SEED SHIP EXODUS · CARGO RING · LAUNCH CAPACITY{" "}
              <span className="text-amber-300">
                {CARGO_CAPACITY_T.toLocaleString()} T
              </span>
            </span>
            <span>
              FULL MANIFEST <span className="text-neutral-300">2,075 T</span> —
              EVERY CONFIGURATION IS A SACRIFICE
            </span>
          </div>

        {CATEGORIES.map((cat) => (
          <HudPanel
            key={cat}
            title={cat}
            code={`SEC.${CATEGORY_CODE[cat]}`}
            bodyClassName="p-0"
          >
            {EQUIPMENT.filter((e) => e.category === cat).map((e) => {
              const on = selected.has(e.id);
              return (
                <button
                  key={e.id}
                  onClick={() => toggle(e.id)}
                  disabled={e.required}
                  aria-pressed={on}
                  aria-label={`${e.name}, ${e.massT} tonnes${e.required ? ", mandatory" : ""}`}
                  onMouseEnter={() => setHoverId(e.id)}
                  onMouseLeave={() => setHoverId(null)}
                  className={cn(
                    "block w-full border-b border-ink/5 px-3 py-2.5 text-left transition-colors",
                    e.required
                      ? "cursor-default bg-amber-400/5"
                      : "hover:bg-ink/5",
                    on && !e.required && "hud-row-selected",
                    hoverId === e.id && "bg-ink/5"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Check on={on} locked={e.required} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <span
                          className={cn(
                            "hal-mono text-xs tracking-wider",
                            on || e.required
                              ? "text-neutral-100"
                              : "text-neutral-400"
                          )}
                        >
                          {e.name}
                        </span>
                        <span className="hal-mono shrink-0 text-[10px] text-neutral-500">
                          <span
                            className={cn(
                              "text-sm",
                              on || e.required
                                ? "text-phos"
                                : "text-neutral-500"
                            )}
                          >
                            {e.massT}
                          </span>{" "}
                          T
                        </span>
                      </div>
                      <div className="hal-mono mt-0.5 flex flex-wrap items-center gap-x-3 text-[10px] text-neutral-500">
                        <span>{e.code}</span>
                        <span>{e.role}</span>
                        <span>REL {e.reliability}%</span>
                        <span>
                          {e.powerKw > 0
                            ? `DRAW ${e.powerKw} kW`
                            : `SUPPLY ${Math.abs(e.powerKw) / 1000} MW`}
                        </span>
                        {e.required && (
                          <span className="border border-amber-400/60 px-1 tracking-widest text-amber-300">
                            MANDATORY
                          </span>
                        )}
                      </div>
                      <p className="hal-mono mt-1 text-[10px] leading-relaxed text-neutral-600">
                        {e.desc}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </HudPanel>
        ))}
      </div>

      {/* ── manifest summary ── */}
      <div className="lg:sticky lg:top-3 lg:self-start">
        <HudPanel
          title="Launch Manifest"
          code="LDG-01"
          accent={over > 0 ? "red" : "phos"}
          bodyClassName="p-0"
          className="lg:mb-0"
        >
          <div className="hal-scroll max-h-none overflow-y-auto p-4">
            {/* mass bar */}
            <div className="mb-4">
              <div className="mb-1 flex items-baseline justify-between">
                <span className="hal-mono text-[10px] tracking-widest text-neutral-500">
                  MASS ALLOCATION
                </span>
                <span
                  className={cn(
                    "hal-mono text-xs",
                    over > 0 ? "text-red-400" : "text-phos"
                  )}
                >
                  {massTick.toLocaleString()} / {CARGO_CAPACITY_T.toLocaleString()} T
                </span>
              </div>
              <div className="relative h-3 border border-ink/15 bg-ink/5">
                {/* capacity graduation — one tick per 10% */}
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(90deg, transparent 0 calc(10% - 1px), rgba(232,230,220,0.3) calc(10% - 1px) 10%)",
                  }}
                  aria-hidden="true"
                />
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 transition-all duration-500",
                    over > 0 ? "bg-red-600/80" : "bg-ink/80"
                  )}
                  style={{
                    width: `${Math.min(100, (mass / CARGO_CAPACITY_T) * 100)}%`,
                  }}
                />
                {over > 0 && (
                  <div
                    className="meter-sheen absolute inset-y-0 left-0"
                    style={{
                      width: `${Math.min(100, (mass / CARGO_CAPACITY_T) * 100)}%`,
                    }}
                  />
                )}
              </div>
              {over > 0 && (
                <div className="hal-mono mt-1.5 flex items-center gap-2 text-[10px] text-red-400">
                  <span className="inline-block h-2 w-2 animate-pulse bg-red-500" />
                  OVER MASS BY {over.toLocaleString()} T — DROP CARGO
                </div>
              )}
            </div>

            <DataRow label="ORBITAL ASSETS" value={`${byCat("ORBITAL ASSETS")} T`} />
            <DataRow label="LANDERS" value={`${byCat("LANDERS")} T`} />
            <DataRow label="SUPPORT SYSTEMS" value={`${byCat("SUPPORT SYSTEMS")} T`} />
            <DataRow
              label="ITEMS"
              value={`${items.length} / ${EQUIPMENT.length}`}
            />

            {/* requirement checklist */}
            <div className="mt-4 space-y-1.5">
              <div className="hal-mono text-[10px] tracking-widest text-neutral-500">
                PRE-FLIGHT CHECK
              </div>
              {[
                {
                  ok: true,
                  text: "SEED LANDER — SURFACE INDUSTRY",
                },
                {
                  ok: over <= 0,
                  text: over <= 0 ? "MASS WITHIN CAPACITY" : `OVER MASS ${over} T`,
                },
                {
                  ok: hasVlbi,
                  warn: !hasVlbi,
                  text: hasVlbi
                    ? "VLBI PROBE — SURVEY TELEMETRY"
                    : "NO SURVEY PROBE — BLIND PLANETFALL",
                },
                {
                  ok: hasPower,
                  warn: !hasPower,
                  text: hasPower
                    ? "SURFACE POWER SOURCE ABOARD"
                    : "NO SPS / REACTOR — POWER RISK",
                },
                {
                  ok: hasComms,
                  warn: !hasComms,
                  text: hasComms
                    ? "COMMUNICATIONS RELAY ABOARD"
                    : "NO COMM RELAY — DATA BLACKOUT",
                },
              ].map((c, i) => (
                <div
                  key={i}
                  className="hal-mono flex items-center gap-2 text-[10px] tracking-wide"
                >
                  <span
                    className={cn(
                      "flex h-3.5 w-3.5 items-center justify-center border text-[9px]",
                      c.ok
                        ? "border-phos/70 text-phos"
                        : c.warn
                          ? "border-amber-400/70 text-amber-300"
                          : "border-red-500/70 text-red-400"
                    )}
                  >
                    {c.ok ? "✓" : "!"}
                  </span>
                  <span
                    className={cn(
                      c.ok ? "text-neutral-300" : "text-amber-300"
                    )}
                  >
                    {c.text}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2 border-t border-ink/10 p-3">
            <HudButton
              disabled={over > 0}
              className="w-full"
              onClick={() => {
                halcyonAudio.confirm();
                onConfirm();
              }}
            >
              ▸ CONFIRM PAYLOAD
            </HudButton>
            {over > 0 && (
              <p className="hal-mono text-center text-[10px] text-red-400/80">
                HALCYON DECLINES — MANIFEST OVER MASS
              </p>
            )}
          </div>
        </HudPanel>
      </div>
      </div>
    </div>
  );
}
