import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Megaphone, Send, Check, CalendarIcon, Users, X } from "lucide-react";
import { toast } from "sonner";
import { TopNav } from "@/components/TopNav";
import { PageHeader } from "@/components/pulse/PageHeader";
import { LoadError } from "@/components/pulse/LoadError";
import { AthletePicker } from "@/components/pulse/AthletePicker";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/contexts/AuthContext";
import { Validators } from "@/lib/validators";
import { supabase } from "@/lib/supabase";
import { getPlayersWithStatsByCoach, PlayerWithStats } from "@/services/playersService";
import { sendMessage, getCoachMessageHistory } from "@/services/messagesService";

interface GroupRow {
  id: string;
  name: string;
}

interface SentAnnouncement {
  id: string;
  title: string;
  content: string;
  sentAt: string;
  scheduledAt: string | null;
  isDelivered: boolean;
  priority: string;
  recipientCount: number;
}

export default function Messages() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sendLater, setSendLater] = useState(false);
  const [selectedAthleteIds, setSelectedAthleteIds] = useState<string[]>([]);
  const [athleteGroupFilter, setAthleteGroupFilter] = useState("all");
  const [scheduledDate, setScheduledDate] = useState<Date>();

  const [athletes, setAthletes] = useState<PlayerWithStats[]>([]);
  const [groupsList, setGroupsList] = useState<GroupRow[]>([]);
  const [sent, setSent] = useState<SentAnnouncement[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setLoadError(null);
    try {
      // The generated client generics collapse to `never` on filtered queries
      // (pre-existing, see TemplatesContext) — cast like the rest of the
      // codebase until the client is typed at the source.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: coachRow } = await (supabase as any)
        .from("coaches")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle() as { data: { id: string } | null };

      const groupQuery = coachRow?.id
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase as any).from("groups").select("id, name").eq("coach_id", coachRow.id).order("name", { ascending: true })
        : supabase.from("groups").select("id, name").order("name", { ascending: true });

      const [players, groupsResult, history] = await Promise.all([
        getPlayersWithStatsByCoach(user.id),
        groupQuery,
        getCoachMessageHistory(user.id),
      ]);
      setAthletes(players);
      setGroupsList(groupsResult.data || []);
      setSent(history);
    } catch (error) {
      // Previously console-only: a failed load rendered an empty composer with no
      // groups and an empty feed, looking like a brand-new account (§4.3).
      console.error("Error loading messages data:", error);
      setLoadError(error instanceof Error ? error.message : null);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleAthlete = (id: string) => {
    setSelectedAthleteIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const resetForm = () => {
    setTitle("");
    setBody("");
    setSendLater(false);
    setSelectedAthleteIds([]);
    setAthleteGroupFilter("all");
    setScheduledDate(undefined);
  };

  const send = async () => {
    const titleError = Validators.announcementTitle(title);
    if (titleError) return toast.error(titleError);
    const messageError = Validators.announcementMessage(body);
    if (messageError) return toast.error(messageError);
    if (selectedAthleteIds.length === 0) {
      return toast.error("Select at least one athlete");
    }
    if (!user?.id) return toast.error("User not authenticated");

    setSending(true);
    try {
      const result = await sendMessage(
        user.id,
        selectedAthleteIds,
        title.trim(),
        body.trim(),
        "announcement",
        "normal",
        scheduledDate
      );
      if (result.success) {
        toast.success(
          scheduledDate
            ? `Announcement scheduled for ${format(scheduledDate, "PPP")} · ${result.count} athlete${result.count !== 1 ? "s" : ""}`
            : `Sent to ${result.count} athlete${result.count !== 1 ? "s" : ""}`
        );
        // The announcement is stored regardless, but if nobody's device was reached
        // the coach should know rather than assume everyone saw it (§6.5).
        const { notificationsSent, notificationsAttempted } = result;
        if (
          !scheduledDate &&
          notificationsAttempted != null &&
          notificationsAttempted > 0 &&
          notificationsSent === 0
        ) {
          toast.warning("Saved, but no push notifications could be delivered.", {
            description: "Athletes will still see it in the app.",
            duration: 8000,
          });
        }

        resetForm();

        // Refreshing the feed is cosmetic and must not be able to report the send
        // itself as failed. Previously this sat inside the same try, so a failing
        // reload fell through to the outer catch and showed "An error occurred while
        // sending the announcement" moments after the success toast — for a send
        // that had already committed (§5.2).
        try {
          const history = await getCoachMessageHistory(user.id);
          setSent(history);
        } catch (refreshError) {
          console.error("Announcement sent, but refreshing the feed failed:", refreshError);
        }
      } else {
        toast.error(result.error || "Failed to send announcement");
      }
    } catch (error) {
      console.error("Error sending announcement:", error);
      toast.error("An error occurred while sending the announcement");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="v-app">
      <TopNav />
      <main style={{ padding: "20px 28px 40px", maxWidth: 1320, margin: "0 auto", width: "100%" }}>
        <LoadingOverlay isLoading={loading} fullScreen message="Loading messages..." />
        <LoadingOverlay isLoading={sending} fullScreen message="Sending announcement..." />

        <PageHeader
          title="Messages"
          subtitle="Send announcements to athletes and keep a record of what went out."
        />

        {loadError !== null && (
          <div style={{ marginBottom: 20 }}>
            <LoadError
              message={loadError}
              onRetry={loadData}
              title="Couldn't load your athletes and groups"
            />
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 28, alignItems: "start" }}>
          {/* Composer */}
          <div className="v-card padded" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div className="row" style={{ gap: 8 }}>
              <span style={{ color: "var(--brand)", display: "inline-flex" }}>
                <Megaphone size={14} strokeWidth={1.5} />
              </span>
              <div className="v-h3">New announcement</div>
            </div>

            <div>
              <div className="v-label" style={{ marginBottom: 6 }}>Title</div>
              <input
                className="v-input"
                placeholder="e.g. Saturday lift moved to 9 AM"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
                style={{ width: "100%", height: 36 }}
              />
            </div>

            <div>
              <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
                <div className="v-label">Message</div>
                <span className="v-meta mono" style={{ fontSize: 10.5, color: "var(--ink-3)" }}>{body.length}/1000</span>
              </div>
              <textarea
                className="v-input"
                placeholder="Write your announcement…"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={1000}
                style={{ width: "100%", height: 150, padding: 10, resize: "vertical", lineHeight: 1.5, fontFamily: "var(--font-sans)" }}
              />
            </div>

            <div>
              <div className="v-label" style={{ marginBottom: 8 }}>When</div>
              <div className="row" style={{ gap: 8 }}>
                {([[false, "Send Now"], [true, "Send Later"]] as const).map(([later, label]) => (
                  <button
                    key={label}
                    onClick={() => {
                      setSendLater(later);
                      if (!later) setScheduledDate(undefined);
                    }}
                    className="v-btn"
                    style={{
                      height: 32,
                      fontSize: 12.5,
                      flex: 1,
                      justifyContent: "center",
                      background: sendLater === later ? "var(--ink-0)" : "var(--surface-1)",
                      color: sendLater === later ? "#fff" : "var(--ink-1)",
                      borderColor: sendLater === later ? "var(--ink-0)" : "var(--line-1)",
                    }}
                  >
                    {sendLater === later && <Check size={12} strokeWidth={1.5} />}
                    {label}
                  </button>
                ))}
              </div>
              {sendLater && (
                <div className="row" style={{ gap: 8, marginTop: 8 }}>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="v-btn" style={{ height: 32 }}>
                        <CalendarIcon size={12} strokeWidth={1.5} />
                        {scheduledDate ? format(scheduledDate, "PPP") : "Choose a date"}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={scheduledDate}
                        onSelect={setScheduledDate}
                        disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  {scheduledDate && (
                    <button className="v-btn ghost" style={{ height: 32, width: 32, padding: 0, justifyContent: "center" }} onClick={() => setScheduledDate(undefined)} title="Clear date">
                      <X size={12} strokeWidth={1.5} />
                    </button>
                  )}
                </div>
              )}
            </div>

            <div>
              <AthletePicker
                athletes={athletes}
                groupsList={groupsList}
                selected={selectedAthleteIds}
                onToggle={toggleAthlete}
                onBulk={setSelectedAthleteIds}
                filterGroup={athleteGroupFilter}
                setFilterGroup={setAthleteGroupFilter}
                loading={loading}
              />
            </div>

            <div className="row" style={{ justifyContent: "flex-end", gap: 8, borderTop: "1px solid var(--line-0)", paddingTop: 16 }}>
              <button className="v-btn ghost" onClick={resetForm} disabled={sending}>Clear</button>
              <button className="v-btn brand" onClick={send} disabled={sending}>
                <Send size={12} strokeWidth={1.5} />
                {scheduledDate ? "Schedule announcement" : "Send announcement"}
              </button>
            </div>
          </div>

          {/* Feed */}
          <div>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
              <div>
                <div className="v-h2">Recent announcements</div>
                <div className="v-meta" style={{ marginTop: 2 }}>
                  Last {sent.length} sent ·{" "}
                  <Link to="/send-programming?tab=history" style={{ color: "var(--ink-2)", textDecoration: "underline" }}>full history</Link>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {!loading && sent.length === 0 ? (
                <div className="v-card padded" style={{ textAlign: "center", color: "var(--ink-3)", fontSize: 12.5, padding: "36px 16px" }}>
                  Nothing sent yet — your announcements will appear here.
                </div>
              ) : (
                sent.map((msg) => {
                  const pendingScheduled = msg.isDelivered === false && msg.scheduledAt;
                  return (
                    <div key={msg.id} className="v-card padded" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                        <div className="row" style={{ gap: 10, minWidth: 0 }}>
                          <span className="v-avatar">
                            <Megaphone size={13} strokeWidth={1.5} />
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 13.5 }}>{msg.title}</div>
                            <div className="v-meta mono" style={{ fontSize: 10.5, color: "var(--ink-3)" }}>
                              {pendingScheduled
                                ? `Scheduled for ${format(new Date(msg.scheduledAt!), "MMM d, h:mm a")}`
                                : format(new Date(msg.sentAt), "MMM d, h:mm a")}
                            </div>
                          </div>
                        </div>
                        <div className="row" style={{ gap: 6, flexShrink: 0 }}>
                          {pendingScheduled && <span className="v-chip" data-tone="info">Scheduled</span>}
                        </div>
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.5, paddingLeft: 38 }}>{msg.content}</div>
                      <div className="row" style={{ justifyContent: "flex-end", paddingLeft: 38 }}>
                        <span className="v-meta mono row" style={{ fontSize: 10.5, color: "var(--ink-3)", gap: 4 }}>
                          <Users size={12} strokeWidth={1.5} />
                          {msg.recipientCount} recipient{msg.recipientCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
