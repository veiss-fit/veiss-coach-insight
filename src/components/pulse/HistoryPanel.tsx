import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { Dumbbell, Megaphone, Clock, Calendar, CalendarClock, Users } from "lucide-react";
import { LoadError } from "@/components/pulse/LoadError";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { CancelWorkoutDialog } from "@/components/pulse/CancelWorkoutDialog";
import { getCoachWorkoutHistory, cancelWorkoutPlans } from "@/services/workoutPlansService";
import { getCoachMessageHistory } from "@/services/messagesService";

interface WorkoutBatch {
  id: string;
  workoutName: string;
  sentAt: string;
  scheduledDates: string[];
  recipients: string[];
  exercises: unknown[] | null;
  /** Plans in this batch that are still open and scheduled today or later: the ones a cancel removes. */
  cancellablePlanIds: string[];
  cancellableAthleteCount: number;
  /** Every plan of the batch and how many of them are scheduled today or later. */
  planIds: string[];
  upcomingPlanCount: number;
}

interface AnnouncementBatch {
  id: string;
  title: string;
  content: string;
  sentAt: string;
  scheduledAt: string | null;
  isDelivered: boolean;
  priority: string;
  recipientCount: number;
}

function StatTile({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="v-card padded" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div className="v-label">{label}</div>
      <div className="num" style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em" }}>{value}</div>
      {sub && <div className="v-meta" style={{ fontSize: 11, color: "var(--ink-3)" }}>{sub}</div>}
    </div>
  );
}

