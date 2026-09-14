import { ArrowUp, ArrowDown, Minus, HelpCircle } from "lucide-react";
import { classifyLoadRec } from "@/lib/targetEvaluation";

export function GroupChip({ name, dot }: { name: string; dot?: string }) {
  return (
    <span className="v-chip" data-tone="neutral">
      {dot && <span className="dot" style={{ background: dot }} />}
      {name}
    </span>
  );
}

/**
 * Renders whatever PlayerWithStats.loadRec actually is. Buckets by prefix/
 * exact-match via the shared classifyLoadRec (see src/lib/targetEvaluation.ts)
 * instead of comparing against a fixed literal string — the original bug here
 * was comparing against "Increase"/"Decrease" when the real values were
 * "Increase Load"/"Decrease Load (Fatigue)", so this chip silently rendered
 * "Maintain" for every athlete regardless of their real recommendation.
 */
export function LoadRecChip({ rec }: { rec: string }) {
  const map: Record<string, { tone: string; icon: React.ReactNode; label: string }> = {
    increase: { tone: "good", icon: <ArrowUp size={12} strokeWidth={1.5} />, label: "Increase" },
    decrease: { tone: "warn", icon: <ArrowDown size={12} strokeWidth={1.5} />, label: "Reduce" },
    maintain: { tone: "neutral", icon: <Minus size={12} strokeWidth={1.5} />, label: "Maintain" },
    "no-target": { tone: "neutral", icon: <HelpCircle size={12} strokeWidth={1.5} />, label: "No target" },
    new: { tone: "neutral", icon: <Minus size={12} strokeWidth={1.5} />, label: "New" },
    unknown: { tone: "neutral", icon: <Minus size={12} strokeWidth={1.5} />, label: rec || "—" },
  };
  const m = map[classifyLoadRec(rec)];
  return (
    <span className="v-chip" data-tone={m.tone}>
      {m.icon}
      {m.label}
    </span>
  );
}

export function EngagementChip({ level }: { level: string }) {
  const tone = level === "High" ? "good" : level === "Low" ? "bad" : "neutral";
  return (
    <span className="v-chip" data-tone={tone}>
      <span className="dot" />
      {level}
    </span>
  );
}
