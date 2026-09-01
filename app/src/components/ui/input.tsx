import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-11 w-full rounded-md bg-bg px-3 text-sm text-fg shadow-[var(--shadow-border)] placeholder:text-subtle",
        "transition-[background-color,box-shadow] duration-150 hover:bg-bg-soft",
        "focus-visible:bg-bg-soft focus-visible:outline-none focus-visible:shadow-[0_0_0_1.5px_var(--color-brand)]",
        "disabled:opacity-40",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
