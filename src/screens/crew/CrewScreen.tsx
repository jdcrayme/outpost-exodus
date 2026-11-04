"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { HudPanel, HudButton } from "@/components/common/HudPanel";
import { halcyonAudio } from "@/lib/mission/audio";
import {
  BAYS,
  BAY_COUNT,
  BERTHS_PER_BAY,
  COLD_SLEEPERS,
  WATCH_CREW as WATCH_N,
} from "@/lib/mission/ship";
import {
  COHORTS,
  WATCH,
  CREW,
  CREW_BY_ID,
  CORE_ROLES,
  type CrewMember,
} from "@/lib/mission/crew";
import { BayChain } from "./BayChain";
import { CrewDossier } from "./CrewDossier";
import { PortraitThumb } from "./Portrait";

// ─── Crew manifest — the roster of record, arranged by cohort ────────────────
// Phase 03, between payload and transit. The roster is static data (mustered
// at the keel, crew.ts) — this screen is a reading room, not an editor.
// The cold-sleep chain drawing is the cohort navigator: hover a bay for its
// station data, click it to jump to its cohort panel. Selecting any soul
// opens their dossier on the right rail: the mustered photograph (the
// member seed read as a face, portraits.ts), record of service, and skill
// axes with the trade's mastery in phos. Roster rows carry the 16×16
// thumbnail of the same face.

