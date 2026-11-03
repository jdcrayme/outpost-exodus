"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Volume2, VolumeX, NotebookPen, X } from "lucide-react";
import type { LogEntry, Phase } from "@/lib/mission/types";
import { STAR_BY_ID } from "@/lib/mission/stars";
import { EQUIPMENT_BY_ID } from "@/lib/mission/equipment";
import { generateSystem, formatClock } from "@/lib/mission/engine";
import { transitYears } from "@/lib/mission/stars";
import { halAudio } from "@/lib/mission/audio";
import {
  HAL_EQUIP_OPEN,
  HAL_IDLE,
  HAL_PROFILE_OPEN,
  HAL_RESTART,
  halStarCommitted,
  HAL_PAYLOAD_OK,
} from "@/lib/mission/hal";
import { CrtOverlay, TypeLine } from "@/components/mission/TypeLine";
import { HalEye } from "@/components/mission/HalEye";
import { BootScreen } from "@/components/mission/BootScreen";
import { StarSelect } from "@/components/mission/StarSelect";
import { EquipmentScreen } from "@/components/mission/EquipmentScreen";
import { TransitScreen } from "@/components/mission/TransitScreen";
import { PlanetSelect } from "@/components/mission/PlanetSelect";
import { MissionProfile } from "@/components/mission/MissionProfile";
import { cn } from "@/lib/utils";

const PHASE_STEPS: { id: Phase; label: string; code: string }[] = [
  { id: "STAR", label: "STAR SELECT", code: "01" },
  { id: "EQUIP", label: "PAYLOAD", code: "02" },
  { id: "TRANSIT", label: "SURVEY", code: "03" },
  { id: "PLANET", label: "LANDING", code: "04" },
];

const PHASE_HEADER: Record<Phase, { title: string; sub: string } | null> = {
  BOOT: null,
  STAR: {
    title: "DESTINATION — STAR SELECT",
    sub: "Choose the system that will inherit the human race. Drag the chart; consult the dossier.",
  },
  EQUIP: {
    title: "SHIP EQUIPMENT — PAYLOAD MANIFEST",
    sub: "1,760 tonnes of launch capacity against 2,075 tonnes of equipment. Choose your sacrifices.",
  },
  TRANSIT: { title: "TRANSIT & SURVEY", sub: "" },
  PLANET: {
    title: "PLANET SELECT — VLBI SURVEY DATA",
    sub: "The probe has done its work. Now choose the world your grandchildren will be buried on.",
  },
  PROFILE: {
    title: "MISSION PROFILE",
    sub: "Final review. HAL has simulated this configuration 4,096 times.",
  },
};

