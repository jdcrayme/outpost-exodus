"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { HudPanel, HudButton, DataRow } from "@/components/common/HudPanel";
import { HudDialog } from "@/components/common/HudDialog";
import { halcyonAudio } from "@/lib/mission/audio";
import {
  EQUIPMENT,
  EQUIPMENT_BY_ID,
  CARGO_CAPACITY_T,
} from "@/lib/mission/equipment";
import { BERTHS_PER_BAY } from "@/lib/mission/ship";
import {
  COHORTS,
  WATCH,
  CREW_BY_ID,
  type CrewMember,
} from "@/lib/mission/crew";
import {
  HALCYON_CREW_OPEN,
  HALCYON_EQUIP_LOADING,
  HALCYON_NO_SEED,
  HALCYON_NO_VLBI,
  HALCYON_VLBI_ON,
  halcyonMassExcess,
} from "@/lib/mission/halcyon";
import {
  ShipBlueprint,
  stowLabel,
  useTickNumber,
  type ShipBlueprintHandle,
  type StationClick,
} from "./ShipBlueprint";
import { CrewDossier } from "./CrewDossier";
import { PortraitThumb } from "./Portrait";

// ─── Manifest — payload and crew on the general-arrangement drawing ──────────
// One screen, one instrument. The GA drawing IS the interface: the camera is
// free (drag pans, wheel zooms), every stowage station is clickable — cargo
// ring cells, strongback docks, the cryo bays, the command sphere. Clicking a
// bay opens its cohort of seventeen; clicking a soul opens their dossier.
// Clicking a cargo station stows or clears hardware against the 1,760-tonne
// launch capacity. Nothing lives below the fold: the rail holds the mass
// budget and the pre-flight check, the popups hold the detail.

type Dialog =
  | { kind: "station"; id: string } // dock / rack cell / bus-B fit, by equipment id
  | { kind: "rackEmpty" } // empty cargo-ring cell → the rack picker
  | { kind: "cohort"; index: number } // bay 0–11 → its cohort of 17
  | { kind: "watch" }; // command sphere → the watch of 3

// one roster row — single line, dossier on click (mirrors the old roster)
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
      <span className="hal-mono hidden w-24 shrink-0 truncate text-right text-[10px] text-neutral-600 lg:inline">
        {m.origin}
      </span>
    </button>
  );
}

