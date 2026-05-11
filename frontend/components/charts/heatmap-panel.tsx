"use client";

import dynamic from "next/dynamic";
import type { SimulationResponse } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

export function HeatmapPanel({ data }: { data: SimulationResponse | null }) {
  return (
    <Card className="min-h-[430px]">
      <CardHeader>
        <CardTitle>Range-Doppler Heatmap</CardTitle>
        <span className="text-xs text-slate-400">Synthetic power field</span>
      </CardHeader>
      <CardContent>
        {data ? (
          <Plot
            data={[
              {
                z: data.heatmap,
                x: data.range_axis,
                y: data.velocity_axis,
                type: "heatmap",
                colorscale: [
                  [0, "#111827"],
                  [0.35, "#0ea5e9"],
                  [0.65, "#f59e0b"],
                  [1, "#f8fafc"]
                ],
                colorbar: { title: { text: "Power" } }
              }
            ]}
            layout={{
              autosize: true,
              height: 350,
              paper_bgcolor: "rgba(0,0,0,0)",
              plot_bgcolor: "rgba(0,0,0,0)",
              font: { color: "#cbd5e1" },
              margin: { l: 56, r: 20, t: 10, b: 48 },
              xaxis: { title: { text: "Range (m)" }, gridcolor: "#1e293b" },
              yaxis: { title: { text: "Velocity (m/s)" }, gridcolor: "#1e293b" }
            }}
            config={{ displayModeBar: false, responsive: true }}
            className="w-full"
          />
        ) : (
          <div className="flex h-[350px] items-center justify-center rounded-lg border border-slate-800 bg-slate-950 text-slate-500">
            Run a synthetic sweep to render the heatmap.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
