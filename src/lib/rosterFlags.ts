import { differenceInCalendarDays } from 'date-fns';
import type { PlayerWithStats } from '@/services/playersService';
import type { RosterAthleteMetrics } from '@/services/rosterMetricsService';

/**
 * Roster attention heuristics (ported from the design reference's flagsFor /
 * priorityScore). All thresholds operate on real PlayerWithStats +
 * RosterAthleteMetrics values.
 */

export type FlagTone = 'good' | 'warn' | 'bad' | 'neutral';

export interface AthleteFlag {
  kind: 'fatigue' | 'inactive' | 'attendance' | 'gain' | 'steady';
  tone: FlagTone;
  label: string;
}

/** Days since the athlete's last logged session (Infinity when never). */
export function lastDaysFor(athlete: PlayerWithStats, m?: Pick<RosterAthleteMetrics, 'lastSessionDate'>): number {
  const dateStr = m?.lastSessionDate ?? athlete.lastWorkout?.date ?? null;
  if (!dateStr) return Infinity;
  return Math.max(0, differenceInCalendarDays(new Date(), new Date(dateStr)));
}

export function flagsFor(athlete: PlayerWithStats, m?: RosterAthleteMetrics): AthleteFlag[] {
  const flags: AthleteFlag[] = [];
  const lastDays = lastDaysFor(athlete, m);

  if (m?.dropPct != null && m.dropPct >= 14) {
    flags.push({ kind: 'fatigue', tone: 'warn', label: `Velocity drop ${m.dropPct}%` });
  }
  if (lastDays >= 7) {
    flags.push({
      kind: 'inactive',
      tone: 'bad',
      label: Number.isFinite(lastDays) ? `Inactive ${lastDays}d` : 'No sessions yet',
    });
  }
  if (athlete.attendance < 70) {
    flags.push({ kind: 'attendance', tone: 'warn', label: `Attendance ${athlete.attendance}%` });
  }
  if (flags.length === 0 && m?.velDelta != null && m.velDelta >= 0.05) {
    flags.push({ kind: 'gain', tone: 'good', label: `Velocity ↑ +${m.velDelta.toFixed(2)}` });
  }
  if (flags.length === 0) {
    flags.push({ kind: 'steady', tone: 'neutral', label: 'On plan' });
  }
  return flags;
}
