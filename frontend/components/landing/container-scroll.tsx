"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";

export function ContainerScroll({
  children,
  className,
  title,
  eyebrow
}: {
  children: React.ReactNode;
  className?: string;
  title: string;
  eyebrow?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const rotateX = useTransform(scrollYProgress, [0.05, 0.45, 0.8], [10, 0, -4]);
  const scale = useTransform(scrollYProgress, [0.05, 0.45, 0.8], [0.93, 1, 0.97]);
  const y = useTransform(scrollYProgress, [0.05, 0.55], [36, 0]);

  return (
    <section ref={ref} className={cn("relative mx-auto max-w-7xl px-4 py-12 lg:px-8", className)}>
      <div className="mx-auto mb-7 max-w-3xl text-center">
        {eyebrow && <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{eyebrow}</div>}
        <h2 className="mt-3 text-3xl font-semibold text-foreground md:text-5xl">{title}</h2>
      </div>
      <div className="[perspective:1200px]">
        <motion.div
          style={{ rotateX, scale, y, transformPerspective: 1200 }}
          className="animated-border-card overflow-hidden rounded-2xl p-2 shadow-2xl"
        >
          <div className="overflow-hidden rounded-xl border border-border bg-background">{children}</div>
        </motion.div>
      </div>
    </section>
  );
}
