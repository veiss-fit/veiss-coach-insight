import { useLayoutEffect, useRef, useState } from "react";

export interface BlobOption<T extends string = string> {
  id: T;
  label: string;
}

interface BlobSelectorProps<T extends string> {
  options: BlobOption<T>[];
  value: T;
  onChange: (id: T) => void;
}

const PAD = 4;
/** Fast start, long soft landing, no overshoot. */
const EASE = "450ms cubic-bezier(0.32, 0.72, 0, 1)";

/**
 * Horizontal selector. One gold blob sits behind the active option and slides to
 * the next one on change, with a smooth ease-out and no bounce.
 * The blob is measured from the buttons, so options can have different widths.
 */
export function BlobSelector<T extends string>({ options, value, onChange }: BlobSelectorProps<T>) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [box, setBox] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const el = refs.current[value];
      if (el) setBox({ left: el.offsetLeft, width: el.offsetWidth });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [value, options]);

  return (
    <div
      role="tablist"
      style={{
        position: "relative",
        display: "inline-flex",
        padding: PAD,
        gap: 2,
        borderRadius: 999,
        border: "1px solid var(--line-0)",
        background: "var(--surface-2, transparent)",
      }}
    >
      {box && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: PAD,
            bottom: PAD,
            left: 0,
            width: box.width,
            transform: `translateX(${box.left}px)`,
            borderRadius: 999,
            background: "var(--brand)",
            transition: `transform ${EASE}, width ${EASE}`,
          }}
        />
      )}
      {options.map((o) => (
        <button
          key={o.id}
          ref={(el) => {
            refs.current[o.id] = el;
          }}
          role="tab"
          aria-selected={value === o.id}
          type="button"
          onClick={() => onChange(o.id)}
          style={{
            position: "relative",
            border: 0,
            background: "transparent",
            padding: "7px 16px",
            borderRadius: 999,
            font: "inherit",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            color: value === o.id ? "var(--brand-ink)" : "var(--ink-2)",
            transition: "color 200ms",
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
