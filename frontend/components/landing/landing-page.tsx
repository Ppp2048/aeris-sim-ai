"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  BrainCircuit,
  Braces,
  DatabaseZap,
  FileJson,
  Layers3,
  type LucideIcon,
  LineChart,
  Plane,
  Radar,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Target
} from "lucide-react";
import { ContainerScroll } from "@/components/landing/container-scroll";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { AppBackground } from "@/components/ui/app-background";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PremiumCard } from "@/components/ui/premium-card";
import { PremiumButton } from "@/components/ui/premium-button";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0 }
};

const features = [
  {
    title: "Radar Digital Twin",
    description: "Synthetic scenes with moving objects, noise, clutter, detections, tracks, and replayable frames.",
    icon: Radar,
    className: "md:col-span-2"
  },
  {
    title: "Drone Detection Simulator",
    description: "Model drone signatures separately from birds, vehicles, humans, and unknown contacts.",
    icon: Plane
  },
  {
    title: "Range-Doppler Heatmaps",
    description: "Generate normalized synthetic heatmaps for local-only visualization and experiments.",
    icon: Layers3
  },
  {
    title: "CFAR Detection",
    description: "Educational 2D CA-CFAR extracts peaks from noisy simulated radar returns.",
    icon: ScanSearch
  },
  {
    title: "Kalman Tracking",
    description: "Constant-velocity tracks stabilize detections over frames with status and confidence.",
    icon: Target
  },
  {
    title: "AI Object Classification",
    description: "Classify simulated contacts with local ML profiles and no external service dependency.",
    icon: BrainCircuit,
    className: "md:col-span-2"
  },
  {
    title: "Custom Data Integration",
    description: "Bring CSV data and model adapters into the local analysis pipeline.",
    icon: DatabaseZap
  },
  {
    title: "Replay and Analytics",
    description: "Write JSONL replay frames for review, scoring, and operational analysis.",
    icon: LineChart
  }
];

const heatmapCells = Array.from({ length: 160 }, (_, index) => {
  const hot = index % 37 === 0 || index === 74 || index === 109;
  const warm = index % 17 === 0 || index % 29 === 0;
  return hot ? "bg-amber-400" : warm ? "bg-primary/80" : "bg-muted";
});

