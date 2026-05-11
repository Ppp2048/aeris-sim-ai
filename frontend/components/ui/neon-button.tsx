import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function NeonButton({ className, ...props }: ButtonProps) {
  return (
    <Button
      className={cn(
        "neon-hover border border-primary/40 bg-primary text-slate-950 shadow-[0_0_28px_hsl(var(--primary)/0.24)] hover:shadow-[0_0_34px_hsl(var(--primary)/0.36)]",
        className
      )}
      {...props}
    />
  );
}
