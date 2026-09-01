import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/65 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <DialogPrimitive.Content
        className={cn(
          "material fixed z-50 p-5 shadow-[var(--shadow-lift)]",
          // Phone first: docked to the bottom edge, thumb-reachable, safe-area
          // aware — no transform, so nothing can push it off screen.
          "inset-x-0 bottom-0 w-full rounded-t-2xl pb-[calc(1.25rem+env(safe-area-inset-bottom))]",
          // Tablet and up: a centred card.
          "sm:inset-auto sm:start-1/2 sm:top-1/2 sm:w-[min(520px,calc(100vw-24px))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:pb-5 sm:rtl:translate-x-1/2",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
          "data-[state=open]:slide-in-from-bottom-4 sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:zoom-out-95",
          className,
        )}
        {...props}
      >
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-line sm:hidden" />
        {children}
        <DialogPrimitive.Close className="tap absolute top-3 end-3 inline-flex size-9 items-center justify-center rounded-md text-muted hover:bg-elevated hover:text-fg">
          <X className="size-4" />
          <span className="sr-only">بستن</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogTitle({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title className={cn("pe-10 text-lg font-semibold", className)} {...props} />
  );
}

export function DialogDescription({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn("mt-1 text-sm leading-relaxed text-muted", className)}
      {...props}
    />
  );
}