export default function OutpostPage() {
  const [phase, setPhase] = useState<Phase>("BOOT");
  const [starId, setStarId] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<string[]>(["seed"]);
  const [planetId, setPlanetId] = useState<string | null>(null);
  const [halLine, setHalLine] = useState("");
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

  // idle HAL chatter
  useEffect(() => {
    if (phase === "BOOT" || phase === "TRANSIT") return;
    const t = setInterval(() => {
      setHalLine(HAL_IDLE[idleIdx.current % HAL_IDLE.length]);
      idleIdx.current += 1;
    }, 46000);
    return () => clearInterval(t);
  }, [phase]);

  const speak = useCallback((line: string) => setHalLine(line), []);

  // ── transitions ──
  const initiate = () => {
    halAudio.setEnabled(true);
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
    setHalLine(HAL_EQUIP_OPEN);
    addLog(`DESTINATION COMMITTED — ${s.name} (${s.distanceLy.toFixed(2)} LY)`);
    addLog(
      `TRANSIT SOLUTION — ${Math.round(transitYears(s))} YEARS (TJI + JOVIAN FLYBY + 0.1 C CRUISE)`
    );
    addLog(halStarCommitted(s));
  };

  const toggleEquipment = (id: string) => {
    setEquipment((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const confirmPayload = () => {
    setPhase("TRANSIT");
    addLog(
      `PAYLOAD CONFIRMED — ${equipmentItems.length} ITEMS / ${equipmentItems.reduce((a, e) => a + e.massT, 0)} T`
    );
    addLog("DEPARTURE PROFILE — TJI BURN 8.80 KM/S · JOVIAN ASSIST δ 115.8° · C3 ESCAPE 0.100 C");
    addLog(HAL_PAYLOAD_OK);
  };

  const finishTransit = () => {
    setPhase("PLANET");
    addLog(`SYSTEM ENTRY — ${star?.name ?? ""} — SURVEY DATA AVAILABLE`);
  };

  const commitPlanet = (id: string) => {
    setPlanetId(id);
    setPhase("PROFILE");
    setHalLine(HAL_PROFILE_OPEN);
    addLog(`LANDING SITE DESIGNATED — ${id.split(":")[1] ?? ""}`);
  };

  const restart = () => {
    halAudio.confirm();
    setPhase("BOOT");
    setStarId(null);
    setPlanetId(null);
    setEquipment(["seed"]);
    setHalLine(HAL_RESTART);
    addLog("SEQUENCE RESET — NEW MISSION START");
  };

  const toggleAudio = () => {
    const next = !audioOn;
    setAudioOn(next);
    halAudio.setEnabled(next);
    if (next) halAudio.select();
  };

  const header = PHASE_HEADER[phase];
  const phaseIdx = PHASE_STEPS.findIndex(
    (p) => p.id === phase || (phase === "PROFILE" && p.id === "PLANET")
  );

  return (
    <div className="hal-mono flex min-h-screen flex-col bg-[#030304] text-neutral-200">
      <CrtOverlay />

      {/* ── top status bar ── */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-3 py-2">
          <HalEye size={34} label={false} glow />
          <div className="hidden sm:block">
            <div className="hal-display text-[11px] tracking-[0.3em] text-neutral-100">
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
                        done || active ? "bg-red-500/60" : "bg-white/15"
                      )}
                    />
                  )}
                  <div
                    className={cn(
                      "flex items-center gap-2 border px-2.5 py-1",
                      active
                        ? "border-red-500/70 bg-red-500/10 text-red-300"
                        : done
                          ? "border-red-500/30 text-red-400/60"
                          : "border-white/10 text-neutral-600"
                    )}
                  >
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
              <div className="text-[11px] tabular-nums text-amber-300">
                T+{formatClock(clock)}
              </div>
            </div>
            <button
              onClick={toggleAudio}
              aria-label={audioOn ? "Mute audio" : "Enable audio"}
              className={cn(
                "flex h-9 w-9 items-center justify-center border transition-colors",
                audioOn
                  ? "border-red-500/60 text-red-400"
                  : "border-white/15 text-neutral-500 hover:text-neutral-200"
              )}
            >
              {audioOn ? <Volume2 size={15} /> : <VolumeX size={15} />}
            </button>
            <button
              onClick={() => {
                setLogOpen((o) => !o);
                halAudio.select();
              }}
              aria-label="Toggle mission log"
              className={cn(
                "flex h-9 w-9 items-center justify-center border transition-colors",
                logOpen
                  ? "border-amber-400/60 text-amber-300"
                  : "border-white/15 text-neutral-500 hover:text-neutral-200"
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
          <div className="fade-up flex flex-wrap items-end justify-between gap-2 border-b border-white/10 pb-2">
            <div>
              <h1 className="hal-display text-sm tracking-[0.28em] text-neutral-100 sm:text-base">
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
                  halAudio.select();
                }}
                className="border border-white/15 px-3 py-1.5 text-[9px] tracking-[0.25em] text-neutral-500 hover:border-white/40 hover:text-neutral-200"
              >
                ◂ REVISE DESTINATION
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

      {/* ── HAL dialogue bar ── */}
      <footer className="sticky bottom-0 z-40 mt-auto border-t border-white/10 bg-black/85 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-3 py-2.5">
          <HalEye size={40} label={false} />
          <div className="min-w-0 flex-1">
            <div className="mb-0.5 text-[8px] tracking-[0.3em] text-neutral-600">
              HAL 9000 · SHIPBOARD ARTIFICIAL INTELLIGENCE · Urbana, Illinois
            </div>
            <div className="truncate text-[11px] text-neutral-300 sm:text-xs">
              {halLine ? (
                <TypeLine key={halLine} text={halLine} speed={22} />
              ) : (
                <span className="text-neutral-600">
                  ── awaiting input ──
                </span>
              )}
            </div>
          </div>
        </div>
      </footer>

      {/* ── mission log drawer ── */}
      <aside
        className={cn(
          "fixed right-0 top-0 z-[70] h-full w-80 max-w-[85vw] border-l border-white/15 bg-black/95 transition-transform duration-300",
          logOpen ? "translate-x-0" : "translate-x-full"
        )}
        aria-label="Mission log"
      >
        <div className="border-b border-white/10 p-3">
          <div className="hal-display text-[11px] tracking-[0.25em] text-amber-300">
            MISSION LOG
          </div>
          <div className="mt-0.5 text-[9px] tracking-widest text-neutral-600">
            {log.length} ENTRIES · AUTO-RECORDED
          </div>
        </div>
        <div className="hal-scroll h-[calc(100%-3.4rem)] overflow-y-auto p-3">
          {log.length === 0 && (
            <div className="text-[10px] text-neutral-600">NO ENTRIES YET.</div>
          )}
          {log.map((e, i) => (
            <div
              key={i}
              className="border-b border-white/5 py-1.5 text-[10px] leading-relaxed"
            >
              <span className="mr-2 text-red-500/70 tabular-nums">T+{e.t}</span>
              <span className="text-neutral-300">{e.text}</span>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
