export interface WorkoutPlanLike {
  date: string;
  title?: string | null;
  is_completed: boolean;
}

export interface WorkoutSessionLike {
  id: string;
  date: string;
  name?: string | null;
  createdAt?: string | null;
}

export interface AttendanceSummary {
  completedPlanCount: number;
  pendingPlanCount: number;
  missedPlanCount: number;
  selfLoggedCompletedCount: number;
  totalTrackedCount: number;
  completedTrackedCount: number;
  attendancePercent: number;
  matchedSessionIds: Set<string>;
}

const normalizeWorkoutText = (value?: string | null) => (value || '').trim().toLowerCase();

export const findMatchingSessionForPlan = (
  plan: Pick<WorkoutPlanLike, 'date' | 'title'>,
  sessions: WorkoutSessionLike[],
  excludedSessionIds: Set<string> = new Set()
) => {
  const sameDaySessions = sessions
    .filter((session) => session.date === plan.date && !excludedSessionIds.has(session.id))
    .sort((a, b) => {
      // Always prefer latest completion when multiple same-day sessions exist.
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });

  if (sameDaySessions.length === 0) {
    return null;
  }

  const normalizedTitle = normalizeWorkoutText(plan.title);

  // Exact name match — only meaningful when the plan actually has a title.
  if (normalizedTitle) {
    const exactMatch = sameDaySessions.find(
      (session) => normalizeWorkoutText(session.name) === normalizedTitle
    );
    if (exactMatch) return exactMatch;
  }

  // Fall back to the sole *unnamed* session of the day (a device-only recording
  // with no workout context). Named sessions — whether or not the plan has a
  // title — stay independent and are never absorbed by a title-less plan.
  return sameDaySessions.length === 1 && !normalizeWorkoutText(sameDaySessions[0].name)
    ? sameDaySessions[0]
    : null;
};

export const getWorkoutPlanStatus = (
  plan: WorkoutPlanLike,
  sessions: WorkoutSessionLike[],
  today = new Date()
) => {
  if (plan.is_completed || findMatchingSessionForPlan(plan, sessions) !== null) {
    return 'completed';
  }

  const planDate = new Date(`${plan.date}T00:00:00`);
  const compareDate = new Date(today);
  compareDate.setHours(0, 0, 0, 0);

  return planDate < compareDate ? 'missed' : 'pending';
};

export const getAttendanceSummary = (
  plans: WorkoutPlanLike[],
  sessions: WorkoutSessionLike[],
  today = new Date()
): AttendanceSummary => {
  const matchedSessionIds = new Set<string>();
  let completedPlanCount = 0;
  let pendingPlanCount = 0;
  let missedPlanCount = 0;

  plans.forEach((plan) => {
    const status = getWorkoutPlanStatus(plan, sessions, today);
    if (status === 'completed') {
      completedPlanCount += 1;
      const matchedSession = findMatchingSessionForPlan(plan, sessions, matchedSessionIds);
      if (matchedSession) {
        matchedSessionIds.add(matchedSession.id);
      }
      return;
    }

    if (status === 'pending') {
      pendingPlanCount += 1;
      return;
    }

    missedPlanCount += 1;
  });

  const selfLoggedCompletedCount = sessions.filter(
    (session) => !matchedSessionIds.has(session.id)
  ).length;
  const totalTrackedCount = plans.length + selfLoggedCompletedCount;
  const completedTrackedCount = completedPlanCount + selfLoggedCompletedCount;
  const attendancePercent = totalTrackedCount > 0
    ? Math.round((completedTrackedCount / totalTrackedCount) * 100)
    : 0;

  return {
    completedPlanCount,
    pendingPlanCount,
    missedPlanCount,
    selfLoggedCompletedCount,
    totalTrackedCount,
    completedTrackedCount,
    attendancePercent,
    matchedSessionIds,
  };
};