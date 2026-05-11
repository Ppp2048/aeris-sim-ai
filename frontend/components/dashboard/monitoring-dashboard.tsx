"use client";

import dynamic from "next/dynamic";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { Data, Layout } from "plotly.js";
import {
  AlertTriangle,
  Activity,
  BrainCircuit,
  CircleDot,
  Cpu,
  DatabaseZap,
  Gauge,
  Map,
  Radar,
  RadioTower,
  ScanSearch,
  ShieldAlert,
  Target,
  WifiOff
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { GlassCard } from "@/components/ui/glass-card";
import { MetricCard } from "@/components/ui/metric-card";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Toast } from "@/components/ui/toast";
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
  const [toast, setToast] = useState<{ tone: "success" | "warning" | "error"; message: string } | null>(null);
  const lastUpdate = useRef(0);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let demoTimer: ReturnType<typeof setInterval> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempt = 0;
    let cancelled = false;

    function clearDemoTimer() {
      if (demoTimer) {
        clearInterval(demoTimer);
        demoTimer = null;
      }
    }

    function startDemo(message = "Live backend stream unavailable. Showing realistic local demo data.") {
      if (cancelled || demoTimer) return;
      setDemoMode(true);
      setConnected(false);
      setToast({ tone: "warning", message });
      let id = 1;
      demoTimer = setInterval(() => {
        id += 1;
        setFrame(createMockFrame(id));
      }, 900);
    }

    function scheduleReconnect() {
      if (cancelled || reconnectTimer) return;
      const delay = Math.min(3000 + reconnectAttempt * 1500, 10000);
      reconnectAttempt += 1;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, delay);
    }

    function connect() {
      startSimulation()
        .then(() => {
        if (cancelled) return;
        socket = new WebSocket(simulationSocketUrl());
        socket.onopen = () => {
          reconnectAttempt = 0;
          clearDemoTimer();
          setConnected(true);
          setDemoMode(false);
          setToast({ tone: "success", message: "Live simulation stream connected." });
        };
        socket.onmessage = (event) => {
          const now = Date.now();
          if (now - lastUpdate.current < 420) return;
          lastUpdate.current = now;
          try {
            const data = JSON.parse(event.data) as Partial<SimulationFrame> & { type?: string };
            if (data.type === "status" || !data.heatmap) return;
            setFrame(data as SimulationFrame);
          } catch {
            startDemo();
          }
        };
        socket.onerror = () => {
          startDemo();
          scheduleReconnect();
        };
        socket.onclose = () => {
          if (!cancelled) {
            startDemo();
            scheduleReconnect();
          }
        };
      })
        .catch(() => {
          startDemo();
          scheduleReconnect();
        });
    }

    connect();

    return () => {
      cancelled = true;
      socket?.close();
      clearDemoTimer();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3800);
    return () => clearTimeout(timer);
  }, [toast]);

  const enrichedTracks = useMemo(() => enrichTracks(frame.tracks, frame.detections, frame.objects), [frame]);
  const primaryDetection = frame.detections[0] ?? createMockFrame(0).detections[0];

  return (
    <div className="space-y-5">
      {toast && <Toast tone={toast.tone} message={toast.message} onDismiss={() => setToast(null)} />}
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

      {demoMode && (
        <GlassCard className="flex flex-col gap-3 border-amber-400/35 bg-amber-400/10 p-4 text-amber-800 dark:text-amber-100 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <WifiOff className="mt-0.5 shrink-0" size={19} />
            <div>
              <div className="font-semibold">Demo mode active</div>
              <div className="text-sm opacity-85">
                The dashboard is using fallback simulation data and will reconnect to the local WebSocket automatically.
              </div>
            </div>
          </div>
          <StatusBadge tone="warning">Reconnecting</StatusBadge>
        </GlassCard>
      )}

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

const RadarSweepPanel = memo(function RadarSweepPanel({ objects, detections }: { objects: SceneObject[]; detections: FrameDetection[] }) {
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
});

const RadarBlip = memo(function RadarBlip({ object }: { object: SceneObject }) {
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
});

const HeatmapPanel = memo(function HeatmapPanel({ frame }: { frame: SimulationFrame }) {
  const plotData = useMemo<Data[]>(() => {
    const x = frame.heatmap[0]?.map((_, index) => index) ?? [];
    const y = frame.heatmap.map((_, index) => index);
    return [
      {
        z: frame.heatmap,
        x,
        y,
        type: "heatmap" as const,
        colorscale: [
          [0, "#07111f"],
          [0.25, "#075985"],
          [0.52, "#06b6d4"],
          [0.76, "#f59e0b"],
          [1, "#f8fafc"]
        ] as [number, string][],
        showscale: false,
        hoverinfo: "skip" as const
      },
      {
        x: frame.detections.map((detection) => detection.range_bin),
        y: frame.detections.map((detection) => detection.doppler_bin),
        mode: "markers" as const,
        type: "scatter" as const,
        marker: { color: "#fb923c", size: 8, symbol: "circle-open", line: { width: 2 } },
        name: "Detections",
        hoverinfo: "skip" as const
      }
    ];
  }, [frame.detections, frame.heatmap]);

  const layout = useMemo<Partial<Layout>>(
    () => ({
      autosize: true,
      height: 345,
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: { color: "hsl(var(--muted-foreground))" },
      margin: { l: 36, r: 8, t: 12, b: 34 },
      xaxis: { title: { text: "Range bin" }, gridcolor: "hsl(var(--border))", zeroline: false },
      yaxis: { title: { text: "Doppler bin" }, gridcolor: "hsl(var(--border))", zeroline: false },
      showlegend: false
    }),
    []
  );

  return (
    <GlassCard className="min-h-[430px]">
      <PanelTitle icon={Activity} title="Range-Doppler Heatmap" detail={`Frame ${frame.frame_id}`} />
      <Plot
        data={plotData}
        layout={layout}
        config={{ displayModeBar: false, responsive: true }}
        className="w-full"
      />
    </GlassCard>
  );
});

const ClassificationPanel = memo(function ClassificationPanel({ detection }: { detection: FrameDetection }) {
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
});

const TargetTrackingTable = memo(function TargetTrackingTable({ tracks }: { tracks: EnrichedTrack[] }) {
  return (
    <GlassCard>
      <PanelTitle icon={Target} title="Target Tracking Table" detail={`${tracks.length} tracks`} />
      {!tracks.length ? (
        <EmptyState
          className="mt-4"
          icon={DatabaseZap}
          title="No active tracks"
          description="Tracks will appear after detections are associated across simulation frames."
        />
      ) : (
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[760px] border-separate border-spacing-y-2 text-left text-sm">
          <thead className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            <tr>
              <th className="px-3 pb-1">Track ID</th>
              <th className="px-3 pb-1">Class</th>
              <th className="px-3 pb-1">Range</th>
              <th className="px-3 pb-1">Velocity</th>
              <th className="px-3 pb-1">Angle</th>
              <th className="px-3 pb-1">Confidence</th>
              <th className="px-3 pb-1">Status</th>
            </tr>
          </thead>
          <tbody>
            {tracks.map((track) => (
              <tr key={track.track_id} className="rounded-lg text-muted-foreground">
                <td className="rounded-l-lg border-y border-l border-border bg-muted/25 px-3 py-3 font-medium text-foreground">#{track.track_id}</td>
                <td className="border-y border-border bg-muted/25 px-3 py-3 capitalize">{track.classification}</td>
                <td className="border-y border-border bg-muted/25 px-3 py-3">{track.range_m.toFixed(1)} m</td>
                <td className="border-y border-border bg-muted/25 px-3 py-3">{track.velocity_mps.toFixed(1)} m/s</td>
                <td className="border-y border-border bg-muted/25 px-3 py-3">{track.angle_deg.toFixed(0)} deg</td>
                <td className="border-y border-border bg-muted/25 px-3 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(track.confidence * 100)}%` }} />
                    </div>
                    {Math.round(track.confidence * 100)}%
                  </div>
                </td>
                <td className="rounded-r-lg border-y border-r border-border bg-muted/25 px-3 py-3">
                  <StatusBadge tone={track.status === "lost" ? "danger" : track.status === "locked" ? "online" : "neutral"}>
                    {track.status}
                  </StatusBadge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </GlassCard>
  );
});

const AlertsFeed = memo(function AlertsFeed({ alerts, frameId }: { alerts: string[]; frameId: number }) {
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
});

const MiniMapPanel = memo(function MiniMapPanel({ objects, tracks }: { objects: SceneObject[]; tracks: EnrichedTrack[] }) {
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
});

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
    { id: 1, label: "drone", range_m: 820 - frameId * 6, velocity_mps: -18, angle_deg: 22, rcs: 12, altitude_m: 110, heading_deg: 214 },
    { id: 2, label: "bird", range_m: 1450 + frameId * 3, velocity_mps: 9, angle_deg: -34, rcs: 4, altitude_m: 70, heading_deg: 78 },
    { id: 3, label: "vehicle", range_m: 1880 - frameId * 8, velocity_mps: -24, angle_deg: 8, rcs: 36, altitude_m: 0, heading_deg: 270 },
    { id: 4, label: "human", range_m: 420 + frameId * 0.6, velocity_mps: 1.8, angle_deg: -12, rcs: 7, altitude_m: 0, heading_deg: 18 },
    { id: 5, label: "unknown", range_m: 270 + frameId * 1.2, velocity_mps: 3.5, angle_deg: 42, rcs: 9, altitude_m: 12, heading_deg: 165 }
  ];
  const heatmap = Array.from({ length: 64 }, (_, row) =>
    Array.from({ length: 64 }, (_, col) => {
      const p1 = Math.exp(-((row - 38) ** 2 + (col - 24 - (frameId % 6)) ** 2) / 80);
      const p2 = Math.exp(-((row - 28) ** 2 + (col - 44) ** 2) / 60);
      const p3 = Math.exp(-((row - 48) ** 2 + (col - 10) ** 2) / 46);
      const p4 = Math.exp(-((row - 33) ** 2 + (col - 8) ** 2) / 32);
      return Number(Math.min(1, 0.08 + p1 * 0.9 + p2 * 0.55 + p3 * 0.34 + p4 * 0.42 + ((row + col + frameId) % 11) * 0.006).toFixed(4));
    })
  );
  const detections: FrameDetection[] = [
    { range_bin: 24 + (frameId % 6), doppler_bin: 38, confidence: 0.91, estimated_range_m: objects[0].range_m, estimated_velocity_mps: -18, power: 0.96, classification: "drone" },
    { range_bin: 44, doppler_bin: 28, confidence: 0.72, estimated_range_m: objects[1].range_m, estimated_velocity_mps: 9, power: 0.58, classification: "bird" },
    { range_bin: 10, doppler_bin: 48, confidence: 0.68, estimated_range_m: objects[2].range_m, estimated_velocity_mps: -24, power: 0.64, classification: "vehicle" },
    { range_bin: 8, doppler_bin: 33, confidence: 0.66, estimated_range_m: objects[4].range_m, estimated_velocity_mps: 3.5, power: 0.61, classification: "unknown" }
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
