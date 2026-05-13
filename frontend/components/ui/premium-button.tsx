import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const premiumButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "border border-emerald-400/25 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-[0_0_18px_hsl(var(--primary)/0.14)] hover:border-emerald-300/45 hover:from-emerald-400 hover:to-teal-400",
        secondary: "border border-[var(--app-border)] bg-muted/80 text-foreground hover:border-[var(--app-border-strong)] hover:bg-muted",
        glass: "border border-[var(--app-border)] bg-panel/70 text-foreground hover:border-[var(--app-border-strong)] hover:bg-muted/80",
        danger: "border border-danger/35 bg-danger/90 text-white hover:bg-danger",
        ghost: "text-muted-foreground hover:bg-muted/75 hover:text-foreground"
      },
      size: {
        default: "h-10 px-4",
        sm: "h-9 px-3",
        icon: "h-10 w-10 p-0"
      }
    },
    defaultVariants: {
      variant: "primary",
      size: "default"
    }
  }
);

export interface PremiumButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof premiumButtonVariants> {
  asChild?: boolean;
}

export const PremiumButton = React.forwardRef<HTMLButtonElement, PremiumButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(premiumButtonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
PremiumButton.displayName = "PremiumButton";