function WorkoutRow({ w, onCancel, onModify }: { w: WorkoutBatch; onCancel: (w: WorkoutBatch) => void; onModify: (w: WorkoutBatch) => void }) {
  const exerciseCount = Array.isArray(w.exercises) ? w.exercises.length : 0;
  const scheduled = w.scheduledDates
    .slice()
    .sort()
    .map((d) => format(new Date(d + "T12:00:00"), "EEE MMM d"))
    .join(" · ");
  return (
    <div className="v-card padded" style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <span className="v-avatar lg" style={{ background: "var(--brand-soft)", color: "var(--brand-ink)", borderRadius: 10 }}>
        <Dumbbell size={16} strokeWidth={1.5} />
      </span>
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="row" style={{ gap: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{w.workoutName}</span>
          {exerciseCount > 0 && (
            <span className="v-chip" data-tone="neutral">{exerciseCount} exercise{exerciseCount !== 1 ? "s" : ""}</span>
          )}
        </div>
        <div className="row" style={{ gap: 14, marginTop: 5, flexWrap: "wrap" }}>
          <span className="v-meta mono row" style={{ fontSize: 11, gap: 4, color: "var(--ink-3)" }}>
            <Clock size={12} strokeWidth={1.5} />
            Sent {format(new Date(w.sentAt), "MMM d, h:mm a")}
          </span>
          {scheduled && (
            <span className="v-meta mono row" style={{ fontSize: 11, gap: 4, color: "var(--ink-3)" }}>
              <Calendar size={12} strokeWidth={1.5} />
              For {scheduled}
            </span>
          )}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <span className="v-chip" data-tone="brand" style={{ marginBottom: 6 }}>
          <Users size={12} strokeWidth={1.5} />
          {w.recipients.length} recipient{w.recipients.length !== 1 ? "s" : ""}
        </span>
        <div className="v-meta ellipsis" style={{ fontSize: 11, color: "var(--ink-3)", maxWidth: 240 }}>
          {w.recipients.slice(0, 3).join(", ")}
          {w.recipients.length > 3 ? ` +${w.recipients.length - 3} more` : ""}
        </div>
        {w.upcomingPlanCount > 0 && (
          <div className="row" style={{ gap: 6, justifyContent: "flex-end", marginTop: 6 }}>
            <button className="v-btn ghost" style={{ height: 28, fontSize: 11.5 }} onClick={() => onModify(w)}>
              Modify
            </button>
            {w.cancellablePlanIds.length > 0 && (
              <button className="v-btn ghost" style={{ height: 28, fontSize: 11.5 }} onClick={() => onCancel(w)}>
                Cancel upcoming
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AnnouncementRow({ m }: { m: AnnouncementBatch }) {
  const pendingScheduled = m.isDelivered === false && m.scheduledAt;
  return (
    <div className="v-card padded" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div className="row" style={{ gap: 12, minWidth: 0 }}>
          <span className="v-avatar lg" style={{ borderRadius: 10 }}>
            <Megaphone size={16} strokeWidth={1.5} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{m.title}</div>
            <div className="v-meta mono row" style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2, gap: 4 }}>
              {pendingScheduled ? (
                <>
                  <CalendarClock size={12} strokeWidth={1.5} />
                  Scheduled for {format(new Date(m.scheduledAt!), "MMM d, h:mm a")}
                </>
              ) : (
                <>Sent {format(new Date(m.sentAt), "MMM d, h:mm a")}</>
              )}
            </div>
          </div>
        </div>
        <div className="row" style={{ gap: 6, flexShrink: 0 }}>
          {pendingScheduled && <span className="v-chip" data-tone="info">Scheduled</span>}
        </div>
      </div>
      <div style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.5, paddingLeft: 56 }}>{m.content}</div>
      <div className="row" style={{ justifyContent: "flex-end", paddingLeft: 56 }}>
        <span className="v-meta mono row" style={{ fontSize: 10.5, color: "var(--ink-3)", gap: 4 }}>
          <Users size={12} strokeWidth={1.5} />
          {m.recipientCount} recipient{m.recipientCount !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}

/**
 * Shared history content — stats + workouts/announcements sub-tabs + rows.
 * Used both by the standalone /history route (deep-linkable) and as the
 * "History" tab inside Send Programming (D18: consolidated out of top nav).
 */
export function HistoryPanel() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"workouts" | "announcements">("workouts");
  const [workouts, setWorkouts] = useState<WorkoutBatch[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementBatch[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [workoutsData, messagesData] = await Promise.all([
        profile?.coach_id ? getCoachWorkoutHistory(profile.coach_id) : Promise.resolve([]),
        getCoachMessageHistory(user.id),
      ]);
      setWorkouts(workoutsData);
      setAnnouncements(messagesData);
    } catch (error) {
      console.error("Failed to load history", error);
      setLoadError(error instanceof Error ? error.message : null);
    } finally {
      setLoading(false);
    }
  }, [user?.id, profile?.coach_id]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const navigate = useNavigate();
  // Modify opens the builder pre-filled from the batch's plans (the page reads them back by id).
  const modifyBatch = (w: WorkoutBatch) => navigate(`/send-programming?edit=${w.planIds.join(",")}&mode=batch`);

  const [cancelling, setCancelling] = useState<WorkoutBatch | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);

  const confirmCancel = async () => {
    if (!cancelling || !user?.id) return;
    setCancelBusy(true);
    const result = await cancelWorkoutPlans(cancelling.cancellablePlanIds, profile?.coach_id ?? null, user.id);
    setCancelBusy(false);
    setCancelling(null);
    if (!result.success) {
      toast.error(result.error ?? "Couldn't cancel the workout");
    } else if (result.error) {
      toast.warning(result.error);
    } else {
      toast.success(`Cancelled ${result.cancelled} workout${result.cancelled !== 1 ? "s" : ""} and notified the athlete${cancelling.cancellableAthleteCount !== 1 ? "s" : ""}`);
    }
    void loadHistory();
  };

  const reach =
    workouts.reduce((s, w) => s + w.recipients.length, 0) +
    announcements.reduce((s, m) => s + m.recipientCount, 0);

  const emptyMessage =
    tab === "workouts"
      ? "No workouts sent yet. Use Programming to send your first plan."
      : "No announcements sent yet.";
  const rows = tab === "workouts" ? workouts : announcements;

  return (
    <div style={{ position: "relative" }}>
      <LoadingOverlay isLoading={loading} message="Loading history..." />

      <section style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
        <StatTile label="Workouts sent" value={workouts.length} sub="workout batches" />
        <StatTile label="Announcements" value={announcements.length} sub="sent to your athletes" />
        <StatTile label="Total reach" value={reach} sub="athlete deliveries" />
      </section>

      <div className="row" style={{ gap: 4, background: "var(--surface-sunk)", padding: 3, borderRadius: 9, width: "fit-content", marginBottom: 18 }}>
        {([
          ["workouts", `Workouts · ${workouts.length}`],
          ["announcements", `Announcements · ${announcements.length}`],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="v-btn"
            style={{
              height: 32,
              fontSize: 12.5,
              border: "none",
              background: tab === id ? "var(--surface-1)" : "transparent",
              color: tab === id ? "var(--ink-0)" : "var(--ink-2)",
              boxShadow: tab === id ? "0 1px 2px rgba(7,16,31,0.08)" : "none",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {loadError !== null ? (
          <LoadError message={loadError} onRetry={loadHistory} title="Couldn't load your history" />
        ) : !loading && rows.length === 0 ? (
          <div className="v-card padded" style={{ textAlign: "center", color: "var(--ink-3)", fontSize: 12.5, padding: "36px 16px" }}>
            {emptyMessage}
          </div>
        ) : tab === "workouts" ? (
          workouts.map((w) => <WorkoutRow key={w.id} w={w} onCancel={setCancelling} onModify={modifyBatch} />)
        ) : (
          announcements.map((m) => <AnnouncementRow key={m.id} m={m} />)
        )}
      </div>

      <CancelWorkoutDialog
        open={cancelling !== null}
        onOpenChange={(o) => { if (!o) setCancelling(null); }}
        title={`Cancel "${cancelling?.workoutName ?? ""}"?`}
        description={
          cancelling
            ? `This removes ${cancelling.cancellablePlanIds.length} upcoming workout${cancelling.cancellablePlanIds.length !== 1 ? "s" : ""} for ${cancelling.cancellableAthleteCount} athlete${cancelling.cancellableAthleteCount !== 1 ? "s" : ""} and sends each of them an announcement and a notification. Workouts already done or in the past are not touched. This cannot be undone.`
            : ""
        }
        busy={cancelBusy}
        onConfirm={confirmCancel}
      />
    </div>
  );
}
