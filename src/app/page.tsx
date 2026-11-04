"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Volume2, VolumeX, NotebookPen, X } from "lucide-react";
import type { LogEntry, Phase } from "@/lib/mission/types";
import { STAR_BY_ID } from "@/lib/mission/stars";
import { EQUIPMENT_BY_ID } from "@/lib/mission/equipment";
import { generateSystem, formatClock } from "@/lib/mission/engine";
import { transitYears } from "@/lib/mission/stars";
import { halcyonAudio } from "@/lib/mission/audio";
import {
  HALCYON_EQUIP_OPEN,
  HALCYON_IDLE,
  HALCYON_PROFILE_OPEN,
  HALCYON_RESTART,
  halcyonStarCommitted,
  HALCYON_PAYLOAD_OK,
  HALCYON_CREW_OPEN,
} from "@/lib/mission/halcyon";
import { CrtOverlay, TypeLine } from "@/components/common/TypeLine";
import { PhaseDial } from "@/components/common/PhaseDial";
import { Waveform } from "@/components/common/Waveform";
import { BootScreen } from "@/screens/boot/BootScreen";
import { IntroScreen } from "@/screens/intro/IntroScreen";
import { StarSelect } from "@/screens/star-select/StarSelect";
import { EquipmentScreen } from "@/screens/equipment/EquipmentScreen";
import { CrewScreen } from "@/screens/crew/CrewScreen";
import { TransitScreen } from "@/screens/transit/TransitScreen";
import { PlanetSelect } from "@/screens/planet-select/PlanetSelect";
import { MissionProfile } from "@/screens/profile/MissionProfile";
import { cn } from "@/lib/utils";

const PHASE_STEPS: { id: Phase; label: string; code: string }[] = [
  { id: "STAR", label: "STAR SELECT", code: "01" },
  { id: "EQUIP", label: "PAYLOAD", code: "02" },
  { id: "CREW", label: "CREW", code: "03" },
  { id: "TRANSIT", label: "SURVEY", code: "04" },
  { id: "PLANET", label: "LANDING", code: "05" },
];

const PHASE_HEADER: Record<Phase, { title: string; sub: string } | null> = {
  INTRO: null,
  BOOT: null,
  STAR: {
    title: "DESTINATION — STAR SELECT",
    sub: "Choose the system that will inherit the human race. Drag the chart; consult the dossier.",
  },
  EQUIP: {
    title: "SHIP EQUIPMENT — PAYLOAD MANIFEST",
    sub: "Containerized cargo stows in the forward cargo ring; landers dock along the strongback — the drawing zooms with the work. 1,760 tonnes of launch capacity against a 2,075-tonne catalog.",
  },
  CREW: {
    title: "CREW MANIFEST — COLD-SLEEP ROSTER",
    sub: "207 souls: a watch of three in the command sphere, and twelve cohorts of seventeen along the spine — one cohort to a bay, every cohort carrying the whole civilization, so no single catastrophe reaches a second. HALCYON holds the transit watch.",
  },
  TRANSIT: { title: "TRANSIT & SURVEY", sub: "" },
  PLANET: {
    title: "PLANET SELECT — VLBI SURVEY DATA",
    sub: "The probe has done its work. Now choose the world your grandchildren will be buried on.",
  },
  PROFILE: {
    title: "MISSION PROFILE",
    sub: "Final review. HALCYON has simulated this configuration 4,096 times.",
  },
};

