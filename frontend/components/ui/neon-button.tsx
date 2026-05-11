import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function NeonButton({ className, ...props }: ButtonProps) {
  return (
    <Button
      className={cn(
        "border border-primary/40 bg-primary text-slate-950 shadow-[0_0_24px_hsl(var(--primary)/0.22)] hover:shadow-[0_0_30px_hsl(var(--primary)/0.32)]",
        className
      )}
      {...props}
    />
  );
}
