import { useEffect, useState } from "react";

/** Narrowest window (px) the app is laid out for. Below it the page is replaced by a notice. Not tuned on screen yet. */
export const MIN_SCREEN_WIDTH = 900;

const QUERY = `(min-width: ${MIN_SCREEN_WIDTH}px)`;

/**
 * Below MIN_SCREEN_WIDTH the cards squash and the text breaks, so nothing is rendered
 * but a notice. Widening the window brings the page back where it was.
 */
export function MinScreenGate({ children }: { children: React.ReactNode }) {
  const [wideEnough, setWideEnough] = useState(() => window.matchMedia(QUERY).matches);

  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const update = () => setWideEnough(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  if (wideEnough) return <>{children}</>;

  return (
    <div
      role="alert"
      style={{
        position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24, textAlign: "center", background: "var(--surface-0, #fff)", color: "var(--ink-1)", zIndex: 9999,
      }}
    >
      <div style={{ maxWidth: 360 }}>
        <div className="v-h2" style={{ color: "var(--ink-0)" }}>Screen too small</div>
        <p className="v-meta" style={{ marginTop: 8, fontSize: 13 }}>
          This website is not designed to perform on a screen this small. Use a larger window or device.
        </p>
      </div>
    </div>
  );
}
