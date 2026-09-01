import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

export function DropdownMenuContent({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        sideOffset={8}
        collisionPadding={12}
        className={cn(
          "material z-50 min-w-48 overflow-hidden rounded-lg bg-elevated p-1.5 shadow-[var(--shadow-lift)]",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
          "data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1",
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

export function DropdownMenuItem({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item>) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        "tap flex min-h-10 cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 text-sm text-fg outline-none",
        "[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-subtle",
        "data-[highlighted]:bg-overlay data-[highlighted]:[&_svg]:text-fg data-[disabled]:opacity-40",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuLabel({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("px-2.5 pb-1 pt-1.5 text-[11px] font-semibold text-subtle", className)}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("-mx-1.5 my-1 h-px bg-line", className)} {...props} />;
}

export function DropdownMenuShortcut({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span dir="ltr" className={cn("num ms-auto text-[10px] text-subtle", className)} {...props} />
  );
}
