import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { PageHeader } from "@/components/pulse/PageHeader";
import { HistoryPanel } from "@/components/pulse/HistoryPanel";

/**
 * Standalone /history route, kept for deep links (e.g. Messages' "full
 * history"). The primary entry point is now the History tab inside Send
 * Programming — this page isn't in top nav anymore (D18, D63).
 */
export default function History() {
  return (
    <div className="v-app">
      <TopNav />
      <main style={{ padding: "20px 28px 40px", maxWidth: 1060, margin: "0 auto", width: "100%" }}>
        <Link to="/" className="v-btn ghost" style={{ marginBottom: 6, height: 36, fontSize: 13, padding: "0 16px 0 10px", width: "fit-content" }}>
          <ArrowLeft size={14} strokeWidth={1.5} />
          Back to dashboard
        </Link>
        <PageHeader title="History" subtitle="Everything you've sent to your athletes, newest first." />

        <HistoryPanel />
      </main>
    </div>
  );
}
