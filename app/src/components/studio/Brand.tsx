import { cn } from "@/lib/utils";

/**
 * The mark: a comic page (paper, two gutters) with a speech bubble sitting in
 * the top panel. Drawn with theme tokens so it reads on both themes and in the
 * PWA icon slot without a second asset.
 */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className={cn("size-6", className)}>
      <rect x="3.2" y="3.2" width="25.6" height="25.6" rx="7" fill="var(--color-paper)" />
      <path
        d="M3.2 20.6 H28.8 M18.4 20.6 V28.8"
        stroke="var(--color-ink)"
        strokeOpacity="0.28"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path d="M11.4 15.9 L11.4 20.4 L16.1 15.9 Z" fill="var(--color-brand)" />
      <rect x="7" y="7" width="18" height="9.4" rx="4.7" fill="var(--color-brand)" />
      <rect
        x="3.2"
        y="3.2"
        width="25.6"
        height="25.6"
        rx="7"
        stroke="var(--color-ink)"
        strokeOpacity="0.35"
        strokeWidth="1.2"
      />
    </svg>
  );
}

export function Wordmark({ subtitle, className }: { subtitle?: string; className?: string }) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <span className="material grid size-10 shrink-0 place-items-center rounded-xl bg-elevated">
        <Mark className="size-6" />
      </span>
      <div className="min-w-0 leading-none">
        <div className="font-display text-[22px] leading-none tracking-normal">کادر</div>
        {subtitle ? (
          <div className="mt-1 truncate text-[11px] font-medium text-muted">{subtitle}</div>
        ) : null}
      </div>
    </div>
  );
}