// one roster row — full-width button, single line, dossier on click
function CrewRow({
  m,
  selected,
  onSelect,
}: {
  m: CrewMember;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const senior = m.role === "COHORT SENIOR";
  return (
    <button
      type="button"
      onClick={() => onSelect(m.id)}
      aria-pressed={selected}
      aria-label={`${m.name}, ${m.role}, age ${m.age}, from ${m.origin}`}
      className={cn(
        "flex w-full items-center gap-2.5 border-b border-ink/5 px-3 py-[7px] text-left transition-colors hover:bg-ink/5",
        selected && "hud-row-selected bg-ink/5",
        senior && "border-l-2 border-l-phos/70 bg-phos/5"
      )}
    >
      <PortraitThumb member={m} />
      <span className="w-6 shrink-0 text-[10px] tabular-nums text-neutral-600">
        {String(m.berth).padStart(2, "0")}
      </span>
      <span
        className={cn(
          "hal-mono truncate text-[11px] tracking-wider",
          selected ? "text-phos" : "text-neutral-200"
        )}
      >
        {m.name}
      </span>
      {senior && (
        <span className="hal-mono shrink-0 border border-phos/50 px-1 text-[8px] leading-4 tracking-widest text-phos">
          SEN
        </span>
      )}
      <span className="hal-mono ml-auto hidden shrink-0 text-[10px] tracking-wide text-neutral-500 sm:inline">
        {m.role}
      </span>
      <span className="hal-mono hidden w-7 shrink-0 text-right text-[10px] tabular-nums text-neutral-500 md:inline">
        {m.age}
      </span>
      <span className="hal-mono hidden w-28 shrink-0 truncate text-right text-[10px] text-neutral-600 xl:inline">
        {m.origin}
      </span>
    </button>
  );
}

export function CrewScreen({
  equipment,
  onConfirm,
}: {
  equipment: string[];
  onConfirm: () => void;
}) {
  const [hoverBay, setHoverBay] = useState<number | null>(null);
  const [focusCohort, setFocusCohort] = useState<number | null>(null);
  const [selId, setSelId] = useState<string>("W-01");

  const selected = CREW_BY_ID.get(selId) ?? CREW[0];
  const hasColdsleep = equipment.includes("coldsleep");

  // roster-wide stats for the summary strip
  const stats = useMemo(() => {
    const avg = CREW.reduce((a, m) => a + m.age, 0) / CREW.length;
    return {
      avgAge: (Math.round(avg * 10) / 10).toFixed(1),
      f: CREW.filter((m) => m.sex === "F").length,
      m: CREW.filter((m) => m.sex === "M").length,
    };
  }, []);

  // status line — bay hover wins, then the default (mirrors the GA drawing)
  let statusLeft: React.ReactNode;
  let statusRight: React.ReactNode = null;
  if (hoverBay !== null) {
    const b = BAYS[hoverBay];
    statusLeft = (
      <span className="text-ink">
        BAY {b.id} · STA {Math.round(b.sta)} · {b.clock}
      </span>
    );
    statusRight = (
      <span>
        COHORT {String(b.cohort).padStart(2, "0")} ·{" "}
        <span className="text-phos">{BERTHS_PER_BAY} SOULS</span> · BUS {b.bus}{" "}
        · TORPOR {b.loopK.toFixed(1)} K (+{(b.loopK - 273.15).toFixed(1)} °C)
      </span>
    );
  } else {
    statusLeft = (
      <span>
        {BAY_COUNT} BAYS · {COLD_SLEEPERS} SLEEPERS + {WATCH_N} WATCH ={" "}
        {CREW.length} SOULS — HOVER A BAY FOR STATION DATA, CLICK TO GO TO ITS
        COHORT
      </span>
    );
  }

  const pickBay = (i: number) => {
    setFocusCohort(i + 1);
    document
      .getElementById(`cohort-${i + 1}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const pickMember = (id: string) => {
    halcyonAudio.select();
    setSelId(id);
  };

  return (
    <div className="space-y-3">
      {/* ── the cold-sleep chain — the drawing is the cohort navigator ── */}
      <HudPanel
        title="Cold-Sleep Chain — Side Elevation"
        code="DWG OE-105-CS · REV A"
        accent="phos"
        bodyClassName="p-2 sm:p-3"
      >
        <figure className="m-0">
          <figcaption className="hal-mono mb-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-b border-ink/10 px-1 pb-1.5 text-[10px] tracking-widest text-neutral-500">
            <span className="min-w-0 flex-1 truncate">
              {statusLeft}
              {statusRight && <> · {statusRight}</>}
            </span>
            <span className="flex shrink-0 items-center gap-1">
              COMMAND WATCH ×3 — SPHERE STA 009 · OFF DRAWING, FWD
            </span>
          </figcaption>
          <div className="aspect-[106/27] w-full min-h-[220px]">
            <BayChain
              hoverBay={hoverBay}
              onHoverBay={setHoverBay}
              focusCohort={focusCohort}
              onPickBay={pickBay}
              hasColdsleep={hasColdsleep}
            />
          </div>
        </figure>
      </HudPanel>

      {/* ── roster summary strip ── */}
      <div className="hal-mono flex flex-wrap items-center justify-between gap-2 border border-ink/10 bg-black/40 px-3 py-2 text-[10px] tracking-widest text-neutral-500">
        <span>
          SEED SHIP EXODUS · COLD-SLEEP ROSTER ·{" "}
          <span className="text-neutral-300">{CREW.length} SOULS</span> —
          MUSTERED AT THE KEEL
        </span>
        <span>
          AVG AGE <span className="text-neutral-300">{stats.avgAge}</span> ·{" "}
          <span className="text-neutral-300">
            {stats.f} F / {stats.m} M
          </span>{" "}
          · COVERAGE{" "}
          <span className="text-phos">
            {CORE_ROLES.length} FUNCTIONS × {BAY_COUNT}/{BAY_COUNT}
          </span>{" "}
          — ASSERTED AT LOAD
        </span>
      </div>

      {/* ── the roster: watch + twelve cohorts, dossier on the right rail ── */}
      <div className="grid gap-3 lg:grid-cols-[1fr_330px]">
        <div className="grid gap-3 xl:grid-cols-2">
          {/* the watch — command sphere, off drawing (STA 009) */}
          <div id="watch" className="scroll-mt-32 xl:col-span-2">
            <HudPanel
              title="WATCH — COMMAND SPHERE"
              code="STA 009 · 3 BERTHS"
              bodyClassName="p-0"
            >
              <div className="hal-mono flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-ink/10 px-3 py-1.5 text-[10px] tracking-widest text-neutral-500">
                <span>
                  W-01…W-03 · ROTATING WATCH — WAKES AT DEPARTURE AND SYSTEM
                  ENTRY
                </span>
                <span className="ml-auto text-neutral-600">
                  HALCYON HOLDS MID-TRANSIT
                </span>
              </div>
              {WATCH.map((m) => (
                <CrewRow
                  key={m.id}
                  m={m}
                  selected={selId === m.id}
                  onSelect={pickMember}
                />
              ))}
            </HudPanel>
          </div>

          {/* the twelve cohorts — one panel per bay, in chain order */}
          {COHORTS.map(({ bay, members }) => (
            <div
              key={bay.id}
              id={`cohort-${bay.cohort}`}
              className={cn(
                "scroll-mt-32",
                focusCohort === bay.cohort && "rounded-sm"
              )}
              style={
                focusCohort === bay.cohort
                  ? { boxShadow: "0 0 0 1px rgba(123,235,166,0.45)" }
                  : undefined
              }
            >
              <HudPanel
                title={`COHORT ${String(bay.cohort).padStart(2, "0")} — BAY ${bay.id}`}
                code={`STA ${Math.round(bay.sta)} · BUS ${bay.bus}`}
                bodyClassName="p-0"
              >
                <div className="hal-mono flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-ink/10 px-3 py-1.5 text-[10px] tracking-widest text-neutral-500">
                  <span>
                    STA{" "}
                    <span className="text-neutral-300">
                      {Math.round(bay.sta)}
                    </span>
                  </span>
                  <span>
                    BUS{" "}
                    <span className={bay.bus === "B" ? "text-phos" : "text-neutral-300"}>
                      {bay.bus}
                    </span>
                  </span>
                  <span>{bay.clock}</span>
                  <span>
                    TORPOR{" "}
                    <span className="text-neutral-300">
                      {bay.loopK.toFixed(1)}
                    </span>{" "}
                    K
                  </span>
                  <span className="ml-auto text-neutral-600">
                    {BERTHS_PER_BAY} SOULS · 1 COHORT
                  </span>
                </div>
                {members.map((m) => (
                  <CrewRow
                    key={m.id}
                    m={m}
                    selected={selId === m.id}
                    onSelect={pickMember}
                  />
                ))}
              </HudPanel>
            </div>
          ))}
        </div>

        {/* the dossier follows the selection, right rail */}
        <div className="lg:sticky lg:top-3 lg:self-start">
          <CrewDossier member={selected} />
        </div>
      </div>

      {/* ── proceed ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 pt-3">
        <span className="hal-mono max-w-3xl text-[10px] leading-relaxed tracking-widest text-neutral-600">
          ROSTER LOCKED — THE MANIFEST IS A DOCUMENT OF RECORD. EVERY COHORT
          CARRIES ALL {CORE_ROLES.length} FUNCTIONS; THE LOAD-TIME ASSERTIONS
          GUARANTEE IT.
        </span>
        <HudButton
          onClick={() => {
            halcyonAudio.confirm();
            onConfirm();
          }}
        >
          ▸ PROCEED TO TRANSIT
        </HudButton>
      </div>
    </div>
  );
}
