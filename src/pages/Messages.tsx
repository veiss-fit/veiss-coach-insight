import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Megaphone, Send, Check, CalendarIcon, Users, X } from "lucide-react";
import { toast } from "sonner";
import { TopNav } from "@/components/TopNav";
import { PageHeader } from "@/components/pulse/PageHeader";
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
  const [priority, setPriority] = useState<"normal" | "urgent">("normal");
  const [groups, setGroups] = useState<string[]>(["all"]);
  const [scheduledDate, setScheduledDate] = useState<Date>();

  const [athletes, setAthletes] = useState<PlayerWithStats[]>([]);
  const [groupsList, setGroupsList] = useState<GroupRow[]>([]);
  const [sent, setSent] = useState<SentAnnouncement[]>([]);

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
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
      console.error("Error loading messages data:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const groupSizes = useMemo(() => {
    const sizes = new Map<string, number>();
    athletes.forEach((a) => {
      if (a.team_id) sizes.set(a.team_id, (sizes.get(a.team_id) || 0) + 1);
    });
    return sizes;
  }, [athletes]);

  const recipientIds = useMemo(() => {
    if (groups.includes("all")) return athletes.map((a) => a.id);
    return athletes.filter((a) => a.team_id && groups.includes(a.team_id)).map((a) => a.id);
  }, [groups, athletes]);

  const toggleGroup = (id: string) => {
    if (id === "all") return setGroups(["all"]);
    setGroups((prev) => {
      const base = prev.filter((g) => g !== "all");
      const next = base.includes(id) ? base.filter((g) => g !== id) : [...base, id];
      return next.length ? next : ["all"];
    });
  };

  const resetForm = () => {
    setTitle("");
    setBody("");
    setPriority("normal");
    setGroups(["all"]);
    setScheduledDate(undefined);
  };

  const send = async () => {
    const titleError = Validators.announcementTitle(title);
    if (titleError) return toast.error(titleError);
    const messageError = Validators.announcementMessage(body);
    if (messageError) return toast.error(messageError);
    if (recipientIds.length === 0) return toast.error("No athletes in the selected groups");
    if (!user?.id) return toast.error("User not authenticated");

    setSending(true);
    try {
      const result = await sendMessage(
        user.id,
        recipientIds,
        title.trim(),
        body.trim(),
        "announcement",
        priority,
        scheduledDate
      );
      if (result.success) {
        toast.success(
          scheduledDate
            ? `Announcement scheduled for ${format(scheduledDate, "PPP")} · ${result.count} athlete${result.count !== 1 ? "s" : ""}`
            : `Sent to ${result.count} athlete${result.count !== 1 ? "s" : ""}`
        );
        resetForm();
        const history = await getCoachMessageHistory(user.id);
        setSent(history);
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
          eyebrow="Coach"
          title="Messages"
          subtitle="Send announcements to athletes and keep a record of what went out."
        />

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
              <div className="v-label" style={{ marginBottom: 8 }}>Priority</div>
              <div className="row" style={{ gap: 8 }}>
                {([["normal", "Normal"], ["urgent", "Urgent"]] as const).map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setPriority(id)}
                    className="v-btn"
                    style={{
                      height: 32,
                      fontSize: 12.5,
                      flex: 1,
                      justifyContent: "center",
                      background: priority === id ? (id === "urgent" ? "var(--bad-soft)" : "var(--ink-0)") : "var(--surface-1)",
                      color: priority === id ? (id === "urgent" ? "var(--bad)" : "#fff") : "var(--ink-1)",
                      borderColor: priority === id ? (id === "urgent" ? "var(--bad)" : "var(--ink-0)") : "var(--line-1)",
                    }}
                  >
                    {priority === id && <Check size={12} strokeWidth={1.5} />}
                    {label}
                  </button>
                ))}
              </div>
              {priority === "urgent" && (
                <div style={{ marginTop: 10, padding: "9px 12px", background: "var(--bad-soft)", border: "1px solid var(--bad)", borderRadius: 7, fontSize: 11.5, color: "var(--bad)" }}>
                  Urgent announcements are highlighted in the athlete app and trigger a push notification.
                </div>
              )}
            </div>

            <div>
              <div className="v-label" style={{ marginBottom: 8 }}>
                Recipients · {recipientIds.length} athlete{recipientIds.length !== 1 ? "s" : ""}
              </div>
              <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                {[{ id: "all", name: "All groups" } as GroupRow, ...groupsList].map((g) => {
                  const on = groups.includes(g.id);
                  const size = g.id !== "all" ? groupSizes.get(g.id) ?? 0 : null;
                  return (
                    <button
                      key={g.id}
                      onClick={() => toggleGroup(g.id)}
                      className="v-btn"
                      style={{
                        height: 30,
                        fontSize: 12,
                        gap: 5,
                        background: on ? "var(--ink-0)" : "var(--surface-1)",
                        color: on ? "#fff" : "var(--ink-1)",
                        borderColor: on ? "var(--ink-0)" : "var(--line-1)",
                      }}
                    >
                      {g.id !== "all" && <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--ink-3)" }} />}
                      {g.name}
                      {size != null && <span className="mono" style={{ opacity: 0.6, fontSize: 10.5, marginLeft: 2 }}>{size}</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="v-label" style={{ marginBottom: 8 }}>Schedule (optional)</div>
              <div className="row" style={{ gap: 8 }}>
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="v-btn" style={{ height: 32 }}>
                      <CalendarIcon size={12} strokeWidth={1.5} />
                      {scheduledDate ? format(scheduledDate, "PPP") : "Send immediately"}
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
                  <button className="v-btn ghost" style={{ height: 32, width: 32, padding: 0, justifyContent: "center" }} onClick={() => setScheduledDate(undefined)} title="Clear schedule">
                    <X size={12} strokeWidth={1.5} />
                  </button>
                )}
              </div>
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
                  <Link to="/history" style={{ color: "var(--ink-2)", textDecoration: "underline" }}>full history</Link>
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
                  const urgent = msg.priority === "urgent";
                  const pendingScheduled = msg.isDelivered === false && msg.scheduledAt;
                  return (
                    <div key={msg.id} className="v-card padded" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                        <div className="row" style={{ gap: 10, minWidth: 0 }}>
                          <span className="v-avatar" style={{ background: urgent ? "var(--bad-soft)" : "var(--navy-tint)", color: urgent ? "var(--bad)" : "var(--navy)" }}>
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
                          {urgent && <span className="v-chip" data-tone="bad">Urgent</span>}
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
