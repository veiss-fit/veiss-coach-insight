import { FlaskConical } from "lucide-react";
import { InfoTip } from "./InfoTip";

/**
 * Marks a card/graph whose data isn't real yet — either the metric isn't computed at all
 * (bogus/mock data throughout) or only part of the card is (see the card's own doc comment
 * for which). Always pair with mock data; never wire this badge to a real, shipped card.
 */
export function BetaBadge() {
  return (
    <span className="v-chip" data-tone="info" title="Preview: not wired to real data yet">
      <FlaskConical size={11} strokeWidth={1.75} />
      Beta
    </span>
  );
}

/** (i) tooltip for a beta card's metric — one to two sentences, no examples. */
export function MetricInfoTip({ label, text }: { label: string; text: string }) {
  return <InfoTip label={label}>{text}</InfoTip>;
}
