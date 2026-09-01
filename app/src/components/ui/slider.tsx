import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

export const Slider = React.forwardRef<
  React.ComponentRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, value, defaultValue, ...props }, ref) => {
  const count = Array.isArray(value) ? value.length : Array.isArray(defaultValue) ? defaultValue.length : 1;
  return (
    <SliderPrimitive.Root
      ref={ref}
      value={value}
      defaultValue={defaultValue}
      className={cn("relative flex h-8 w-full touch-none select-none items-center", className)}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-line">
        <SliderPrimitive.Range className="absolute h-full bg-steel" />
      </SliderPrimitive.Track>
      {Array.from({ length: Math.max(1, count) }).map((_, i) => (
        <SliderPrimitive.Thumb
          key={i}
          className="block size-6 rounded-full bg-primary shadow-[var(--shadow-border)] focus-visible:outline-none"
        />
      ))}
    </SliderPrimitive.Root>
  );
});
Slider.displayName = "Slider";
