import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const TONES = {
  default: "bg-elevated text-muted shadow-[var(--shadow-border)]",
  brand: "bg-brand/15 text-brand",
  ok: "bg-ok/15 text-ok",
  warn: "bg-warn/15 text-warn",
  danger: "bg-danger/15 text-danger",
} as const;

export function Badge({
  className,
  tone = "default",
  children,
}: {
  className?: string;
  tone?: keyof typeof TONES;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
