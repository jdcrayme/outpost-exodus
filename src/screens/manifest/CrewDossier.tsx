"use client";

import { cn } from "@/lib/utils";
import { HudPanel, DataRow } from "@/components/common/HudPanel";
import {
  SKILL_AXES,
  faceCode,
  masteryAxis,
  type CrewMember,
} from "@/lib/mission/crew";
import { Portrait } from "./Portrait";

// ─── Crew dossier — the personnel record on the right rail ──────────────────
// The plate is the member seed read as a mustered photograph (portraits.ts,
// DESIGN_NOTES §4 REV D): 48×48, nearest-neighbor, top-to-bottom scan
// reveal. The face code line beneath is the same 32 bits as raw hex —
// source of truth, then interpretation. Skin, hair and eyes draw from the
// human gamut (the photograph is the one color object on the ship); the
// only synthetic colors are the collar pips and the cryo temple marks.
// The mastery axis of the member's trade renders in phosphor; the other
// five in ivory.

export function CrewDossier({ member }: { member: CrewMember }) {
  const mastered = masteryAxis(member.role);
  const hex = faceCode(member);
  const berthTotal = member.cohort === 0 ? "WATCH" : "17";

  return (
    <HudPanel
      title="CREW DOSSIER"
      code={member.id}
      accent="phos"
      bodyClassName="p-4"
      className="lg:mb-0"
    >
      {/* the plate + identity — an attached photograph in a personnel file */}
      <div className="flex items-start gap-3">
        <figure className="m-0 shrink-0 border border-ink/15 bg-black/60 p-1">
          <Portrait member={member} px={96} />
          <figcaption className="hal-mono mt-1 text-center text-[7px] tracking-[0.22em] text-neutral-600">
            MUSTERED PHOTO
          </figcaption>
        </figure>
        <div className="min-w-0 flex-1">
          <div className="hal-display text-sm tracking-[0.18em] text-ink">
            {member.name}
          </div>
          <div className="mt-1 text-[10px] tracking-widest text-phos">
            {member.role}
          </div>
          <div className="mt-0.5 text-[9px] tracking-widest text-neutral-600">
            {member.sex} · {member.age} Y · {member.origin}
          </div>
        </div>
      </div>

      {/* record of service */}
      <div className="mt-3">
        <DataRow
          label="STATION"
          value={
            member.cohort === 0
              ? "COMMAND SPHERE · WATCH"
              : `${member.bay} · COHORT ${String(member.cohort).padStart(2, "0")}`
          }
        />
        <DataRow
          label="BERTH"
          value={`${String(member.berth).padStart(2, "0")} / ${berthTotal}`}
        />
        <DataRow label="SERVICE RECORD" value={member.record} />
        <DataRow
          label="FACE CODE"
          value={<span className="text-phos">{hex}</span>}
        />
      </div>

      {/* skill axes — 1–9, the trade's axis in phos */}
      <div className="mt-4">
        <div className="hal-mono mb-2 flex items-baseline justify-between text-[10px] tracking-widest text-neutral-500">
          <span>SKILL AXES</span>
          <span className="text-neutral-600">1–9 · MASTERY IN PHOS</span>
        </div>
        <div className="space-y-1.5">
          {SKILL_AXES.map((a) => {
            const v = member.skills[a.id];
            const mast = a.id === mastered;
            return (
              <div key={a.id} className="flex items-center gap-2">
                <span className="hal-mono w-9 shrink-0 text-[9px] tracking-widest text-neutral-500">
                  {a.label}
                </span>
                <div className="relative h-1.5 flex-1 bg-ink/10">
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                      backgroundImage:
                        "repeating-linear-gradient(90deg, transparent 0 calc(10% - 1px), rgba(232,230,220,0.22) calc(10% - 1px) 10%)",
                    }}
                    aria-hidden="true"
                  />
                  <div
                    className="absolute inset-y-0 left-0"
                    style={{
                      width: `${(v / 9) * 100}%`,
                      background: mast ? "#7beba6" : "rgba(232,230,220,0.55)",
                    }}
                  />
                </div>
                <span
                  className={cn(
                    "hal-mono w-6 shrink-0 text-right text-[10px] tabular-nums",
                    mast ? "text-phos" : "text-neutral-300"
                  )}
                >
                  {v}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-4 text-[9px] leading-relaxed tracking-widest text-neutral-600">
        THE PLATE AND THE FACE CODE ARE THE SAME 32 BITS — THE PHOTOGRAPH IS
        THE SEED, READ. SKIN, HAIR AND EYES FROM THE HUMAN GAMUT · AGE LINES
        FROM THE RECORD · COLLAR PIPS CARRY THE FUNCTION · CRYO MARKS AT THE
        TEMPLES. ELITE (1984) HOMAGE.
      </p>
    </HudPanel>
  );
}
