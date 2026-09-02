import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Native <select> in the studio's clothing.
 *
 * The popup stays the platform's own — Android's wheel, Windows' list — which
 * is the part users already know how to drive; only the closed control is
 * restyled so it stops looking like a stray browser widget among our fields.
 */
export const Select = React.forwardRef<
  HTMLSelectElement,
  React.ComponentProps<"select"> & { wrapClassName?: string }
>(({ className, wrapClassName, children, ...props }, ref) => (
  <div className={cn("relative w-full", wrapClassName)}>
    <select
      ref={ref}
      className={cn(
        "tap h-11 w-full appearance-none rounded-md bg-bg ps-3 pe-9 text-sm text-fg shadow-[var(--shadow-border)] hover:bg-elevated disabled:opacity-40",
        "focus-visible:outline-none focus-visible:shadow-[0_0_0_1.5px_var(--color-brand)]",
        className,
      )}
      {...props}
    >
      {children}
    </select>
    <ChevronDown className="pointer-events-none absolute top-1/2 end-3 size-4 -translate-y-1/2 text-subtle" />
  </div>
));
Select.displayName = "Select";