export function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <AppBackground />

      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/35 bg-primary text-slate-950 shadow-[0_0_30px_hsl(var(--primary)/0.24)]">
            <Activity size={21} />
          </div>
          <div>
            <div className="font-semibold">AERIS-Sim AI</div>
            <div className="text-xs text-muted-foreground">Simulation-only radar intelligence</div>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="ghost" asChild className="hidden sm:inline-flex">
            <Link href="/login">Login</Link>
          </Button>
          <ThemeToggle />
        </div>
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl items-center gap-8 px-4 pb-10 pt-4 lg:grid-cols-[0.92fr_1.08fr] lg:px-8 lg:pb-14">
        <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.55 }}>
          <Badge className="gap-2">
            <Sparkles size={14} />
            Local software radar digital twin
          </Badge>
          <h1 className="mt-5 max-w-3xl text-5xl font-semibold leading-[0.96] tracking-normal text-foreground md:text-7xl">
            AERIS-Sim AI
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
            Software Digital Twin for Radar Detection, Drone Tracking, and AI Classification
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <PremiumButton asChild>
              <Link href="/dashboard">
                Launch Dashboard
                <ArrowRight size={18} />
              </Link>
            </PremiumButton>
            <PremiumButton variant="secondary" asChild>
              <Link href="/simulator">View Simulator</Link>
            </PremiumButton>
          </div>
          <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-3">
            {[
              ["128x128", "Heatmaps"],
              ["CA-CFAR", "Detection"],
              ["JSONL", "Replays"]
            ].map(([value, label]) => (
              <div key={label} className="rounded-xl border border-border bg-panel/70 p-3 transition-colors hover:border-primary/35 hover:bg-panel/85">
                <div className="text-lg font-semibold text-foreground">{value}</div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.97, x: 18 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          transition={{ delay: 0.12, duration: 0.65 }}
          className="relative"
        >
          <HeroRadarVisual />
        </motion.div>
      </section>

      <AnimatedSection className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
        <SectionEyebrow icon={ShieldCheck} label="Mission systems" />
        <div className="mt-3 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h2 className="text-3xl font-semibold text-foreground md:text-4xl">Feature Bento Grid</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              A complete local workflow for simulation, detection, tracking, classification, integration, and replay analysis.
            </p>
          </div>
          <StatusBadge tone="online">Local-first architecture</StatusBadge>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                variants={fadeUp}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.35, delay: index * 0.035 }}
                className={cn(feature.className)}
              >
                <PremiumCard className="h-full min-h-44 transition-transform hover:-translate-y-0.5 hover:border-primary/35">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/12 text-primary">
                    <Icon size={21} />
                  </div>
                  <h3 className="mt-5 text-base font-semibold text-foreground">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{feature.description}</p>
                </PremiumCard>
              </motion.div>
            );
          })}
        </div>
      </AnimatedSection>

      <ContainerScroll title="Command-center visibility without the weight" eyebrow="Dashboard preview">
        <LandingDashboardPreview />
      </ContainerScroll>

      <AnimatedSection className="mx-auto grid max-w-7xl gap-5 px-4 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
        <PremiumCard className="overflow-hidden p-0">
          <div className="border-b border-border px-5 py-4">
            <SectionEyebrow icon={Radar} label="Live Preview" />
            <h2 className="mt-2 text-2xl font-semibold text-foreground">Mock radar operations screen</h2>
          </div>
          <div className="grid gap-4 p-5 md:grid-cols-[0.9fr_1.1fr]">
            <MockRadarScreen />
            <MockHeatmap />
          </div>
        </PremiumCard>
        <TargetCard />
      </AnimatedSection>

      <AnimatedSection className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
        <PremiumCard className="grid gap-6 overflow-hidden p-6 md:grid-cols-[0.85fr_1.15fr] md:p-8">
          <div>
            <SectionEyebrow icon={Braces} label="Integration Section" />
            <h2 className="mt-3 text-3xl font-semibold text-foreground">Bring your own radar data and models</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              AERIS-Sim AI is designed for local experimentation with parser and model adapter support. Start with synthetic
              frames, then connect CSV-style datasets and custom classifiers when your workflow is ready.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <PremiumButton variant="secondary" asChild>
                <Link href="/integrations">Open Integrations</Link>
              </PremiumButton>
              <PremiumButton variant="ghost" asChild>
                <Link href="/classifier">Model Lab</Link>
              </PremiumButton>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { icon: FileJson, title: "Bring radar data", body: "Map local CSV rows into simulation frames." },
              { icon: BrainCircuit, title: "Bring a model", body: "Register adapters for local classification." },
              { icon: DatabaseZap, title: "Adapter support", body: "Parser and model registries are built in." }
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="rounded-lg border border-border bg-muted/35 p-4">
                  <Icon className="text-primary" size={22} />
                  <div className="mt-4 font-semibold text-foreground">{item.title}</div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.body}</p>
                </div>
              );
            })}
          </div>
        </PremiumCard>
      </AnimatedSection>

      <footer className="mx-auto flex max-w-7xl flex-col justify-between gap-3 border-t border-border px-4 py-7 text-sm text-muted-foreground md:flex-row lg:px-8">
        <div>AERIS-Sim AI. Software-only simulation and visualization.</div>
        <div className="flex gap-4">
          <Link href="/dashboard" className="hover:text-foreground">
            Dashboard
          </Link>
          <Link href="/simulator" className="hover:text-foreground">
            Simulator
          </Link>
          <Link href="/settings" className="hover:text-foreground">
            Settings
          </Link>
        </div>
      </footer>
    </main>
  );
}

function AnimatedSection({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.section
      className={className}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-90px" }}
      transition={{ duration: 0.45 }}
    >
      {children}
    </motion.section>
  );
}

function SectionEyebrow({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
      <Icon size={15} />
      {label}
    </div>
  );
}

function HeroRadarVisual() {
  const points = [
    ["left-[62%] top-[26%]", "Drone", "bg-danger"],
    ["left-[34%] top-[48%]", "Bird", "bg-primary"],
    ["left-[52%] top-[68%]", "Vehicle", "bg-emerald-400"],
    ["left-[74%] top-[58%]", "Unknown", "bg-amber-400"]
  ];

  return (
    <PremiumCard className="relative min-h-[480px] overflow-hidden p-5 lg:min-h-[560px]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_48%,hsl(var(--primary)/0.2),transparent_18rem)]" />
      <div className="relative mx-auto mt-4 aspect-square max-h-[470px] w-full max-w-[470px] rounded-full border border-primary/25 bg-muted/20">
        <div className="absolute inset-[8%] rounded-full border border-border" />
        <div className="absolute inset-[22%] rounded-full border border-border" />
        <div className="absolute inset-[36%] rounded-full border border-border" />
        <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-border" />
        <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-border" />
        <div className="radar-sweep absolute inset-0 rounded-full" />
        <div className="absolute inset-[48%] rounded-full bg-primary shadow-[0_0_28px_hsl(var(--primary)/0.75)]" />
        {points.map(([position, label, tone]) => (
          <div key={label} className={cn("absolute", position)}>
            <div className={cn("h-3 w-3 rounded-full shadow-[0_0_18px_currentColor]", tone)} />
            <div className="mt-2 rounded-md border border-border bg-panel/90 px-2 py-1 text-xs text-foreground shadow-sm">
              {label}
            </div>
          </div>
        ))}
      </div>
      <div className="relative mt-4 grid gap-3 sm:grid-cols-3">
        <StatusBadge tone="online">Tracking</StatusBadge>
        <StatusBadge tone="warning">CFAR armed</StatusBadge>
        <StatusBadge tone="neutral">Local replay</StatusBadge>
      </div>
    </PremiumCard>
  );
}

