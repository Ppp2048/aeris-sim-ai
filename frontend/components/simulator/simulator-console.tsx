"use client";

import { useEffect, useState } from "react";
import { Loader2, Play, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NeonButton } from "@/components/ui/neon-button";
import { SectionHeader } from "@/components/ui/section-header";
import { DetectionTable } from "@/components/dashboard/detection-table";
import { MetricGrid } from "@/components/dashboard/metric-grid";
import { HeatmapPanel } from "@/components/charts/heatmap-panel";
import { runSimulation } from "@/lib/api";
import type { SimulationResponse } from "@/lib/types";

export function SimulatorConsole({ autoRun = false }: { autoRun?: boolean }) {
  const [data, setData] = useState<SimulationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function execute() {
    setLoading(true);
    setError(null);
    try {
      setData(await runSimulation());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (autoRun) {
      void execute();
    }
  }, [autoRun]);

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Radar Digital Twin"
        description="Synthetic range-Doppler generation, CFAR detection, Kalman tracking, and local classification."
        actions={
          <>
          <NeonButton onClick={execute} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Play size={18} />}
            Run Sweep
          </NeonButton>
          <Button variant="secondary" onClick={() => setData(null)}>
            <RefreshCcw size={18} />
            Reset
          </Button>
          </>
        }
      />
      {error && <div className="rounded-md border border-rose-400/40 bg-rose-400/10 p-3 text-sm text-rose-100">{error}</div>}
      <MetricGrid data={data} />
      <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <HeatmapPanel data={data} />
        <DetectionTable detections={data?.detections ?? []} />
      </div>
    </div>
  );
}
