import { AlertTriangle, RefreshCw } from "lucide-react";

interface LoadErrorProps {
  /** What actually went wrong, when it's known. */
  message?: string | null;
  onRetry: () => void;
  title?: string;
}

/**
 * Visible failure state for a page whose data fetch failed.
 *
 * Several pages previously only console.error'd on load failure, so an RLS
 * rejection or a schema change rendered as an ordinary empty page —
 * indistinguishable from "you have no data yet" (AUDIT_FINDINGS.md §4.3).
 */
export function LoadError({ message, onRetry, title = "Couldn't load this page" }: LoadErrorProps) {
  return (
    <div
      className="v-card padded"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        textAlign: "center",
        padding: "36px 16px",
      }}
    >
      <span style={{ color: "var(--bad)", display: "inline-flex" }}>
        <AlertTriangle size={18} strokeWidth={1.5} />
      </span>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink-0)" }}>{title}</div>
      <div className="v-meta" style={{ maxWidth: 420 }}>
        {message || "Something went wrong while fetching your data."}
      </div>
      <button className="v-btn" onClick={onRetry} style={{ marginTop: 4 }}>
        <RefreshCw size={12} strokeWidth={1.5} />
        Try again
      </button>
    </div>
  );
}
