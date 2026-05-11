"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const telemetry = Array.from({ length: 18 }, (_, index) => ({
  tick: index,
  snr: 18 + Math.sin(index / 2) * 4 + (index % 3),
  tracks: 2 + Math.round(Math.cos(index / 3) * 2 + index / 7)
}));

export function SystemChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Signal Telemetry</CardTitle>
        <span className="text-xs text-slate-400">Synthetic trend preview</span>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={telemetry}>
              <XAxis dataKey="tick" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip contentStyle={{ background: "#020617", border: "1px solid #334155", color: "#e2e8f0" }} />
              <Line type="monotone" dataKey="snr" stroke="#22d3ee" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="tracks" stroke="#f59e0b" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
