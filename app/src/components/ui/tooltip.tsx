import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return (
    <TooltipPrimitive.Provider delayDuration={320} skipDelayDuration={120}>
      {children}
    </TooltipPrimitive.Provider>
  );
}

/**
 * Pointer-only affordance: a touch device gets no hover, so the tooltip is
 * hidden there rather than firing on long-press and fighting the gesture.
 */
export function Tooltip({
  content,
  side = "bottom",
  shortcut,
  children,
}: {
  content: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  shortcut?: string;
  children: React.ReactNode;
}) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={8}
          collisionPadding={10}
          className={cn(
            "z-50 hidden items-center gap-2 rounded-md bg-overlay px-2.5 py-1.5 text-xs text-fg shadow-[var(--shadow-lift)]",
            "[@media(hover:hover)]:flex data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95",
          )}
        >
          {content}
          {shortcut ? (
            <kbd dir="ltr" className="num rounded bg-bg/70 px-1.5 py-0.5 text-[10px] text-muted">
              {shortcut}
            </kbd>
          ) : null}
          <TooltipPrimitive.Arrow className="fill-[var(--color-overlay)]" width={10} height={5} />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
