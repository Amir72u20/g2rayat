import * as React from "react";
import { X } from "lucide-react";
import { Drawer } from "vaul";
import { cn } from "@/lib/utils";

export function BottomSheet({
  open,
  onOpenChange,
  title,
  children,
  className,
  footer,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  footer?: React.ReactNode;
}) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} shouldScaleBackground={false} modal>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-bg/55" />
        <Drawer.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[76dvh] flex-col rounded-t-2xl bg-surface pb-[env(safe-area-inset-bottom)] shadow-[var(--shadow-lift)] outline-none",
            className,
          )}
        >
          <div className="flex justify-center pt-2">
            <div className="h-1 w-10 rounded-full bg-line" />
          </div>
          <div className="flex items-center gap-2 px-3">
            {title ? (
              <Drawer.Title className="min-w-0 flex-1 py-2 text-sm font-semibold">{title}</Drawer.Title>
            ) : (
              <Drawer.Title className="sr-only">پنل</Drawer.Title>
            )}
            <button
              type="button"
              className="grid size-11 shrink-0 place-items-center text-muted"
              aria-label="بستن"
              onClick={() => onOpenChange(false)}
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">{children}</div>
          {footer ? <div className="shrink-0 border-t border-line px-3 py-3">{footer}</div> : null}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}