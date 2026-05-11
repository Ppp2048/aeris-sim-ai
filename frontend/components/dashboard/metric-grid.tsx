import { Activity, Crosshair, RadioTower, ScanSearch } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
        const Icon = metric.icon;
        return (
          <Card key={metric.label}>
            <CardContent className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{metric.label}</div>
                <div className="mt-2 text-2xl font-semibold text-white">{metric.value}</div>
              </div>
              <Icon className={metric.tone} size={28} />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
