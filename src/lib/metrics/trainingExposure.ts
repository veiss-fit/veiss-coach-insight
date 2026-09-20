/**
 * SP-08 Training exposure facts (temp/METRIC_SPEC.md): sessions per week and
 * days since the last session. Facts only, never combined into a score.
 *
 * A session counts when it has at least one valid rep (SP-01 rule), so the
 * caller passes the valid-rep count per session. Weeks start on Monday (UTC).
 * Days since last session are calendar days.
 */

export interface SessionInput {
  /** ISO date or datetime of the session. */
  date: string;
  /** Valid reps in the session (velocity not null and above 0). */
  validReps: number;
}

export interface WeekCount {
  /** ISO date (YYYY-MM-DD) of the Monday that starts the week. */
  weekStart: string;
  sessions: number;
  /** The week that contains `today`; it is not over yet. */
  current: boolean;
}

export interface Exposure {
  /** Oldest first. The last entry is the current week. */
  weeks: WeekCount[];
  /** Calendar days from the latest counted session to today. null when there is none. */
  daysSinceLast: number | null;
  /** ISO date of the latest counted session. */
  lastSession: string | null;
}

export const WEEKS_SHOWN = 8;

const DAY_MS = 86_400_000;

/** Midnight UTC of the calendar day containing `iso`. */
const dayStart = (iso: string) => {
  const d = new Date(iso);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};

/** Midnight UTC of the Monday of the week containing `t` (a UTC day start). */
const mondayOf = (t: number) => {
  const dow = new Date(t).getUTCDay(); // 0 = Sunday
  return t - ((dow + 6) % 7) * DAY_MS;
};

export function trainingExposure(sessions: SessionInput[], today: string): Exposure {
  const counted = sessions.filter((s) => s.validReps > 0).map((s) => ({ ...s, day: dayStart(s.date) }));
  const todayDay = dayStart(today);
  const thisMonday = mondayOf(todayDay);

  const weeks: WeekCount[] = Array.from({ length: WEEKS_SHOWN }, (_, i) => {
    const start = thisMonday - (WEEKS_SHOWN - 1 - i) * 7 * DAY_MS;
    return {
      weekStart: new Date(start).toISOString().slice(0, 10),
      sessions: counted.filter((s) => s.day >= start && s.day < start + 7 * DAY_MS).length,
      current: i === WEEKS_SHOWN - 1,
    };
  });

  const past = counted.filter((s) => s.day <= todayDay).sort((a, b) => b.day - a.day);
  const last = past[0];
  return {
    weeks,
    daysSinceLast: last ? Math.round((todayDay - last.day) / DAY_MS) : null,
    lastSession: last ? new Date(last.day).toISOString().slice(0, 10) : null,
  };
}
