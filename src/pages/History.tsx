import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ArrowLeft, Dumbbell, Megaphone, Clock, Calendar, CalendarClock, Users } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { PageHeader } from "@/components/pulse/PageHeader";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { useAuth } from "@/contexts/AuthContext";
import { getCoachWorkoutHistory } from "@/services/workoutPlansService";
import { getCoachMessageHistory } from "@/services/messagesService";

interface WorkoutBatch {
  id: string;
  workoutName: string;
  sentAt: string;
  scheduledDates: string[];
  recipients: string[];
  exercises: unknown[] | null;
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

function WorkoutRow({ w }: { w: WorkoutBatch }) {
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
      </div>
    </div>
  );
}

function AnnouncementRow({ m }: { m: AnnouncementBatch }) {
  const urgent = m.priority === "urgent";
  const pendingScheduled = m.isDelivered === false && m.scheduledAt;
  return (
    <div className="v-card padded" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div className="row" style={{ gap: 12, minWidth: 0 }}>
          <span
            className="v-avatar lg"
            style={{
              background: urgent ? "var(--bad-soft)" : "var(--navy-tint)",
              color: urgent ? "var(--bad)" : "var(--navy)",
              borderRadius: 10,
            }}
          >
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
          {urgent && <span className="v-chip" data-tone="bad">Urgent</span>}
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

export default function History() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"workouts" | "announcements">("workouts");
  const [workouts, setWorkouts] = useState<WorkoutBatch[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementBatch[]>([]);

  const loadHistory = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [workoutsData, messagesData] = await Promise.all([
        getCoachWorkoutHistory(user.id),
        getCoachMessageHistory(user.id),
      ]);
      setWorkouts(workoutsData);
      setAnnouncements(messagesData);
    } catch (error) {
      console.error("Failed to load history", error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const reach =
    workouts.reduce((s, w) => s + w.recipients.length, 0) +
    announcements.reduce((s, m) => s + m.recipientCount, 0);

  const emptyMessage =
    tab === "workouts"
      ? "No workouts sent yet. Use Programming to send your first plan."
      : "No announcements sent yet.";
  const rows = tab === "workouts" ? workouts : announcements;

  return (
    <div className="v-app">
      <TopNav />
      <main style={{ padding: "20px 28px 40px", maxWidth: 1060, margin: "0 auto", width: "100%" }}>
        <LoadingOverlay isLoading={loading} fullScreen message="Loading history..." />

        <Link to="/" className="v-btn ghost" style={{ marginBottom: 6, paddingLeft: 6, width: "fit-content" }}>
          <ArrowLeft size={12} strokeWidth={1.5} />
          Back to dashboard
        </Link>
        <PageHeader eyebrow="Coach" title="History" subtitle="Everything you've sent to your athletes, newest first." />

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
          {!loading && rows.length === 0 ? (
            <div className="v-card padded" style={{ textAlign: "center", color: "var(--ink-3)", fontSize: 12.5, padding: "36px 16px" }}>
              {emptyMessage}
            </div>
          ) : tab === "workouts" ? (
            workouts.map((w) => <WorkoutRow key={w.id} w={w} />)
          ) : (
            announcements.map((m) => <AnnouncementRow key={m.id} m={m} />)
          )}
        </div>
      </main>
    </div>
  );
}
