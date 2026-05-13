"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function GlowCard({ className, onPointerMove, style, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const frameRef = React.useRef<number | null>(null);
  const pointRef = React.useRef<{ x: number; y: number; element: HTMLDivElement } | null>(null);

  React.useEffect(() => {
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse") {
      onPointerMove?.(event);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    pointRef.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      element: event.currentTarget
    };

    if (frameRef.current === null) {
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        const point = pointRef.current;
        if (!point) return;
        point.element.style.setProperty("--glow-x", `${point.x}px`);
        point.element.style.setProperty("--glow-y", `${point.y}px`);
      });
    }

    onPointerMove?.(event);
  }

  return (
    <div
      className={cn("glow-card rounded-xl p-5 text-panel-foreground", className)}
      onPointerMove={handlePointerMove}
      style={style}
      {...props}
    />
  );
}
