import * as React from "react";
import { X } from "lucide-react";
import { Drawer } from "vaul";
import { cn } from "@/lib/utils";

/**
 * The phone's primary surface. Everything the editor puts here has to survive
 * one-handed use: a wide grab bar, a header that stays put, a scroll area that
 * doesn't leak its overscroll to the page, and a footer parked above the
 * gesture bar.
 */
export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  footer,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  footer?: React.ReactNode;
}) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} shouldScaleBackground={false} modal>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px]" />
        <Drawer.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col rounded-t-3xl bg-surface outline-none",
            "shadow-[0_-1px_0_0_var(--color-line),var(--shadow-lift)] pb-[env(safe-area-inset-bottom)]",
            className,
          )}
        >
          {/* Grab bar: a real 44px-tall target, not a decorative 4px line. */}
          <div className="flex h-6 shrink-0 cursor-grab items-center justify-center active:cursor-grabbing">
            <div className="h-1.5 w-11 rounded-full bg-line" />
          </div>
          <div className="flex items-start gap-2 px-4 pb-1">
            {title ? (
              <div className="min-w-0 flex-1 py-1">
                <Drawer.Title className="truncate text-[15px] font-semibold">{title}</Drawer.Title>
                {description ? (
                  <p className="mt-0.5 text-[11px] leading-snug text-muted">{description}</p>
                ) : null}
              </div>
            ) : (
              <Drawer.Title className="sr-only">پنل</Drawer.Title>
            )}
            <button
              type="button"
              className="tap -me-1 grid size-10 shrink-0 place-items-center rounded-full bg-elevated text-muted hover:text-fg"
              aria-label="بستن"
              onClick={() => onOpenChange(false)}
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-1">
            {children}
          </div>
          {footer ? (
            <div className="shrink-0 border-t border-line bg-surface px-4 py-3">{footer}</div>
          ) : null}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
