import { useMemo, useState } from "react";
import {
  addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth,
  startOfMonth, startOfWeek, subMonths,
} from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { WorkoutExercise } from "@/services/workoutPlansService";

/**
 * Placeholder design (not final): a date button that opens a month calendar, and next
 * to it a dropdown of the workouts done or planned on that date (same look as the
 * exercise picker in the load-velocity card). No workout card: the page decides what
 * to show for the chosen workout via `onSelect`.
 */

export interface PickerPlan {
  id: string;
  /** yyyy-MM-dd */
  date: string;
  title: string | null;
  exercises: WorkoutExercise[];
  is_completed: boolean | null;
  /** False when nothing was recorded for this workout: it is greyed out in the dropdown and cannot be chosen. Default true. */
  hasData?: boolean;
}

const enabled = (p: PickerPlan) => p.hasData !== false;
/** The workout a date opens on: the first one with data, else the first. */
const firstOf = (list: PickerPlan[]) => list.find(enabled) ?? list[0] ?? null;

type Status = "completed" | "missed" | "queued";

const KEY = (d: Date) => format(d, "yyyy-MM-dd");
const parse = (key: string) => new Date(key + "T12:00:00");

/** Same rule as the Programming tab: not completed and before today is missed. */
const statusOf = (p: PickerPlan, todayKey: string): Status =>
  p.is_completed ? "completed" : p.date < todayKey ? "missed" : "queued";

const DOT: Record<Status, string> = {
  completed: "var(--good)",
  missed: "var(--bad)",
  queued: "var(--ink-3)",
};
const LABEL: Record<Status, string> = { completed: "Completed", missed: "Missed", queued: "Queued" };

const NAV_BTN: React.CSSProperties = {
  display: "inline-flex", border: 0, background: "transparent", padding: 6, cursor: "pointer", color: "var(--ink-1)", borderRadius: 6,
};

// ─── Pieces ────────────────────────────────────────────────────────────────────

function Dots({ plans, todayKey }: { plans: PickerPlan[]; todayKey: string }) {
  return (
    <span className="row" style={{ gap: 3, height: 6, justifyContent: "center" }}>
      {plans.slice(0, 3).map((p) => (
        <span key={p.id} style={{ width: 6, height: 6, borderRadius: 999, background: DOT[statusOf(p, todayKey)] }} />
      ))}
    </span>
  );
}

interface GridProps {
  plansByDate: Map<string, PickerPlan[]>;
  todayKey: string;
  selected: string;
  onPick: (key: string) => void;
}

function DayButton({ day, selected, dim, plans, todayKey, onPick }: {
  day: Date; selected: boolean; dim?: boolean; plans: PickerPlan[]; todayKey: string; onPick: (key: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(KEY(day))}
      aria-pressed={selected}
      aria-label={format(day, "EEEE MMMM d")}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3,
        padding: "5px 0", border: 0, borderRadius: 8, cursor: "pointer", font: "inherit", minWidth: 0,
        background: selected ? "var(--brand)" : "transparent",
        color: selected ? "var(--brand-ink)" : dim ? "var(--ink-3)" : "var(--ink-0)",
        opacity: dim && !selected ? 0.6 : 1,
        transition: "background 200ms",
      }}
    >
      <span className="mono" style={{ fontSize: 13, fontWeight: 500 }}>{format(day, "d")}</span>
      <Dots plans={plans} todayKey={todayKey} />
    </button>
  );
}

