import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { PlayerWithStats } from "@/services/playersService";
import type { RosterSignals } from "@/lib/metrics/rosterSignals";
import { attentionFlags, type AttentionThresholds } from "@/lib/metrics/attentionFlags";
import { athleteFacts } from "@/lib/metrics/athleteFacts";
import { Avatar } from "./Avatar";
import { GroupChip } from "./chips";

/**
 * Placeholder design (not final): one athlete the coach follows, with the four
 * facts the roster table flags. A fact past its cut-off gets the same red tint as
 * the table. Cut-offs come from the caller so the card and the table agree.
 */

const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(0)}%`;

interface CardProps {
  athlete: PlayerWithStats;
  signals?: RosterSignals;
  thresholds: AttentionThresholds;
  today?: string;
  onOpen: (athlete: PlayerWithStats) => void;
  onUnfollow: (athlete: PlayerWithStats) => void;
}

const exerciseTag = (name: string) => (
  <span className="v-meta ellipsis" style={{ fontSize: 11, maxWidth: 90 }}>
    {name}
  </span>
);

export function FollowedAthleteCard({ athlete, signals, thresholds, today, onOpen, onUnfollow }: CardProps) {
  const now = new Date(today ?? new Date().toISOString()).getTime();
  const facts = athleteFacts(athlete, signals, now);
  const flags = attentionFlags(facts, thresholds);
  const drop = signals?.biggestDrop;
  const tempo = signals?.slowestTempo;

  const rows: { label: string; flagged: boolean; value: React.ReactNode }[] = [
    {
      label: "Last session",
      flagged: flags.days,
      value: facts.daysSince == null ? null : `${facts.daysSince} day${facts.daysSince === 1 ? "" : "s"} ago`,
    },
    {
      label: "Drop vs baseline",
      flagged: flags.drop,
      value: drop ? (
        <>
          {signed(drop.change)} {exerciseTag(drop.exercise)}
        </>
      ) : null,
    },
    {
      label: "Tempo shift",
      flagged: flags.tempo,
      value: tempo ? (
        <>
          {signed(tempo.change)} {exerciseTag(tempo.exercise)}
        </>
      ) : null,
    },
    { label: "Attendance", flagged: flags.attendance, value: facts.attendance == null ? null : `${Math.round(facts.attendance)}%` },
  ];

  return (
    <div className="v-card padded" style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
      <div className="row" style={{ gap: 10, justifyContent: "space-between" }}>
        <button
          type="button"
          onClick={() => onOpen(athlete)}
          className="row"
          style={{ gap: 10, minWidth: 0, border: 0, background: "transparent", padding: 0, textAlign: "left", cursor: "pointer", font: "inherit" }}
          aria-label={`Open ${athlete.name}`}
        >
          <Avatar name={athlete.name} />
          <div style={{ minWidth: 0 }}>
            <div className="ellipsis" style={{ fontSize: 12.5, fontWeight: 500, color: "var(--ink-0)" }}>
              {athlete.name}
            </div>
            <GroupChip name={athlete.group || "—"} />
          </div>
        </button>
        <button
          type="button"
          onClick={() => onUnfollow(athlete)}
          aria-label={`Stop following ${athlete.name}`}
          style={{ display: "inline-flex", border: 0, background: "transparent", padding: 4, cursor: "pointer", color: "var(--ink-2)", alignSelf: "flex-start" }}
        >
          <X size={14} strokeWidth={1.5} />
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {rows.map((r) => (
          <div
            key={r.label}
            className="row"
            style={{
              justifyContent: "space-between",
              gap: 8,
              padding: "3px 6px",
              margin: "0 -6px",
              borderRadius: 5,
              background: r.flagged ? "rgba(220,38,38,0.16)" : "transparent",
            }}
          >
            <span className="v-meta" style={{ fontSize: 11.5 }}>
              {r.label}
            </span>
            <span className="mono row" style={{ fontSize: 12.5, gap: 6, color: "var(--ink-0)", fontWeight: r.flagged ? 600 : 400 }}>
              {r.value ?? <span className="v-mute2">—</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Dashed card to the right of the followed ones: pick an athlete to follow. */
export function AddFollowCard({ choices, onAdd }: { choices: PlayerWithStats[]; onAdd: (athlete: PlayerWithStats) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="v-card"
          aria-label="Follow an athlete"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            minHeight: 140,
            border: "1px dashed var(--line-2)",
            background: "transparent",
            color: "var(--ink-1)",
            cursor: "pointer",
            font: "inherit",
            fontSize: 12.5,
          }}
        >
          <Plus size={18} strokeWidth={1.5} />
          Follow an athlete
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="v-pop" style={{ width: 240, padding: 5, maxHeight: 280, overflowY: "auto" }}>
        {choices.length === 0 ? (
          <div className="v-meta" style={{ padding: 8 }}>
            Every athlete is already followed.
          </div>
        ) : (
          choices.map((a) => (
            <div
              key={a.id}
              className="v-menuitem row"
              style={{ gap: 8, padding: 8 }}
              onClick={() => {
                onAdd(a);
                setOpen(false);
              }}
            >
              <Avatar name={a.name} />
              <span style={{ fontSize: 12.5 }}>{a.name}</span>
            </div>
          ))
        )}
      </PopoverContent>
    </Popover>
  );
}