export function ManifestScreen({
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
  const bpRef = useRef<ShipBlueprintHandle | null>(null);
  const loadStarted = useRef(false);
  const crewIntro = useRef(false);

  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);

  const selected = new Set(equipment);
  const items = equipment
    .map((id) => EQUIPMENT_BY_ID.get(id))
    .filter(Boolean) as NonNullable<ReturnType<typeof EQUIPMENT_BY_ID.get>>[];
  const mass = items.reduce((a, e) => a + e.massT, 0);
  const massTick = useTickNumber(mass, 650);
  const over = mass - CARGO_CAPACITY_T;

  const hasVlbi = selected.has("vlbi");
  const hasPower = selected.has("sps") || selected.has("reactor");
  const hasComms = selected.has("commsat");
  const byCat = (cat: string) =>
    items.filter((e) => e.category === cat).reduce((a, e) => a + e.massT, 0);

  const closeDialog = () => {
    setDialog(null);
    setMemberId(null);
  };

  const handleStation = (s: StationClick) => {
    halcyonAudio.select();
    setMemberId(null);
    if (s.kind === "dock" || s.kind === "cell") {
      setDialog({ kind: "station", id: s.id });
    } else if (s.kind === "rackEmpty") {
      setDialog({ kind: "rackEmpty" });
    } else if (s.kind === "bay") {
      if (!crewIntro.current) {
        crewIntro.current = true;
        onSpeak(HALCYON_CREW_OPEN);
      }
      setDialog({ kind: "cohort", index: s.index });
    } else {
      setDialog({ kind: "watch" });
    }
  };

  const addItem = (id: string) => {
    const item = EQUIPMENT_BY_ID.get(id);
    if (!item || selected.has(id)) return;
    const newOver = mass + item.massT - CARGO_CAPACITY_T;
    if (newOver > 0) {
      halcyonAudio.select();
      onSpeak(halcyonMassExcess(Math.round(newOver)));
      return;
    }
    halcyonAudio.confirm();
    // first loadout action pushes the camera to the cargo ring, where the work is
    if (!loadStarted.current) {
      loadStarted.current = true;
      bpRef.current?.focusView("cargo");
      onSpeak(HALCYON_EQUIP_LOADING);
    } else if (id === "vlbi") {
      onSpeak(HALCYON_VLBI_ON);
    }
    onToggle(id);
    closeDialog();
  };

  const removeItem = (id: string) => {
    const item = EQUIPMENT_BY_ID.get(id);
    if (!item) return;
    if (item.required) {
      halcyonAudio.select();
      onSpeak(HALCYON_NO_SEED);
      return;
    }
    halcyonAudio.select();
    if (id === "vlbi") onSpeak(HALCYON_NO_VLBI);
    onToggle(id);
    closeDialog();
  };

  const focusStation = (id: string) => {
    bpRef.current?.focusStation(id);
    setMemberId(null);
    setDialog({ kind: "station", id });
  };

  // ── dialog bodies ──

  const stationDialog = (id: string) => {
    const item = EQUIPMENT_BY_ID.get(id);
    if (!item) return null;
    const stowed = selected.has(id);
    const projected = mass + item.massT - CARGO_CAPACITY_T;
    return (
      <>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 hal-scroll">
          <div className="hal-display text-sm tracking-[0.18em] text-ink">
            {item.name}
          </div>
          <div className="hal-mono mt-0.5 flex flex-wrap gap-x-3 text-[10px] tracking-widest text-neutral-500">
            <span>{item.code}</span>
            <span className="text-phos">{item.role}</span>
            {item.required && (
              <span className="border border-amber-400/60 px-1 text-amber-300">
                MANDATORY
              </span>
            )}
          </div>
          <div className="mt-3">
            <DataRow
              label="MASS"
              value={<span className="text-phos">{item.massT} T</span>}
            />
            <DataRow label="STOWAGE" value={stowLabel(id)} />
            <DataRow label="RELIABILITY" value={`${item.reliability}%`} />
            <DataRow
              label="POWER"
              value={
                item.powerKw > 0
                  ? `DRAW ${item.powerKw} kW`
                  : `SUPPLY ${Math.abs(item.powerKw) / 1000} MW`
              }
            />
          </div>
          <p className="hal-mono mt-3 border-l-2 border-ink/30 pl-3 text-[10px] leading-relaxed text-neutral-400">
            {item.desc}
          </p>
          {!stowed && projected > 0 && (
            <div className="hal-mono mt-3 flex items-center gap-2 text-[10px] text-red-400">
              <span className="inline-block h-2 w-2 animate-pulse bg-red-500" />
              STOWING EXCEEDS CAPACITY BY {Math.round(projected)} T
            </div>
          )}
        </div>
        <div className="space-y-2 border-t border-ink/10 p-3">
          {stowed ? (
            <HudButton variant="ghost" className="w-full" onClick={() => removeItem(id)}>
              ◂ CLEAR STATION{item.required ? " — REFUSED" : ` — ${item.massT} T OFF THE MANIFEST`}
            </HudButton>
          ) : (
            <HudButton className="w-full" onClick={() => addItem(id)}>
              ▸ STOW AT {stowLabel(id)} — {item.massT} T
            </HudButton>
          )}
          <HudButton variant="ghost" size="sm" className="w-full" onClick={closeDialog}>
            ✕ CLOSE
          </HudButton>
        </div>
      </>
    );
  };

  const rackPicker = () => {
    const available = EQUIPMENT.filter((e) => !selected.has(e.id));
    return (
      <>
        <div className="min-h-0 flex-1 overflow-y-auto hal-scroll">
          <div className="hal-mono border-b border-ink/10 px-3 py-2 text-[9px] tracking-widest text-neutral-600">
            AVAILABLE MANIFEST — CLICK TO STOW AT ITS STATION:
          </div>
          {available.map((e) => {
            const projected = mass + e.massT - CARGO_CAPACITY_T;
            return (
              <button
                key={e.id}
                onClick={() => addItem(e.id)}
                aria-label={`Stow ${e.name}, ${e.massT} tonnes`}
                className="block w-full border-b border-ink/5 px-3 py-2 text-left transition-colors hover:bg-ink/5"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="hal-mono truncate text-[11px] tracking-wider text-neutral-200">
                    {e.name}
                  </span>
                  <span className="hal-mono shrink-0 text-[10px] text-neutral-500">
                    <span className="text-phos">{e.massT}</span> T
                  </span>
                </div>
                <div className="hal-mono mt-0.5 flex gap-x-3 text-[10px] text-neutral-500">
                  <span>{e.code}</span>
                  <span>REL {e.reliability}%</span>
                  <span>{stowLabel(e.id)}</span>
                  {projected > 0 && (
                    <span className="text-red-400">OVER +{Math.round(projected)} T</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        <div className="border-t border-ink/10 p-3">
          <HudButton variant="ghost" size="sm" className="w-full" onClick={closeDialog}>
            ✕ CLOSE
          </HudButton>
        </div>
      </>
    );
  };

  const rosterDialog = (members: CrewMember[]) => {
    const sel = memberId ? (CREW_BY_ID.get(memberId) ?? null) : null;
    if (sel) {
      return (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto p-3 hal-scroll">
            <CrewDossier member={sel} />
          </div>
          <div className="border-t border-ink/10 p-3">
            <HudButton variant="ghost" size="sm" className="w-full" onClick={() => setMemberId(null)}>
              ◂ BACK TO THE ROSTER
            </HudButton>
          </div>
        </>
      );
    }
    return (
      <>
        <div className="min-h-0 flex-1 overflow-y-auto hal-scroll">
          {members.map((m) => (
            <CrewRow
              key={m.id}
              m={m}
              selected={memberId === m.id}
              onSelect={(id) => {
                halcyonAudio.select();
                setMemberId(id);
              }}
            />
          ))}
        </div>
        <div className="border-t border-ink/10 p-3">
          <HudButton variant="ghost" size="sm" className="w-full" onClick={closeDialog}>
            ✕ CLOSE
          </HudButton>
        </div>
      </>
    );
  };

  const cohort = dialog?.kind === "cohort" ? COHORTS[dialog.index] : null;
  const stationItem =
    dialog?.kind === "station" ? EQUIPMENT_BY_ID.get(dialog.id) : null;

  return (
    <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[1fr_330px] lg:grid-rows-[minmax(0,1fr)]">
      {/* ── the drawing — the interface itself ── */}
      <HudPanel
        title="General Arrangement — Side Elevation"
        code="OE-104-GA"
        accent="phos"
        className="flex min-h-0 flex-col"
        bodyClassName="flex min-h-0 flex-1 flex-col p-1 sm:p-2"
      >
        <ShipBlueprint
          ref={bpRef}
          equipment={equipment}
          onStationClick={handleStation}
          hoverId={hoverId}
          onHover={setHoverId}
        />
      </HudPanel>

      {/* ── the rail — budget, manifest, checks, commit ── */}
      <aside className="hal-scroll flex min-h-0 flex-col gap-3 overflow-y-auto">
        <HudPanel
          title="Launch Capacity"
          code="OE-104-C"
          accent={over > 0 ? "red" : "phos"}
          bodyClassName="p-3"
          className="shrink-0"
        >
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
        </HudPanel>

        <HudPanel
          title="Launch Manifest"
          code="STOW"
          className="flex min-h-32 flex-1 flex-col"
          bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
        >
          <div className="hal-scroll min-h-0 flex-1 overflow-y-auto">
            {items.map((e) => (
              <button
                key={e.id}
                onClick={() => focusStation(e.id)}
                aria-label={`${e.name}, ${e.massT} tonnes, ${stowLabel(e.id)}`}
                onMouseEnter={() => setHoverId(e.id)}
                onMouseLeave={() => setHoverId(null)}
                className={cn(
                  "block w-full border-b border-ink/5 px-3 py-1.5 text-left transition-colors hover:bg-ink/5",
                  hoverId === e.id && "bg-ink/5"
                )}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="hal-mono truncate text-[11px] tracking-wider text-neutral-200">
                    <span className="text-neutral-500">■</span> {e.name}
                    {e.required && (
                      <span className="hal-mono ml-2 border border-amber-400/60 px-1 text-[8px] tracking-widest text-amber-300">
                        MANDATORY
                      </span>
                    )}
                  </span>
                  <span className="hal-mono shrink-0 text-[10px] text-neutral-500">
                    <span className="text-phos">{e.massT}</span> T
                  </span>
                </div>
                <div className="hal-mono text-[9px] tracking-widest text-neutral-600">
                  {stowLabel(e.id)}
                </div>
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              halcyonAudio.select();
              setMemberId(null);
              setDialog({ kind: "rackEmpty" });
            }}
            aria-label="Open the stow catalog — every item in hold"
            className="flex w-full items-center justify-between border-t border-ink/10 px-3 py-2 text-[10px] transition-colors hover:bg-ink/5"
          >
            <span className="hal-mono text-neutral-500">ITEMS</span>
            <span className="hal-mono text-neutral-200">
              {items.length} / {EQUIPMENT.length}
              <span className="ml-2 text-phos">▸ STOW</span>
            </span>
          </button>
        </HudPanel>

        <HudPanel title="Pre-Flight Check" code="CHK" bodyClassName="p-3" className="shrink-0">
          <div className="space-y-1">
            {[
              { ok: true, warn: false, text: "SEED LANDER — SURFACE INDUSTRY" },
              {
                ok: over <= 0,
                warn: false,
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
                className="hal-mono flex items-center gap-2 text-[9px] tracking-wide"
              >
                <span
                  className={cn(
                    "flex h-3.5 w-3.5 shrink-0 items-center justify-center border text-[9px]",
                    c.ok
                      ? "border-phos/70 text-phos"
                      : c.warn
                        ? "border-amber-400/70 text-amber-300"
                        : "border-red-500/70 text-red-400"
                  )}
                >
                  {c.ok ? "✓" : "!"}
                </span>
                <span className={cn(c.ok ? "text-neutral-300" : "text-amber-300")}>
                  {c.text}
                </span>
              </div>
            ))}
          </div>
          {/* crew readiness — the roster rides the same check */}
          <div className="mt-2.5 border-t border-ink/10 pt-2">
            <div className="hal-mono flex items-baseline justify-between text-[9px] tracking-widest text-neutral-500">
              <span>CREW</span>
              <span className="text-ink">207 · WATCH OF 3 · 12 × {BERTHS_PER_BAY}</span>
            </div>
            <div className="hal-mono mt-1 flex items-baseline justify-between text-[9px] tracking-widest text-neutral-500">
              <span>COVERAGE</span>
              <span className="text-phos">8 FUNCTIONS × 12/12 — ASSERTED</span>
            </div>
          </div>
        </HudPanel>

        <div className="shrink-0">
          <HudButton
            disabled={over > 0}
            className="w-full"
            onClick={() => {
              halcyonAudio.confirm();
              onConfirm();
            }}
          >
            ▸ COMMIT MANIFEST
          </HudButton>
          {over > 0 && (
            <p className="hal-mono mt-1.5 text-center text-[10px] text-red-400/80">
              HALCYON DECLINES — MANIFEST OVER MASS
            </p>
          )}
        </div>
      </aside>

      {/* ── popups ── */}
      {dialog?.kind === "station" && stationItem && (
        <HudDialog
          title={stationItem.name}
          code={stationItem.code}
          accent={stationItem.required ? "amber" : "phos"}
          onClose={closeDialog}
        >
          {stationDialog(dialog.id)}
        </HudDialog>
      )}
      {dialog?.kind === "rackEmpty" && (
        <HudDialog
          title="Stow Cargo — Available Manifest"
          code="HOLD"
          onClose={closeDialog}
        >
          {rackPicker()}
        </HudDialog>
      )}
      {dialog?.kind === "cohort" && cohort && (
        <HudDialog
          title={`Bay ${cohort.bay.id} — Cohort ${String(cohort.bay.cohort).padStart(2, "0")}`}
          code={`${BERTHS_PER_BAY} SOULS`}
          onClose={closeDialog}
        >
          {rosterDialog(cohort.members)}
        </HudDialog>
      )}
      {dialog?.kind === "watch" && (
        <HudDialog
          title="Command Sphere — The Watch"
          code="3 SOULS"
          onClose={closeDialog}
        >
          {rosterDialog(WATCH)}
        </HudDialog>
      )}
    </div>
  );
}
