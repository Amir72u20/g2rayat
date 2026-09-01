import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

/** Track + thumb are positioned with logical insets, so the knob travels the
 *  correct way in both RTL and LTR without a mirrored transform. */
export const Switch = React.forwardRef<
  React.ComponentRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      "tap relative inline-flex h-7 w-12 shrink-0 rounded-full bg-line shadow-[inset_0_1px_2px_rgba(0,0,0,0.25)]",
      "transition-colors duration-200 data-[state=checked]:bg-brand",
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        "pointer-events-none absolute top-1/2 block size-[22px] -translate-y-1/2 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.4)]",
        "start-[3px] transition-[inset-inline-start] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
        "data-[state=checked]:start-[calc(100%-25px)]",
      )}
    />
  </SwitchPrimitive.Root>
));
Switch.displayName = "Switch";
