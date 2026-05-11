"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Activity,
  BrainCircuit,
  CircleDot,
  Cpu,
  Gauge,
  Map,
  Radar,
  RadioTower,
  ScanSearch,
  ShieldAlert,
  Target,
  Timer
} from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { MetricCard } from "@/components/ui/metric-card";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { startSimulation } from "@/lib/api";
import { simulationSocketUrl } from "@/lib/websocket";
import type { FrameDetection, SceneObject, SimulationFrame, Track } from "@/lib/types";
import { cn } from "@/lib/utils";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

const RADAR_RANGE_M = 3000;
const MAX_VELOCITY_MPS = 120;

export function MonitoringDashboard() {
  const [frame, setFrame] = useState<SimulationFrame>(() => createMockFrame(1));
  const [demoMode, setDemoMode] = useState(false);
  const [connected, setConnected] = useState(false);
  const lastUpdate = useRef(0);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let demoTimer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    function startDemo() {
      if (cancelled) return;
      setDemoMode(true);
      setConnected(false);
      let id = 1;
      demoTimer = setInterval(() => {
        id += 1;
        setFrame(createMockFrame(id));
      }, 900);
    }

    startSimulation()
      .then(() => {
        if (cancelled) return;
        socket = new WebSocket(simulationSocketUrl());
        socket.onopen = () => {
          setConnected(true);
          setDemoMode(false);
        };
        socket.onmessage = (event) => {
          const now = Date.now();
          if (now - lastUpdate.current < 280) return;
          lastUpdate.current = now;
          const data = JSON.parse(event.data) as Partial<SimulationFrame> & { type?: string };
          if (data.type === "status" || !data.heatmap) return;
          setFrame(data as SimulationFrame);
        };
        socket.onerror = startDemo;
        socket.onclose = () => {
          if (!cancelled && !demoTimer) startDemo();
        };
      })
      .catch(startDemo);

    return () => {
      cancelled = true;
      socket?.close();
      if (demoTimer) clearInterval(demoTimer);
    };
  }, []);

  const enrichedTracks = useMemo(() => enrichTracks(frame.tracks, frame.detections, frame.objects), [frame]);
  const primaryDetection = frame.detections[0] ?? createMockFrame(0).detections[0];

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Mission Monitoring Dashboard"
        description="Live synthetic radar frames, detections, classifications, tracks, alerts, and system metrics."
        actions={
          <>
            {demoMode && <StatusBadge tone="warning">Demo mode</StatusBadge>}
            <StatusBadge tone={connected ? "online" : "neutral"}>{connected ? "WebSocket live" : "Local preview"}</StatusBadge>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Simulated FPS" value={frame.stats.simulated_fps.toFixed(1)} icon={Gauge} tone="text-primary" />
        <MetricCard label="Active Tracks" value={frame.stats.active_tracks} icon={Target} tone="text-emerald-500" />
        <MetricCard label="Detections/Frame" value={frame.stats.detection_count} icon={ScanSearch} tone="text-amber-500" />
        <MetricCard label="Noise Level" value={frame.stats.noise_level.toFixed(2)} icon={RadioTower} tone="text-cyan-500" />
        <MetricCard label="Inference" value={`${modelInferenceMs(frame)} ms`} icon={Cpu} tone="text-danger" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.05fr_1.2fr_0.8fr]">
        <RadarSweepPanel objects={frame.objects} detections={frame.detections} />
        <HeatmapPanel frame={frame} />
        <ClassificationPanel detection={primaryDetection} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <TargetTrackingTable tracks={enrichedTracks} />
        <AlertsFeed alerts={frame.alerts} frameId={frame.frame_id} />
      </div>

      <MiniMapPanel objects={frame.objects} tracks={enrichedTracks} />
    </div>
  );
}

