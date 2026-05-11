"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, BrainCircuit, Radar, ScanSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden">
      <section className="relative flex min-h-[92vh] items-center px-4 py-10 lg:px-12">
        <div className="mx-auto grid w-full max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <Badge>Simulation-only radar digital twin</Badge>
            <h1 className="mt-5 max-w-3xl text-5xl font-semibold leading-tight text-white md:text-7xl">
              Aeris Sim AI
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
              A local software console for synthetic target scenes, range-Doppler heatmaps, CFAR detection,
              Kalman tracking, and custom ML classification.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/dashboard">
                  Open Console
                  <ArrowRight size={18} />
                </Link>
              </Button>
              <Button variant="secondary" asChild>
                <Link href="/simulator">Run Simulator</Link>
              </Button>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.55 }}
            className="glass-panel relative min-h-[520px] overflow-hidden rounded-lg p-5"
          >
            <div className="scanline absolute inset-x-0 top-0 h-24" />
            <div className="grid h-full gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-slate-700 bg-slate-950/80 p-4">
                <div className="flex items-center gap-2 text-cyan-100">
                  <Radar size={18} />
                  Range-Doppler Field
                </div>
                <div className="mt-4 grid grid-cols-12 gap-1">
                  {Array.from({ length: 144 }, (_, index) => (
                    <div
                      key={index}
                      className="aspect-square rounded-[2px]"
                      style={{
                        backgroundColor:
                          index % 29 === 0 || index % 41 === 0
                            ? "#f59e0b"
                            : index % 17 === 0
                              ? "#22d3ee"
                              : "rgba(30, 41, 59, 0.9)"
                      }}
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                {[
                  { label: "CFAR detection", icon: ScanSearch, value: "24 tracks" },
                  { label: "Kalman fusion", icon: Radar, value: "stable IDs" },
                  { label: "ML classifier", icon: BrainCircuit, value: "local model" }
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="rounded-lg border border-slate-700 bg-slate-950/80 p-4">
                      <Icon className="text-cyan-200" size={22} />
                      <div className="mt-3 text-sm text-slate-400">{item.label}</div>
                      <div className="mt-1 text-xl font-semibold text-white">{item.value}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </main>
  );
}
