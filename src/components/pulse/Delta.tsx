import { ArrowUp, ArrowDown, Minus } from "lucide-react";

interface DeltaProps {
  value: number | null | undefined;
  suffix?: string;
  neutralThreshold?: number;
  /** Set when a decrease is good (e.g. velocity drop-off). */
  invert?: boolean;
  fontSize?: number;
}

export function Delta({ value, suffix = "", neutralThreshold = 0.005, invert = false, fontSize = 11.5 }: DeltaProps) {
  if (value == null || isNaN(value)) return <span className="v-mute2 mono">—</span>;
  const isNeutral = Math.abs(value) < neutralThreshold;
  const isPos = isNeutral ? false : value > 0;
  const goodIsUp = !invert;
  const tone = isNeutral ? "neutral" : isPos === goodIsUp ? "good" : "bad";
  const I = isNeutral ? Minus : isPos ? ArrowUp : ArrowDown;
  const color = tone === "good" ? "var(--good)" : tone === "bad" ? "var(--bad)" : "var(--ink-3)";
  return (
    <span className="row mono" style={{ color, gap: 3, fontSize, fontWeight: 500 }}>
      <I size={12} strokeWidth={1.5} />
      <span>
        {(value > 0 ? "+" : "") + (Math.abs(value) < 1 ? value.toFixed(2) : value.toFixed(1))}
        {suffix}
      </span>
    </span>
  );
}