export default function OutpostPage() {
  const [phase, setPhase] = useState<Phase>("INTRO");
  const [starId, setStarId] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<string[]>(["seed"]);
  const [planetId, setPlanetId] = useState<string | null>(null);
  const [halLine, setHalLine] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [clock, setClock] = useState(0);
  const [audioOn, setAudioOn] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const idleIdx = useRef(0);

  const star = starId ? (STAR_BY_ID.get(starId) ?? null) : null;
  const planets = useMemo(
    () => (star ? generateSystem(star) : []),
    [star]
  );
  const planet = planets.find((p) => p.id === planetId) ?? null;
  const equipmentItems = equipment
    .map((id) => EQUIPMENT_BY_ID.get(id))
    .filter(Boolean) as NonNullable<ReturnType<typeof EQUIPMENT_BY_ID.get>>[];
  const hasProbe = equipment.includes("vlbi");

  const addLog = useCallback(
    (text: string) => {
      setLog((prev) => [{ t: formatClock(clock), text }, ...prev].slice(0, 60));
    },
    [clock]
  );

  // mission clock
  useEffect(() => {
    const t = setInterval(() => setClock((c) => c + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Esc closes the mission log drawer
  useEffect(() => {
    if (!logOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLogOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [logOpen]);

  // idle HALCYON chatter
  useEffect(() => {
    if (phase === "INTRO" || phase === "BOOT" || phase === "TRANSIT") return;
    const t = setInterval(() => {
      setHalLine(HALCYON_IDLE[idleIdx.current % HALCYON_IDLE.length]);
      idleIdx.current += 1;
    }, 46000);
    return () => clearInterval(t);
  }, [phase]);

  const speak = useCallback((line: string) => setHalLine(line), []);

  // the voice channel animates while HALCYON is delivering a line
  useEffect(() => {
    if (halLine) setSpeaking(true);
  }, [halLine]);

  // ── transitions ──
  const initiate = () => {
    halcyonAudio.setEnabled(true);
    setAudioOn(true);
    setPhase("STAR");
    setHalLine(
      "The catalog contains every star system within twelve light years, Commander. Some of them are even habitable."
    );
    addLog("MISSION START SEQUENCE INITIATED");
  };

  const commitStar = (id: string) => {
    const s = STAR_BY_ID.get(id);
    if (!s) return;
    setStarId(id);
    setPlanetId(null);
    setPhase("EQUIP");
    setHalLine(HALCYON_EQUIP_OPEN);
    addLog(`DESTINATION COMMITTED — ${s.name} (${s.distanceLy.toFixed(2)} LY)`);
    addLog(
      `TRANSIT SOLUTION — ${Math.round(transitYears(s))} YEARS (TJI + JOVIAN FLYBY + 0.1 C CRUISE)`
    );
    addLog(halcyonStarCommitted(s));
  };

  const toggleEquipment = (id: string) => {
    setEquipment((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const confirmPayload = () => {
    setPhase("CREW");
    addLog(
      `PAYLOAD CONFIRMED — ${equipmentItems.length} ITEMS / ${equipmentItems.reduce((a, e) => a + e.massT, 0)} T`
    );
    addLog("DEPARTURE PROFILE — TJI BURN 8.80 KM/S · JOVIAN ASSIST δ 115.8° · C3 ESCAPE 0.100 C");
    addLog(HALCYON_PAYLOAD_OK);
    setHalLine(HALCYON_CREW_OPEN);
  };

  const proceedCrew = () => {
    setPhase("TRANSIT");
    addLog("CREW ROSTER VERIFIED — 207 SOULS · 12/12 COHORTS COMPLETE");
  };

  const finishTransit = () => {
    setPhase("PLANET");
    addLog(`SYSTEM ENTRY — ${star?.name ?? ""} — SURVEY DATA AVAILABLE`);
  };

  const commitPlanet = (id: string) => {
    setPlanetId(id);
    setPhase("PROFILE");
    setHalLine(HALCYON_PROFILE_OPEN);
    addLog(`LANDING SITE DESIGNATED — ${id.split(":")[1] ?? ""}`);
  };

  const restart = () => {
    halcyonAudio.confirm();
    setPhase("BOOT");
    setStarId(null);
    setPlanetId(null);
    setEquipment(["seed"]);
    setHalLine(HALCYON_RESTART);
    addLog("SEQUENCE RESET — NEW MISSION START");
  };

  const toggleAudio = () => {
    const next = !audioOn;
    setAudioOn(next);
    halcyonAudio.setEnabled(next);
    if (next) halcyonAudio.select();
  };

  const header = PHASE_HEADER[phase];
  const phaseIdx = PHASE_STEPS.findIndex(
    (p) => p.id === phase || (phase === "PROFILE" && p.id === "PLANET")
  );

  return (
    <div className="hal-mono relative flex min-h-screen flex-col bg-[#030304] text-neutral-200">
      {/* engineering graph paper underlay */}
      <div className="grid-paper pointer-events-none fixed inset-0" aria-hidden="true" />
      <CrtOverlay />

      {/* ── top status bar ── */}
      <header className="sticky top-0 z-40 border-b border-ink/10 bg-black/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-3 py-2">
          <PhaseDial phaseIdx={phaseIdx} size={36} className="hidden sm:block" />
          <div className="hidden sm:block">
            <div className="hal-display text-[11px] tracking-[0.3em] text-ink">
              OUTPOST
            </div>
            <div className="text-[8px] tracking-[0.3em] text-neutral-500">
              SEED SHIP EXODUS
            </div>
          </div>

          {/* phase steps */}
          <nav
            className="mx-auto hidden items-center gap-0 md:flex"
            aria-label="Mission phases"
          >
            {PHASE_STEPS.map((p, i) => {
              const active = i === phaseIdx;
              const done = i < phaseIdx;
              return (
                <div key={p.id} className="flex items-center">
                  {i > 0 && (
                    <div
                      className={cn(
                        "h-px w-8",
                        done ? "bg-phos/50" : "bg-ink/15"
                      )}
                    />
                  )}
                  <div
                    className={cn(
                      "flex items-center gap-2 border px-2.5 py-1",
                      active
                        ? "border-ink/50 bg-ink/10 text-ink"
                        : done
                          ? "border-ink/20 text-ink/50"
                          : "border-ink/10 text-ink/30"
                    )}
                  >
                    {active && (
                      <span
                        className="hal-blink inline-block h-1.5 w-1.5 bg-phos"
                        aria-hidden="true"
                      />
                    )}
                    <span className="text-[9px]">{p.code}</span>
                    <span className="text-[9px] tracking-[0.2em]">{p.label}</span>
                  </div>
                </div>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <div className="text-right">
              <div className="text-[8px] tracking-[0.3em] text-neutral-500">
                MISSION CLOCK
              </div>
              <div className="text-[11px] tabular-nums text-phos">
                T+{formatClock(clock)}
              </div>
            </div>
            <button
              onClick={toggleAudio}
              aria-label={audioOn ? "Mute audio" : "Enable audio"}
              className={cn(
                "flex h-9 w-9 items-center justify-center border transition-colors",
                audioOn
                  ? "border-phos/60 text-phos"
                  : "border-ink/15 text-neutral-500 hover:text-ink"
              )}
            >
              {audioOn ? <Volume2 size={15} /> : <VolumeX size={15} />}
            </button>
            <button
              onClick={() => {
                setLogOpen((o) => !o);
                halcyonAudio.select();
              }}
              aria-label="Toggle mission log"
              className={cn(
                "flex h-9 w-9 items-center justify-center border transition-colors",
                logOpen
                  ? "border-ink/60 text-ink"
                  : "border-ink/15 text-neutral-500 hover:text-ink"
              )}
            >
              {logOpen ? <X size={15} /> : <NotebookPen size={15} />}
            </button>
          </div>
        </div>
      </header>

      {/* ── phase header ── */}
      {header && phase !== "TRANSIT" && (
        <div className="mx-auto w-full max-w-[1600px] px-3 pt-4">
          <div className="fade-up flex flex-wrap items-end justify-between gap-2 border-b border-ink/10 pb-2">
            <div>
              <h1 className="hal-display text-sm tracking-[0.28em] text-ink sm:text-base">
                {header.title}
              </h1>
              <p className="mt-1 max-w-3xl text-[10px] leading-relaxed tracking-wider text-neutral-500 sm:text-[11px]">
                {header.sub}
              </p>
            </div>
            {phase === "EQUIP" && (
              <button
                onClick={() => {
                  setPhase("STAR");
                  halcyonAudio.select();
                }}
                className="border border-ink/15 px-3 py-1.5 text-[9px] tracking-[0.25em] text-neutral-500 hover:border-ink/40 hover:text-ink"
              >
                ◂ REVISE DESTINATION
              </button>
            )}
            {phase === "CREW" && (
              <button
                onClick={() => {
                  setPhase("EQUIP");
                  halcyonAudio.select();
                }}
                className="border border-ink/15 px-3 py-1.5 text-[9px] tracking-[0.25em] text-neutral-500 hover:border-ink/40 hover:text-ink"
              >
                ◂ REVISE PAYLOAD
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── main ── */}
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-3 py-3 sm:py-4">
        {phase === "BOOT" && <BootScreen onInitiate={initiate} />}
        {phase === "STAR" && (
          <StarSelect onCommit={commitStar} onSpeak={speak} />
        )}
        {phase === "EQUIP" && (
          <EquipmentScreen
            equipment={equipment}
            onToggle={toggleEquipment}
            onConfirm={confirmPayload}
            onSpeak={speak}
          />
        )}
        {phase === "CREW" && (
          <CrewScreen equipment={equipment} onConfirm={proceedCrew} />
        )}
        {phase === "TRANSIT" && star && (
          <TransitScreen
            star={star}
            planets={planets}
            hasProbe={hasProbe}
            payloadMassT={equipmentItems.reduce((a, e) => a + e.massT, 0)}
            onDone={finishTransit}
            onSpeak={speak}
          />
        )}
        {phase === "PLANET" && star && (
          <PlanetSelect
            star={star}
            planets={planets}
            hasProbe={hasProbe}
            onCommit={commitPlanet}
            onSpeak={speak}
          />
        )}
        {phase === "PROFILE" && star && (
          <MissionProfile
            star={star}
            planet={planet}
            equipment={equipmentItems}
            hasProbe={hasProbe}
            onSpeak={speak}
            onRestart={restart}
          />
        )}
      </main>

      {/* ── computer dialogue bar — voice channel on the comm panel ── */}
      <footer className="sticky bottom-0 z-40 mt-auto border-t border-ink/10 bg-black/85 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-3 py-2.5">
          <div className="flex shrink-0 flex-col items-center gap-1 border border-ink/15 bg-black/60 px-2 py-1.5">
            <Waveform active={speaking} width={132} height={26} />
            <div className="hal-mono text-[7px] tracking-[0.22em] text-neutral-600">
              VOICE CH-1 ·{" "}
              <span className={speaking ? "text-phos" : ""}>
                {speaking ? "ACTIVE" : "IDLE"}
              </span>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-0.5 text-[8px] tracking-[0.3em] text-neutral-600">
              HALCYON MK IX · SHIPBOARD ARTIFICIAL INTELLIGENCE · OPERATIONAL 2097.01.12
            </div>
            <div className="truncate text-[11px] text-neutral-300 sm:text-xs">
              {halLine ? (
                <TypeLine
                  key={halLine}
                  text={halLine}
                  speed={22}
                  onDone={() => setSpeaking(false)}
                />
              ) : (
                <span className="text-neutral-600">
                  ── awaiting input ──
                </span>
              )}
            </div>
          </div>
        </div>
      </footer>

      {/* ── title card — full-bleed overlay above the shell, below the CRT ── */}
      {phase === "INTRO" && <IntroScreen onDone={() => setPhase("BOOT")} />}

      {/* ── mission log drawer (below the sticky header, so header controls stay live) ── */}
      <aside
        className={cn(
          "fixed right-0 top-[3.25rem] z-[70] h-[calc(100%-3.25rem)] w-80 max-w-[85vw] border-l border-ink/15 bg-black/95 transition-transform duration-300",
          logOpen ? "translate-x-0" : "translate-x-full"
        )}
        aria-label="Mission log"
        aria-hidden={!logOpen}
      >
        <div className="flex items-center justify-between gap-2 border-b border-ink/10 p-3">
          <div>
            <div className="hal-display text-[11px] tracking-[0.25em] text-ink">
              MISSION LOG
            </div>
            <div className="mt-0.5 text-[9px] tracking-widest text-neutral-600">
              {log.length} ENTRIES · AUTO-RECORDED
            </div>
          </div>
          <button
            onClick={() => {
              setLogOpen(false);
              halcyonAudio.select();
            }}
            aria-label="Close mission log"
            className="flex h-8 w-8 shrink-0 items-center justify-center border border-ink/15 text-neutral-500 transition-colors hover:border-ink/40 hover:text-ink"
          >
            <X size={14} />
          </button>
        </div>
        <div className="hal-scroll h-[calc(100%-4.6rem)] overflow-y-auto p-3">
          {log.length === 0 && (
            <div className="text-[10px] text-neutral-600">NO ENTRIES YET.</div>
          )}
          {log.map((e, i) => (
            <div
              key={i}
              className="border-b border-ink/5 py-1.5 text-[10px] leading-relaxed"
            >
              <span className="mr-2 text-phos/70 tabular-nums">T+{e.t}</span>
              <span className="text-neutral-300">{e.text}</span>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
