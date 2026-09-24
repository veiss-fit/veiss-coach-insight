import { Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useFollowedAthletes, MAX_FOLLOWED } from "@/contexts/FollowedAthletesContext";
import { athleteFacts } from "@/lib/metrics/athleteFacts";
import { attentionFlags } from "@/lib/metrics/attentionFlags";
import { FollowedAthleteCard, AddFollowCard } from "./FollowedAthleteCard";

/**
 * Toggle tab + slide-out drawer for the coach's followed athletes. Rendered once at the app
 * root (outside <Routes>, in App.tsx) so it stays mounted — and the drawer stays open — across
 * page navigation, instead of living inside Index.tsx and resetting on every route change.
 * Only coaches have a profile that resolves past AuthContext's role gate, so it renders nothing
 * for a signed-out visitor (login/signup) or mid-auth-check.
 */
export function FollowedAthletesPanel() {
  const { profile } = useAuth();
  const { athletes, followedAthletes, followedIds, setFollowedIds, signalsByPlayer, panelOpen, setPanelOpen, openAthlete, thresholds } =
    useFollowedAthletes();

  if (!profile) return null;

  const now = Date.now();
  const followedFlagged = followedAthletes.map(
    (a) => attentionFlags(athleteFacts(a, signalsByPlayer.get(a.id), now), thresholds).flagged
  );

  return (
    <>
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: panelOpen ? 280 : 0,
          transform: "translateY(-50%)",
          zIndex: 41,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          transition: "left 0.18s ease",
        }}
      >
        <button
          type="button"
          onClick={() => setPanelOpen((v) => !v)}
          aria-label={panelOpen ? "Close followed athletes" : "Open followed athletes"}
          aria-expanded={panelOpen}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
            padding: "12px 6px",
            border: "1px solid var(--line-2)",
            borderLeft: panelOpen ? "1px solid var(--line-2)" : "none",
            borderRadius: "0 8px 8px 0",
            background: "var(--surface-1)",
            color: "var(--ink-1)",
            cursor: "pointer",
          }}
        >
          <Users size={14} strokeWidth={1.5} />
          <span className="v-meta" style={{ writingMode: "vertical-rl", fontSize: 10.5, letterSpacing: 0.3 }}>
            Followed
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {Array.from({ length: MAX_FOLLOWED }, (_, i) => followedAthletes[i]).map((a, i) => (
              <span
                key={a?.id ?? `empty-${i}`}
                title={a ? `${a.name}${followedFlagged[i] ? " · flagged" : ""}` : "Empty slot"}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: !a ? "var(--line-2)" : followedFlagged[i] ? "var(--bad)" : "var(--good)",
                  flexShrink: 0,
                }}
              />
            ))}
          </div>
        </button>
      </div>

      {panelOpen && (
        <div
          onClick={() => setPanelOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", zIndex: 39 }}
        />
      )}

      <div
        style={{
          position: "fixed",
          top: 0,
          bottom: 0,
          left: panelOpen ? 0 : -281,
          width: 280,
          zIndex: 40,
          background: "var(--surface-1)",
          borderRight: "1px solid var(--line-2)",
          boxShadow: panelOpen ? "2px 0 16px rgba(0,0,0,0.15)" : "none",
          transition: "left 0.18s ease",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          padding: 16,
          overflowY: "auto",
        }}
      >
        <div className="v-label">Followed athletes</div>
        {followedAthletes.map((a) => (
          <FollowedAthleteCard
            key={a.id}
            athlete={a}
            signals={signalsByPlayer.get(a.id)}
            thresholds={thresholds}
            onOpen={openAthlete}
            onUnfollow={(x) => setFollowedIds(followedIds.filter((id) => id !== x.id))}
          />
        ))}
        {followedAthletes.length < MAX_FOLLOWED && (
          <AddFollowCard
            choices={athletes.filter((a) => !followedIds.includes(a.id))}
            onAdd={(a) => setFollowedIds([...followedIds, a.id])}
          />
        )}
      </div>
    </>
  );
}
