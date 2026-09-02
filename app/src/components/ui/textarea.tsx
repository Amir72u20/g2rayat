import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-20 w-full resize-y rounded-md bg-bg px-3 py-2 text-sm leading-relaxed text-fg shadow-[var(--shadow-border)] placeholder:text-subtle",
        "transition-[background-color,box-shadow] duration-150 hover:bg-bg-soft",
        "focus-visible:bg-bg-soft focus-visible:outline-none focus-visible:shadow-[0_0_0_1.5px_var(--color-brand)]",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";