function MockRadarScreen() {
  return (
    <div className="relative min-h-72 overflow-hidden rounded-lg border border-border bg-muted/30 p-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,hsl(var(--primary)/0.14),transparent_13rem)]" />
      <div className="relative mx-auto aspect-square max-h-64 rounded-full border border-primary/30">
        <div className="absolute inset-[18%] rounded-full border border-border" />
        <div className="absolute inset-[36%] rounded-full border border-border" />
        <div className="radar-sweep absolute inset-0 rounded-full opacity-80" />
        <div className="absolute left-[62%] top-[34%] h-2.5 w-2.5 rounded-full bg-danger" />
        <div className="absolute left-[42%] top-[62%] h-2.5 w-2.5 rounded-full bg-primary" />
      </div>
      <div className="relative mt-4 flex justify-between text-xs text-muted-foreground">
        <span>Range 1.8 km</span>
        <span>Frame 0241</span>
      </div>
    </div>
  );
}

function MockHeatmap() {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="font-semibold text-foreground">Range-Doppler Heatmap</div>
        <StatusBadge tone="online">Live</StatusBadge>
      </div>
      <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(16, minmax(0, 1fr))" }}>
        {heatmapCells.map((cell, index) => (
          <div key={index} className={cn("aspect-square rounded-[2px]", cell)} />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
        <div className="rounded-md bg-panel/70 p-2">Peak 0.94</div>
        <div className="rounded-md bg-panel/70 p-2">CFAR 6</div>
        <div className="rounded-md bg-panel/70 p-2">Noise 0.08</div>
      </div>
    </div>
  );
}

function LandingDashboardPreview() {
  return (
    <div className="grid gap-0 bg-background text-foreground md:grid-cols-[220px_1fr]">
      <div className="hidden border-r border-border bg-panel/90 p-4 md:block">
        <div className="mb-5 flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg border border-primary/30 bg-primary/15" />
          <div>
            <div className="h-2.5 w-24 rounded bg-foreground/80" />
            <div className="mt-2 h-2 w-16 rounded bg-muted-foreground/45" />
          </div>
        </div>
        {["Dashboard", "Simulator", "Classifier", "Replays"].map((item, index) => (
          <div
            key={item}
            className={cn(
              "mb-2 rounded-lg border px-3 py-2 text-xs",
              index === 0 ? "border-primary/35 bg-primary/10 text-foreground" : "border-border bg-muted/25 text-muted-foreground"
            )}
          >
            {item}
          </div>
        ))}
      </div>
      <div className="min-w-0 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="h-4 w-56 rounded bg-foreground/85" />
            <div className="mt-3 h-2.5 w-72 max-w-full rounded bg-muted-foreground/45" />
          </div>
          <StatusBadge tone="online">WebSocket live</StatusBadge>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            ["4.0", "FPS"],
            ["5", "Tracks"],
            ["94%", "Confidence"]
          ].map(([value, label]) => (
            <div key={label} className="rounded-xl border border-border bg-muted/35 p-4">
              <div className="font-mono text-2xl font-semibold">{value}</div>
              <div className="mt-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
          <MockRadarScreen />
          <MockHeatmap />
        </div>
      </div>
    </div>
  );
}

function TargetCard() {
  return (
    <PremiumCard className="relative overflow-hidden">
      <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-danger/10" />
      <SectionEyebrow icon={Target} label="Target card" />
      <div className="mt-5 flex items-center justify-between gap-4">
        <div>
          <div className="text-3xl font-semibold text-foreground">Drone</div>
          <div className="mt-1 text-sm text-muted-foreground">Track ID A-204</div>
        </div>
        <StatusBadge tone="danger">Alert</StatusBadge>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {[
          ["Confidence", "94%"],
          ["Range", "842 m"],
          ["Speed", "18 m/s"],
          ["Status", "Locked"]
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-border bg-muted/35 p-4">
            <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
            <div className="mt-2 text-xl font-semibold text-foreground">{value}</div>
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
        Drone detected with high confidence inside monitored airspace.
      </div>
    </PremiumCard>
  );
}