function MonthGrid({ plansByDate, todayKey, selected, onPick }: GridProps) {
  const [anchor, setAnchor] = useState(() => startOfMonth(parse(selected)));
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 }),
  });
  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
        <button type="button" style={NAV_BTN} onClick={() => setAnchor(subMonths(anchor, 1))} aria-label="Previous month"><ChevronLeft size={16} strokeWidth={1.5} /></button>
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-0)" }}>{format(anchor, "MMMM yyyy")}</span>
        <button type="button" style={NAV_BTN} onClick={() => setAnchor(addMonths(anchor, 1))} aria-label="Next month"><ChevronRight size={16} strokeWidth={1.5} /></button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((w) => (
          <span key={w} className="v-meta" style={{ fontSize: 10.5, textAlign: "center", padding: "2px 0" }}>{w}</span>
        ))}
        {days.map((d) => (
          <DayButton
            key={KEY(d)} day={d} dim={!isSameMonth(d, anchor)} selected={KEY(d) === selected}
            plans={plansByDate.get(KEY(d)) ?? []} todayKey={todayKey} onPick={onPick}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────────

interface WorkoutPickerProps {
  plans: PickerPlan[];
  /** Today's date, yyyy-MM-dd. Defaults to now. */
  today?: string;
  /** Date shown first, yyyy-MM-dd. Defaults to the nearest workout on or after today, else the latest. */
  initialDate?: string;
  /** Workout chosen first (also sets the date). Wins over `initialDate`. */
  initialPlanId?: string;
  /** Called with the chosen workout, or null when the date has none. */
  onSelect?: (plan: PickerPlan | null) => void;
  /**
   * Gate before the date or workout changes. When given, a change only happens if `proceed`
   * is called (now or later); until then the picker keeps showing the current choice.
   */
  beforeChange?: (proceed: () => void) => void;
}

export function WorkoutPicker({ plans, today, initialDate, initialPlanId, onSelect, beforeChange }: WorkoutPickerProps) {
  const todayKey = today ?? KEY(new Date());
  const plansByDate = useMemo(() => {
    const m = new Map<string, PickerPlan[]>();
    for (const p of plans) m.set(p.date, [...(m.get(p.date) ?? []), p]);
    return m;
  }, [plans]);

  const [date, setDate] = useState(() => {
    const first = initialPlanId ? plans.find((p) => p.id === initialPlanId) : undefined;
    if (first) return first.date;
    if (initialDate) return initialDate;
    const dates = [...plansByDate.keys()].sort();
    return dates.find((d) => d >= todayKey) ?? dates[dates.length - 1] ?? todayKey;
  });
  const [pickId, setPickId] = useState<string | null>(initialPlanId ?? null);
  const [open, setOpen] = useState(false);

  const dayPlans = plansByDate.get(date) ?? [];
  const chosen = dayPlans.find((p) => p.id === pickId) ?? firstOf(dayPlans);

  const guarded = (change: () => void) => (beforeChange ? beforeChange(change) : change());

  const choose = (id: string | null, d: string) => {
    setPickId(id);
    const list = plansByDate.get(d) ?? [];
    onSelect?.(list.find((p) => p.id === id) ?? firstOf(list));
  };

  return (
    <div className="row" style={{ gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" className="v-btn" style={{ height: 30, gap: 8, padding: "0 12px", fontSize: 12 }}>
            <CalendarDays size={14} strokeWidth={1.5} />
            {format(parse(date), "EEE, MMM d")}
            {dayPlans.length > 0 && <Dots plans={dayPlans} todayKey={todayKey} />}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="v-pop" style={{ width: 290, padding: 12 }}>
          <MonthGrid
            plansByDate={plansByDate}
            todayKey={todayKey}
            selected={date}
            onPick={(k) => {
              setOpen(false);
              if (k === date) return;
              guarded(() => {
                setDate(k);
                choose(null, k);
              });
            }}
          />
          <div className="row" style={{ gap: 12, fontSize: 11, marginTop: 10 }}>
            {(["completed", "missed", "queued"] as Status[]).map((st) => (
              <span key={st} className="row v-meta" style={{ gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: DOT[st] }} />
                {LABEL[st]}
              </span>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {chosen ? (
        <Select value={chosen.id} onValueChange={(id) => guarded(() => choose(id, date))}>
          <SelectTrigger aria-label="Workout" style={{ height: 30, width: "auto", minWidth: 180, fontSize: 12, gap: 8 }}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {dayPlans.map((p, i) => (
              <SelectItem key={p.id} value={p.id} disabled={!enabled(p)} style={{ fontSize: 12 }}>
                {p.title ?? `Workout ${i + 1}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <span className="v-meta">No workout on this day.</span>
      )}
    </div>
  );
}
