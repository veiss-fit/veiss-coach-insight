import { ArrowUp, ArrowDown, Minus } from "lucide-react";

export function GroupChip({ name, dot }: { name: string; dot?: string }) {
  return (
    <span className="v-chip" data-tone="neutral">
      {dot && <span className="dot" style={{ background: dot }} />}
      {name}
    </span>
  );
}

export function LoadRecChip({ rec }: { rec: string }) {
  const map: Record<string, { tone: string; icon: React.ReactNode; label: string }> = {
    Increase: { tone: "good", icon: <ArrowUp size={12} strokeWidth={1.5} />, label: "Increase" },
    Maintain: { tone: "neutral", icon: <Minus size={12} strokeWidth={1.5} />, label: "Maintain" },
    Decrease: { tone: "warn", icon: <ArrowDown size={12} strokeWidth={1.5} />, label: "Reduce" },
  };
  const m = map[rec] || map.Maintain;
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
