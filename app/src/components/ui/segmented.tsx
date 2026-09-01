import * as React from "react";
import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
  title?: string;
}

/**
 * Segmented control with a sliding thumb — one tap per option instead of a
 * dropdown, which is the difference between two taps and four on a phone.
 * The thumb is a single translated element so the move is one composited
 * animation rather than a colour swap.
 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
  size = "default",
  ariaLabel,
}: {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (v: T) => void;
  className?: string;
  size?: "sm" | "default";
  ariaLabel?: string;
}) {
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const n = options.length;
  // Track = container minus its 0.25rem padding on both sides.
  const cell = `((100% - 0.5rem) / ${n})`;

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "relative isolate grid rounded-md bg-elevated p-1 shadow-[var(--shadow-border)]",
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden
        className="absolute inset-y-1 -z-10 rounded-[9px] bg-surface shadow-[var(--shadow-hair)] transition-[inset-inline-start] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{
          width: `calc(${cell})`,
          insetInlineStart: `calc(0.25rem + ${cell} * ${index})`,
        }}
      />
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cn(
              "tap z-10 flex items-center justify-center gap-1.5 rounded-[9px] px-2 font-medium [&_svg]:size-4",
              size === "sm" ? "h-8 text-[11px]" : "h-9 text-xs",
              active ? "text-fg" : "text-muted hover:text-fg",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
