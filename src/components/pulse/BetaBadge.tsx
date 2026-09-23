import { FlaskConical, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={label}
            style={{ display: "inline-flex", border: "none", background: "transparent", padding: 2, cursor: "help", color: "var(--ink-2)" }}
          >
            <Info size={13} strokeWidth={1.5} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="end" style={{ maxWidth: 280, fontSize: 12, lineHeight: 1.45 }}>
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
