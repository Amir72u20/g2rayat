import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

export const Slider = React.forwardRef<
  React.ComponentRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, value, defaultValue, ...props }, ref) => {
  const count = Array.isArray(value)
    ? value.length
    : Array.isArray(defaultValue)
      ? defaultValue.length
      : 1;
  return (
    <SliderPrimitive.Root
      ref={ref}
      value={value}
      defaultValue={defaultValue}
      className={cn(
        "relative flex h-9 w-full touch-none select-none items-center",
        "[&_[role=slider]]:transition-transform [&_[role=slider]]:duration-150",
        "[&_[role=slider]:active]:scale-110",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-2.5 w-full grow overflow-hidden rounded-full bg-line shadow-[inset_0_1px_2px_rgba(0,0,0,0.22)]">
        <SliderPrimitive.Range className="absolute h-full bg-brand" />
      </SliderPrimitive.Track>
      {Array.from({ length: Math.max(1, count) }).map((_, i) => (
        <SliderPrimitive.Thumb
          key={i}
          className="block size-6 rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.45),0_0_0_1px_rgba(0,0,0,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        />
      ))}
    </SliderPrimitive.Root>
  );
});
Slider.displayName = "Slider";
