import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "neon-hover border border-primary/40 bg-primary text-slate-950 shadow-[0_0_24px_hsl(var(--primary)/0.16)] hover:-translate-y-0.5 hover:bg-primary/90 dark:text-slate-950",
        secondary:
          "border border-border bg-panel/80 text-foreground hover:-translate-y-0.5 hover:border-primary/35 hover:bg-muted/80",
        ghost: "text-muted-foreground hover:bg-muted/75 hover:text-foreground",
        danger:
          "border border-danger/40 bg-danger text-white shadow-[0_0_24px_hsl(var(--danger)/0.14)] hover:-translate-y-0.5 hover:bg-danger/90"
      },
      size: {
        default: "h-10 px-4",
        sm: "h-9 px-3",
        icon: "h-10 w-10 p-0"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
