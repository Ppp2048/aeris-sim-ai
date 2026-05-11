import { Activity, Crosshair, RadioTower, ScanSearch } from "lucide-react";
import { MetricCard } from "@/components/ui/metric-card";
import type { SimulationResponse } from "@/lib/types";

export function MetricGrid({ data }: { data: SimulationResponse | null }) {
  const metrics = [
    { label: "Targets", value: data?.summary.targets ?? 0, icon: Crosshair, tone: "text-cyan-200" },
    { label: "Detections", value: data?.summary.detections ?? 0, icon: ScanSearch, tone: "text-amber-200" },
    { label: "Peak Power", value: data?.summary.peak_power ?? "0.0000", icon: Activity, tone: "text-emerald-200" },
    { label: "Mode", value: "Local", icon: RadioTower, tone: "text-rose-200" }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => {
        return (
          <MetricCard key={metric.label} label={metric.label} value={metric.value} icon={metric.icon} tone={metric.tone} />
        );
      })}
    </div>
  );
}