function RadarSweepPanel({ objects, detections }: { objects: SceneObject[]; detections: FrameDetection[] }) {
  return (
    <GlassCard className="overflow-hidden">
      <PanelTitle icon={Radar} title="Radar Sweep" detail={`${objects.length} objects`} />
      <div className="relative mx-auto mt-4 aspect-square max-h-[410px] rounded-full border border-primary/30 bg-muted/20">
        <div className="absolute inset-[10%] rounded-full border border-border" />
        <div className="absolute inset-[25%] rounded-full border border-border" />
        <div className="absolute inset-[40%] rounded-full border border-danger/40" />
        <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-border" />
        <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-border" />
        <div className="radar-sweep absolute inset-0 rounded-full opacity-75" />
        <div className="absolute inset-[48%] rounded-full bg-primary shadow-[0_0_24px_hsl(var(--primary)/0.75)]" />
        {objects.map((object) => (
          <RadarBlip key={object.id} object={object} />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
        <div className="rounded-md bg-muted/45 p-2">Range {RADAR_RANGE_M / 1000} km</div>
        <div className="rounded-md bg-muted/45 p-2">Detections {detections.length}</div>
        <div className="rounded-md bg-muted/45 p-2">Zone 300 m</div>
      </div>
    </GlassCard>
  );
}

function RadarBlip({ object }: { object: SceneObject }) {
  const radius = Math.min(object.range_m / RADAR_RANGE_M, 1) * 42;
  const angle = ((object.angle_deg - 90) * Math.PI) / 180;
  const x = 50 + Math.cos(angle) * radius;
  const y = 50 + Math.sin(angle) * radius;
  return (
    <div className="absolute" style={{ left: `${x}%`, top: `${y}%` }}>
      <div
        className={cn(
          "h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[0_0_16px_currentColor]",
          object.label === "drone"
            ? "bg-danger text-danger"
            : object.label === "unknown"
              ? "bg-amber-400 text-amber-400"
              : "bg-primary text-primary"
        )}
      />
    </div>
  );
}

function HeatmapPanel({ frame }: { frame: SimulationFrame }) {
  const x = frame.heatmap[0]?.map((_, index) => index) ?? [];
  const y = frame.heatmap.map((_, index) => index);
  return (
    <GlassCard className="min-h-[430px]">
      <PanelTitle icon={Activity} title="Range-Doppler Heatmap" detail={`Frame ${frame.frame_id}`} />
      <Plot
        data={[
          {
            z: frame.heatmap,
            x,
            y,
            type: "heatmap",
            colorscale: [
              [0, "#0f172a"],
              [0.32, "#0891b2"],
              [0.66, "#f59e0b"],
              [1, "#f8fafc"]
            ],
            showscale: false
          },
          {
            x: frame.detections.map((detection) => detection.range_bin),
            y: frame.detections.map((detection) => detection.doppler_bin),
            mode: "markers",
            type: "scatter",
            marker: { color: "#f97316", size: 8, symbol: "circle-open", line: { width: 2 } },
            name: "Detections"
          }
        ]}
        layout={{
          autosize: true,
          height: 345,
          paper_bgcolor: "rgba(0,0,0,0)",
          plot_bgcolor: "rgba(0,0,0,0)",
          font: { color: "hsl(var(--muted-foreground))" },
          margin: { l: 36, r: 8, t: 12, b: 34 },
          xaxis: { title: { text: "Range bin" }, gridcolor: "hsl(var(--border))" },
          yaxis: { title: { text: "Doppler bin" }, gridcolor: "hsl(var(--border))" },
          showlegend: false
        }}
        config={{ displayModeBar: false, responsive: true }}
        className="w-full"
      />
    </GlassCard>
  );
}

function ClassificationPanel({ detection }: { detection: FrameDetection }) {
  const predictions = topPredictions(detection);
  const threat = threatLevel(detection);
  return (
    <GlassCard>
      <PanelTitle icon={BrainCircuit} title="AI Classification" detail="local model" />
      <div className="mt-5 rounded-lg border border-border bg-muted/35 p-4">
        <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Predicted class</div>
        <div className="mt-2 text-3xl font-semibold capitalize text-foreground">{detection.classification}</div>
        <div className="mt-2 text-sm text-muted-foreground">Confidence {Math.round(detection.confidence * 100)}%</div>
      </div>
      <div className="mt-4 space-y-3">
        {predictions.map((item) => (
          <div key={item.label}>
            <div className="mb-1 flex justify-between text-xs">
              <span className="capitalize text-muted-foreground">{item.label}</span>
              <span className="text-foreground">{Math.round(item.score * 100)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(item.score * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 flex items-center justify-between rounded-lg border border-border bg-panel/60 p-3">
        <span className="text-sm text-muted-foreground">Threat level</span>
        <StatusBadge tone={threat === "High" ? "danger" : threat === "Medium" ? "warning" : "online"}>{threat}</StatusBadge>
      </div>
      <div className="mt-3 text-xs text-muted-foreground">Model status: local classifier online</div>
    </GlassCard>
  );
}

function TargetTrackingTable({ tracks }: { tracks: EnrichedTrack[] }) {
  return (
    <GlassCard>
      <PanelTitle icon={Target} title="Target Tracking Table" detail={`${tracks.length} tracks`} />
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            <tr>
              <th className="pb-3">Track ID</th>
              <th className="pb-3">Class</th>
              <th className="pb-3">Range</th>
              <th className="pb-3">Velocity</th>
              <th className="pb-3">Angle</th>
              <th className="pb-3">Confidence</th>
              <th className="pb-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {tracks.map((track) => (
              <tr key={track.track_id} className="text-muted-foreground">
                <td className="py-3 font-medium text-foreground">#{track.track_id}</td>
                <td className="py-3 capitalize">{track.classification}</td>
                <td className="py-3">{track.range_m.toFixed(1)} m</td>
                <td className="py-3">{track.velocity_mps.toFixed(1)} m/s</td>
                <td className="py-3">{track.angle_deg.toFixed(0)} deg</td>
                <td className="py-3">{Math.round(track.confidence * 100)}%</td>
                <td className="py-3">
                  <StatusBadge tone={track.status === "lost" ? "danger" : track.status === "locked" ? "online" : "neutral"}>
                    {track.status}
                  </StatusBadge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}

function AlertsFeed({ alerts, frameId }: { alerts: string[]; frameId: number }) {
  const normalizedAlerts = alerts.length ? alerts : ["system_nominal"];
  return (
    <GlassCard>
      <PanelTitle icon={ShieldAlert} title="Alerts Feed" detail={`Frame ${frameId}`} />
      <div className="mt-4 space-y-3">
        {normalizedAlerts.map((alert) => {
          const danger = alert.includes("breach") || alert.includes("drone") || alert.includes("unknown");
          return (
            <div key={alert} className="flex gap-3 rounded-lg border border-border bg-muted/35 p-3">
              <AlertTriangle className={danger ? "text-danger" : "text-emerald-500"} size={18} />
              <div>
                <div className="text-sm font-medium capitalize text-foreground">{alert.replaceAll("_", " ")}</div>
                <div className="text-xs text-muted-foreground">{danger ? "Operator review recommended" : "No active incident"}</div>
              </div>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}

function MiniMapPanel({ objects, tracks }: { objects: SceneObject[]; tracks: EnrichedTrack[] }) {
  return (
    <GlassCard>
      <PanelTitle icon={Map} title="Mini Map / Airspace View" detail={`${objects.length} contacts`} />
      <div className="relative mt-4 h-72 overflow-hidden rounded-lg border border-border bg-muted/30">
        <div className="absolute inset-6 rounded-full border border-danger/35" />
        <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
        <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
        {objects.map((object) => {
          const left = 50 + Math.sin((object.angle_deg * Math.PI) / 180) * Math.min(object.range_m / RADAR_RANGE_M, 1) * 42;
          const top = 88 - Math.min(object.range_m / RADAR_RANGE_M, 1) * 76;
          return (
            <div key={object.id} className="absolute" style={{ left: `${left}%`, top: `${top}%` }}>
              <CircleDot className={object.label === "drone" ? "text-danger" : "text-primary"} size={18} />
            </div>
          );
        })}
        <div className="absolute bottom-3 left-3 rounded-md border border-border bg-panel/85 px-3 py-2 text-xs text-muted-foreground">
          {tracks.filter((track) => track.status !== "lost").length} locked or active tracks
        </div>
      </div>
    </GlassCard>
  );
}

function PanelTitle({ icon: Icon, title, detail }: { icon: typeof Radar; title: string; detail?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/12 text-primary">
          <Icon size={18} />
        </div>
        <h2 className="font-semibold text-foreground">{title}</h2>
      </div>
      {detail && <span className="text-xs text-muted-foreground">{detail}</span>}
    </div>
  );
}

type EnrichedTrack = Track & {
  classification: string;
  angle_deg: number;
};

function enrichTracks(tracks: Track[], detections: FrameDetection[], objects: SceneObject[]): EnrichedTrack[] {
  return tracks.map((track) => {
    const detection = nearestByRange(track.range_m, detections);
    const object = nearestByRange(track.range_m, objects);
    return {
      ...track,
      classification: detection?.classification ?? object?.label ?? "unknown",
      angle_deg: object?.angle_deg ?? 0
    };
  });
}

function nearestByRange<T extends { range_m?: number; estimated_range_m?: number }>(range: number, items: T[]) {
  if (!items.length) return undefined;
  return items.reduce((best, item) => {
    const itemRange = item.range_m ?? item.estimated_range_m ?? 0;
    const bestRange = best.range_m ?? best.estimated_range_m ?? 0;
    return Math.abs(itemRange - range) < Math.abs(bestRange - range) ? item : best;
  });
}

function topPredictions(detection: FrameDetection) {
  const primary = Math.max(detection.confidence, 0.52);
  const secondary = Math.max(0.08, (1 - primary) * 0.58);
  const tertiary = Math.max(0.06, 1 - primary - secondary);
  const labels = ["drone", "vehicle", "unknown"].filter((label) => label !== detection.classification);
  return [
    { label: detection.classification, score: primary },
    { label: labels[0] ?? "unknown", score: secondary },
    { label: labels[1] ?? "bird", score: tertiary }
  ];
}

function threatLevel(detection: FrameDetection) {
  if (detection.classification === "drone" && detection.confidence > 0.7) return "High";
  if (detection.classification === "unknown" || detection.confidence > 0.65) return "Medium";
  return "Low";
}

function modelInferenceMs(frame: SimulationFrame) {
  return Math.round(8 + frame.detections.length * 1.7 + frame.stats.noise_level * 20);
}

function createMockFrame(frameId: number): SimulationFrame {
  const objects: SceneObject[] = [
    { id: 1, label: "drone", range_m: 780 + frameId * 8, velocity_mps: 18, angle_deg: 18, rcs: 12, altitude_m: 90, heading_deg: 45 },
    { id: 2, label: "vehicle", range_m: 1320 - frameId * 4, velocity_mps: -12, angle_deg: -28, rcs: 30, altitude_m: 0, heading_deg: 270 },
    { id: 3, label: "unknown", range_m: 230, velocity_mps: 3, angle_deg: 42, rcs: 7, altitude_m: 0, heading_deg: 180 }
  ];
  const heatmap = Array.from({ length: 64 }, (_, row) =>
    Array.from({ length: 64 }, (_, col) => {
      const p1 = Math.exp(-((row - 38) ** 2 + (col - 24 - (frameId % 6)) ** 2) / 80);
      const p2 = Math.exp(-((row - 28) ** 2 + (col - 44) ** 2) / 60);
      return Number(Math.min(1, 0.08 + p1 * 0.9 + p2 * 0.55 + ((row + col + frameId) % 11) * 0.006).toFixed(4));
    })
  );
  const detections: FrameDetection[] = [
    { range_bin: 24 + (frameId % 6), doppler_bin: 38, confidence: 0.91, estimated_range_m: objects[0].range_m, estimated_velocity_mps: 18, power: 0.96, classification: "drone" },
    { range_bin: 44, doppler_bin: 28, confidence: 0.74, estimated_range_m: objects[1].range_m, estimated_velocity_mps: -12, power: 0.72, classification: "vehicle" },
    { range_bin: 8, doppler_bin: 32, confidence: 0.66, estimated_range_m: objects[2].range_m, estimated_velocity_mps: 3, power: 0.61, classification: "unknown" }
  ];
  const tracks: Track[] = detections.map((detection, index) => ({
    track_id: index + 1,
    range_m: detection.estimated_range_m,
    velocity_mps: detection.estimated_velocity_mps,
    confidence: detection.confidence,
    age: frameId + index,
    status: index === 0 ? "locked" : "tracking"
  }));
  return {
    frame_id: frameId,
    timestamp: new Date().toISOString(),
    heatmap,
    detections,
    tracks,
    objects,
    alerts: ["drone_detected", "restricted_zone_breach", "unknown_object"],
    stats: {
      active_tracks: tracks.length,
      detection_count: detections.length,
      avg_confidence: 0.77,
      noise_level: 0.08,
      simulated_fps: 4.0
    }
  };
}
