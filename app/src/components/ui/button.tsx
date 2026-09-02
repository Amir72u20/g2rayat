import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "tap inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // The one loud button — the action a screen exists for.
        default:
          "bg-brand text-brand-fg shadow-[var(--shadow-brand)] hover:bg-brand-hi active:brightness-95",
        neutral: "bg-primary text-primary-fg shadow-[var(--shadow-hair)] hover:opacity-92",
        secondary: "bg-elevated text-fg shadow-[var(--shadow-hair)] hover:bg-overlay",
        outline: "bg-transparent text-fg shadow-[var(--shadow-border)] hover:bg-elevated",
        ghost: "bg-transparent text-muted hover:bg-elevated hover:text-fg",
        destructive:
          "bg-danger/12 text-danger shadow-[var(--shadow-border)] hover:bg-danger/20 hover:text-danger",
        steel: "bg-steel text-bg shadow-[var(--shadow-hair)] hover:bg-steel-hi",
      },
      size: {
        default: "h-11 min-h-11 px-4 text-sm",
        sm: "h-9 min-h-9 px-3 text-xs",
        lg: "h-12 min-h-12 px-5 text-sm",
        icon: "size-11 min-h-11 min-w-11",
        "icon-sm": "size-9 min-h-9 min-w-9",
        "icon-lg": "size-12 min-h-12 min-w-12",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
