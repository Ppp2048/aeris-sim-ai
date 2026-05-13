"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Bird,
  Car,
  CloudFog,
  Crosshair,
  Download,
  Gauge,
  LocateFixed,
  Pause,
  Play,
  Plus,
  Radar,
  RefreshCcw,
  Save,
  ShieldAlert,
  SkipForward,
  SlidersHorizontal,
  Trash2,
  User,
  Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PremiumCard } from "@/components/ui/premium-card";
import { PremiumButton } from "@/components/ui/premium-button";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Toast } from "@/components/ui/toast";
import {
  configureSimulationScene,
  getCurrentSimulationFrame,
  startSimulation,
  stepSimulation,
  stopSimulation
} from "@/lib/api";
import { simulationSocketUrl } from "@/lib/websocket";
import type { FrameDetection, SceneConfig, SceneObject, SimulationFrame } from "@/lib/types";
import { cn } from "@/lib/utils";

type Label = SceneObject["label"];
type RadarSettings = Omit<SceneConfig, "objects"> & {
  cfar_threshold_scale: number;
  guard_cells: number;
  training_cells: number;
};

const LABELS: Label[] = ["drone", "bird", "vehicle", "human", "clutter", "unknown"];

const DEFAULT_SETTINGS: RadarSettings = {
  radar_range_m: 3000,
  max_velocity_mps: 120,
  noise_level: 0.08,
  clutter_level: 0.04,
  frame_rate: 4,
  cfar_threshold_scale: 4,
  guard_cells: 2,
  training_cells: 8
};

const PRESETS: Record<string, SceneObject[]> = {
  "Single Drone Intrusion": [
    { id: 1, label: "drone", range_m: 760, velocity_mps: 19, angle_deg: 18, rcs: 12, altitude_m: 105, heading_deg: 42 }
  ],
  "Bird Flock": [
    { id: 1, label: "bird", range_m: 520, velocity_mps: 8, angle_deg: -28, rcs: 4, altitude_m: 42, heading_deg: 96 },
    { id: 2, label: "bird", range_m: 610, velocity_mps: 11, angle_deg: -18, rcs: 5, altitude_m: 58, heading_deg: 104 },
    { id: 3, label: "bird", range_m: 700, velocity_mps: 9, angle_deg: -7, rcs: 4.5, altitude_m: 50, heading_deg: 112 }
  ],
  "Vehicle Crossing": [
    { id: 1, label: "vehicle", range_m: 1420, velocity_mps: -28, angle_deg: -36, rcs: 38, altitude_m: 0, heading_deg: 276 },
    { id: 2, label: "vehicle", range_m: 1880, velocity_mps: 32, angle_deg: 22, rcs: 42, altitude_m: 0, heading_deg: 82 }
  ],
  "Heavy Clutter": [
    { id: 1, label: "clutter", range_m: 260, velocity_mps: 0.6, angle_deg: -48, rcs: 3, altitude_m: 0, heading_deg: 0 },
    { id: 2, label: "clutter", range_m: 390, velocity_mps: -0.4, angle_deg: 14, rcs: 4, altitude_m: 0, heading_deg: 0 },
    { id: 3, label: "clutter", range_m: 620, velocity_mps: 1.1, angle_deg: 45, rcs: 5, altitude_m: 0, heading_deg: 0 },
    { id: 4, label: "unknown", range_m: 910, velocity_mps: 4, angle_deg: -5, rcs: 7, altitude_m: 8, heading_deg: 180 }
  ],
  "Multi Target Scene": [
    { id: 1, label: "drone", range_m: 840, velocity_mps: 18, angle_deg: 17, rcs: 11, altitude_m: 95, heading_deg: 45 },
    { id: 2, label: "vehicle", range_m: 1360, velocity_mps: -24, angle_deg: -32, rcs: 35, altitude_m: 0, heading_deg: 270 },
    { id: 3, label: "human", range_m: 430, velocity_mps: 2.6, angle_deg: 36, rcs: 6, altitude_m: 1.7, heading_deg: 8 },
    { id: 4, label: "bird", range_m: 670, velocity_mps: 10, angle_deg: -14, rcs: 4.2, altitude_m: 54, heading_deg: 96 },
    { id: 5, label: "unknown", range_m: 1120, velocity_mps: 7, angle_deg: 2, rcs: 8, altitude_m: 15, heading_deg: 210 }
  ]
};

export function SimulatorConsole({ autoRun = false }: { autoRun?: boolean }) {
  const [settings, setSettings] = useState<RadarSettings>(DEFAULT_SETTINGS);
  const [objects, setObjects] = useState<SceneObject[]>(PRESETS["Multi Target Scene"]);
  const [frame, setFrame] = useState<SimulationFrame | null>(null);
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Scene ready");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ tone: "success" | "error" | "warning"; message: string } | null>(null);
  const [replayPath, setReplayPath] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const didAutoRun = useRef(false);

  const scene = useMemo<SceneConfig>(
    () => ({
      radar_range_m: settings.radar_range_m,
      max_velocity_mps: settings.max_velocity_mps,
      noise_level: settings.noise_level,
      clutter_level: settings.clutter_level,
      frame_rate: settings.frame_rate,
      cfar_threshold_scale: settings.cfar_threshold_scale,
      guard_cells: settings.guard_cells,
      training_cells: settings.training_cells,
      objects
    }),
    [settings, objects]
  );

  useEffect(() => {
    if (autoRun && !didAutoRun.current) {
      didAutoRun.current = true;
      void handleStart();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun]);

  useEffect(() => {
    return () => socketRef.current?.close();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(timer);
  }, [toast]);

  async function syncScene() {
    const response = await configureSimulationScene(scene);
    setReplayPath(response.replay_path);
    setMessage(response.message);
    return response;
  }

  async function runAction(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      const nextError = err instanceof Error ? err.message : "Simulation request failed";
      setError(nextError);
      setToast({ tone: "error", message: nextError });
    } finally {
      setBusy(false);
    }
  }

  async function handleStart() {
    await runAction(async () => {
      await syncScene();
      const started = await startSimulation();
      setRunning(started.running);
      setReplayPath(started.replay_path);
      setMessage(started.message);
      setToast({ tone: "success", message: "Simulation started with live synthetic scene." });
      connectStream();
      const initialFrame = await getCurrentSimulationFrame();
      setFrame(initialFrame);
    });
  }

  async function handleStop() {
    await runAction(async () => {
      socketRef.current?.close();
      socketRef.current = null;
      const stopped = await stopSimulation();
      setRunning(stopped.running);
      setReplayPath(stopped.replay_path);
      setMessage(stopped.message);
      setToast({ tone: "success", message: "Simulation stopped." });
    });
  }

  async function handleStep() {
    await runAction(async () => {
      await syncScene();
      const nextFrame = await stepSimulation();
      setFrame(nextFrame);
      setMessage(`frame ${nextFrame.frame_id} generated`);
      setToast({ tone: "success", message: `Generated frame ${nextFrame.frame_id}.` });
    });
  }

  async function handleReset() {
    await runAction(async () => {
      socketRef.current?.close();
      socketRef.current = null;
      setRunning(false);
      setSettings(DEFAULT_SETTINGS);
      setObjects(PRESETS["Multi Target Scene"]);
      setFrame(null);
      const stopped = await stopSimulation();
      setReplayPath(stopped.replay_path);
      setMessage("scene reset");
      setToast({ tone: "success", message: "Scene reset to default multi-target preset." });
    });
  }

  async function handleSaveReplay() {
    await runAction(async () => {
      const stopped = await stopSimulation();
      setRunning(false);
      setReplayPath(stopped.replay_path);
      setMessage(stopped.replay_path ? "replay saved locally" : "no replay frames recorded yet");
      setToast({ tone: stopped.replay_path ? "success" : "warning", message: stopped.replay_path ? "Replay saved locally." : "No replay frames recorded yet." });
    });
  }

  function connectStream() {
    socketRef.current?.close();
    const socket = new WebSocket(simulationSocketUrl());
    socketRef.current = socket;
    socket.onmessage = (event) => {
      let payload: Partial<SimulationFrame> & { type?: string; replay_path?: string };
      try {
        payload = JSON.parse(event.data) as Partial<SimulationFrame> & { type?: string; replay_path?: string };
      } catch {
        setToast({ tone: "warning", message: "Ignored a malformed simulation frame." });
        return;
      }
      if (payload.type === "status") {
        if (typeof payload.replay_path === "string") setReplayPath(payload.replay_path);
        return;
      }
      if (payload.heatmap && payload.objects && payload.detections && payload.tracks && payload.stats) {
        setFrame(payload as SimulationFrame);
      }
    };
    socket.onerror = () => {
      setMessage("stream unavailable; step mode still works");
      setToast({ tone: "warning", message: "Live stream unavailable. Step mode still works." });
    };
  }

  function applyPreset(name: string) {
    const presetObjects = PRESETS[name].map((object) => ({ ...object }));
    setObjects(presetObjects);
    if (name === "Heavy Clutter") {
      setSettings((current) => ({ ...current, clutter_level: 0.12, noise_level: 0.12, cfar_threshold_scale: 5.4 }));
    } else {
      setSettings(DEFAULT_SETTINGS);
    }
    setFrame(null);
    setMessage(`${name} preset loaded`);
  }

  function addObject() {
    const nextId = Math.max(0, ...objects.map((object) => object.id)) + 1;
    setObjects((current) => [
      ...current,
      {
        id: nextId,
        label: "unknown",
        range_m: 900,
        velocity_mps: 8,
        angle_deg: 0,
        rcs: 8,
        altitude_m: 15,
        heading_deg: 180
      }
    ]);
  }

  function updateObject(id: number, key: keyof SceneObject, value: string) {
    setObjects((current) =>
      current.map((object) =>
        object.id === id
          ? {
              ...object,
              [key]: key === "label" ? (value as Label) : Number(value)
            }
          : object
      )
    );
  }

  function removeObject(id: number) {
    setObjects((current) => current.filter((object) => object.id !== id));
  }

  const detections = frame?.detections ?? [];
  const previewObjects = frame?.objects ?? objects;
  const stats = frame?.stats;

  return (
    <div className="space-y-5">
      {toast && <Toast tone={toast.tone} message={toast.message} onDismiss={() => setToast(null)} />}
      <SectionHeader
        title="Synthetic Radar Simulator"
        description="Configure a local radar scene, run synthetic frames, and inspect detections without hardware or RF transmission."
        actions={
          <>
            <StatusBadge tone={running ? "online" : "neutral"}>{running ? "Running" : "Idle"}</StatusBadge>
            <StatusBadge tone={error ? "danger" : "online"}>{error ? "Action needed" : "Local only"}</StatusBadge>
          </>
        }
      />

      <PremiumCard className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <PremiumButton onClick={handleStart} disabled={busy || running}>
            <Play size={17} />
            Start
          </PremiumButton>
          <PremiumButton variant="secondary" onClick={handleStop} disabled={busy || !running}>
            <Pause size={17} />
            Stop
          </PremiumButton>
          <PremiumButton variant="secondary" onClick={handleStep} disabled={busy || running}>
            <SkipForward size={17} />
            Step Frame
          </PremiumButton>
          <PremiumButton variant="secondary" onClick={handleReset} disabled={busy}>
            <RefreshCcw size={17} />
            Reset Scene
          </PremiumButton>
          <PremiumButton variant="glass" onClick={handleSaveReplay} disabled={busy}>
            <Save size={17} />
            Save Replay
          </PremiumButton>
          <div className="min-w-0 text-sm text-muted-foreground lg:ml-auto">
            {message}
            {replayPath && <span className="ml-2 hidden text-primary lg:inline">Replay: {shortPath(replayPath)}</span>}
          </div>
        </div>
        {error && <div className="mt-3 rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{error}</div>}
      </PremiumCard>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0 space-y-5">
          <PresetPanel onPreset={applyPreset} />
          <RadarSettingsPanel settings={settings} setSettings={setSettings} disabled={running} />
          <ObjectEditor objects={objects} onAdd={addObject} onRemove={removeObject} onUpdate={updateObject} disabled={running} />
        </div>

        <div className="min-w-0 space-y-5">
          <MiniRadar objects={previewObjects} detections={detections} radarRange={settings.radar_range_m} />
          <MiniHeatmap heatmap={frame?.heatmap} detections={detections} />
          <RuntimeMetrics
            fps={stats?.simulated_fps ?? settings.frame_rate}
            activeTracks={stats?.active_tracks ?? 0}
            detections={stats?.detection_count ?? detections.length}
            avgConfidence={stats?.avg_confidence ?? 0}
          />
          <DetectionList detections={detections} />
        </div>
      </div>
    </div>
  );
}

function PresetPanel({ onPreset }: { onPreset: (name: string) => void }) {
  return (
    <PremiumCard>
      <PanelTitle icon={Zap} title="Mission Presets" detail="quick scenes" />
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {Object.keys(PRESETS).map((name) => (
          <button
            key={name}
            onClick={() => onPreset(name)}
            className="rounded-md border border-border bg-muted/35 px-3 py-2 text-left text-sm text-foreground transition hover:border-primary/60 hover:bg-primary/10"
          >
            {name}
          </button>
        ))}
      </div>
    </PremiumCard>
  );
}

function RadarSettingsPanel({
  settings,
  setSettings,
  disabled
}: {
  settings: RadarSettings;
  setSettings: Dispatch<SetStateAction<RadarSettings>>;
  disabled: boolean;
}) {
  function setNumber(key: keyof RadarSettings, value: number) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  return (
    <PremiumCard>
      <PanelTitle icon={SlidersHorizontal} title="Radar Settings" detail="scene model" />
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <NumberField label="Radar range" suffix="m" value={settings.radar_range_m} min={500} max={20000} step={100} disabled={disabled} onChange={(value) => setNumber("radar_range_m", value)} />
        <NumberField label="Max velocity" suffix="m/s" value={settings.max_velocity_mps} min={20} max={1000} step={5} disabled={disabled} onChange={(value) => setNumber("max_velocity_mps", value)} />
      </div>
      <div className="mt-5 grid gap-5">
        <SliderField label="Noise level" value={settings.noise_level} min={0} max={0.6} step={0.01} disabled={disabled} onChange={(value) => setNumber("noise_level", value)} />
        <SliderField label="Clutter level" value={settings.clutter_level} min={0} max={0.4} step={0.01} disabled={disabled} onChange={(value) => setNumber("clutter_level", value)} />
        <SliderField label="Frame rate" value={settings.frame_rate} min={0.5} max={15} step={0.5} disabled={disabled} onChange={(value) => setNumber("frame_rate", value)} />
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <NumberField label="CFAR scale" value={settings.cfar_threshold_scale} min={1.1} max={20} step={0.1} disabled={disabled} onChange={(value) => setNumber("cfar_threshold_scale", value)} />
        <NumberField label="Guard cells" value={settings.guard_cells} min={1} max={8} step={1} disabled={disabled} onChange={(value) => setNumber("guard_cells", value)} />
        <NumberField label="Training cells" value={settings.training_cells} min={2} max={32} step={1} disabled={disabled} onChange={(value) => setNumber("training_cells", value)} />
      </div>
    </PremiumCard>
  );
}

function ObjectEditor({
  objects,
  onAdd,
  onRemove,
  onUpdate,
  disabled
}: {
  objects: SceneObject[];
  onAdd: () => void;
  onRemove: (id: number) => void;
  onUpdate: (id: number, key: keyof SceneObject, value: string) => void;
  disabled: boolean;
}) {
  return (
    <PremiumCard>
      <div className="flex items-center justify-between gap-3">
        <PanelTitle icon={LocateFixed} title="Scene Objects" detail={`${objects.length} targets`} />
        <PremiumButton size="sm" variant="glass" onClick={onAdd} disabled={disabled}>
          <Plus size={16} />
          Add
        </PremiumButton>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
            <tr>
              <th className="pb-3">Label</th>
              <th className="pb-3">Range</th>
              <th className="pb-3">Velocity</th>
              <th className="pb-3">Angle</th>
              <th className="pb-3">RCS</th>
              <th className="pb-3">Altitude</th>
              <th className="pb-3">Heading</th>
              <th className="pb-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {objects.map((object) => (
              <tr key={object.id}>
                <td className="py-2 pr-2">
                  <select
                    value={object.label}
                    disabled={disabled}
                    onChange={(event) => onUpdate(object.id, "label", event.target.value)}
                    className="h-9 w-32 rounded-md border border-border bg-panel px-2 text-sm capitalize text-foreground outline-none focus:border-primary"
                  >
                    {LABELS.map((label) => (
                      <option key={label} value={label}>
                        {label}
                      </option>
                    ))}
                  </select>
                </td>
                {(["range_m", "velocity_mps", "angle_deg", "rcs", "altitude_m", "heading_deg"] as const).map((field) => (
                  <td key={field} className="py-2 pr-2">
                    <Input
                      type="number"
                      value={object[field]}
                      disabled={disabled}
                      min={field === "angle_deg" ? -90 : field === "velocity_mps" ? -1000 : 0}
                      max={field === "angle_deg" ? 90 : field === "heading_deg" ? 359 : undefined}
                      step={field === "velocity_mps" || field === "angle_deg" ? 0.5 : 1}
                      onChange={(event) => onUpdate(object.id, field, event.target.value)}
                      className="h-9 w-24"
                    />
                  </td>
                ))}
                <td className="py-2 text-right">
                  <Button size="icon" variant="ghost" disabled={disabled} onClick={() => onRemove(object.id)} aria-label="Remove object">
                    <Trash2 size={16} />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PremiumCard>
  );
}

function MiniRadar({
  objects,
  detections,
  radarRange
}: {
  objects: SceneObject[];
  detections: FrameDetection[];
  radarRange: number;
}) {
  return (
    <PremiumCard className="overflow-hidden">
      <PanelTitle icon={Radar} title="Live Mini Radar" detail={`${objects.length} objects`} />
      <div className="relative mx-auto mt-4 aspect-square max-h-[360px] rounded-full border border-primary/30 bg-muted/25">
        <div className="absolute inset-[12%] rounded-full border border-border" />
        <div className="absolute inset-[28%] rounded-full border border-border" />
        <div className="absolute inset-[43%] rounded-full border border-danger/40" />
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,hsl(var(--primary)/0.12),transparent_55%)]" />
        <div className="radar-sweep absolute inset-0 rounded-full opacity-75" />
        <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-border/80" />
        <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-border/80" />
        {objects.map((object) => (
          <RadarBlip key={object.id} object={object} radarRange={radarRange} detected={detections.some((detection) => Math.abs(detection.estimated_range_m - object.range_m) < 180)} />
        ))}
      </div>
    </PremiumCard>
  );
}

function RadarBlip({ object, radarRange, detected }: { object: SceneObject; radarRange: number; detected: boolean }) {
  const radius = Math.min(object.range_m / radarRange, 1) * 42;
  const angle = ((object.angle_deg - 90) * Math.PI) / 180;
  const left = 50 + Math.cos(angle) * radius;
  const top = 50 + Math.sin(angle) * radius;
  const Icon = labelIcon(object.label);
  return (
    <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${left}%`, top: `${top}%` }}>
      <div
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded-full border shadow-[0_0_18px_currentColor]",
          detected ? "border-primary bg-primary/20 text-primary" : "border-muted-foreground/40 bg-panel text-muted-foreground",
          object.label === "drone" && "border-danger bg-danger/15 text-danger"
        )}
        title={`${object.label} ${Math.round(object.range_m)}m`}
      >
        <Icon size={13} />
      </div>
    </div>
  );
}

function MiniHeatmap({ heatmap, detections }: { heatmap?: number[][]; detections: FrameDetection[] }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#08111f";
    ctx.fillRect(0, 0, width, height);
    const data = heatmap ?? syntheticHeatmap();
    const rows = data.length;
    const cols = data[0]?.length ?? 0;
    const cellW = width / Math.max(cols, 1);
    const cellH = height / Math.max(rows, 1);
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        ctx.fillStyle = heatColor(data[row][col]);
        ctx.fillRect(col * cellW, row * cellH, Math.ceil(cellW), Math.ceil(cellH));
      }
    }
    detections.slice(0, 32).forEach((detection) => {
      const x = (detection.range_bin / 127) * width;
      const y = (detection.doppler_bin / 127) * height;
      ctx.strokeStyle = "#fb923c";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.stroke();
    });
  }, [heatmap, detections]);

  return (
    <PremiumCard>
      <PanelTitle icon={Activity} title="Mini Range-Doppler" detail={`${detections.length} detections`} />
      <canvas ref={canvasRef} width={520} height={360} className="mt-4 h-[300px] w-full rounded-lg border border-border bg-muted/30" />
    </PremiumCard>
  );
}

function RuntimeMetrics({
  fps,
  activeTracks,
  detections,
  avgConfidence
}: {
  fps: number;
  activeTracks: number;
  detections: number;
  avgConfidence: number;
}) {
  const metrics = [
    { label: "FPS", value: fps.toFixed(1), icon: Gauge },
    { label: "Tracks", value: activeTracks, icon: Crosshair },
    { label: "Detections", value: detections, icon: ShieldAlert },
    { label: "Confidence", value: `${Math.round(avgConfidence * 100)}%`, icon: Activity }
  ];
  return (
    <PremiumCard>
      <PanelTitle icon={Download} title="System Metrics" detail="runtime" />
      <div className="mt-4 grid grid-cols-2 gap-3">
        {metrics.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-md border border-border bg-muted/35 p-3">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.14em] text-muted-foreground">
              {label}
              <Icon size={15} />
            </div>
            <div className="mt-2 font-mono text-2xl font-semibold text-foreground">{value}</div>
          </div>
        ))}
      </div>
    </PremiumCard>
  );
}

function DetectionList({ detections }: { detections: FrameDetection[] }) {
  return (
    <PremiumCard>
      <PanelTitle icon={Crosshair} title="Detection List" detail={`${detections.length} contacts`} />
      <div className="mt-4 max-h-[284px] overflow-auto rounded-lg border border-border">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="sticky top-0 bg-panel text-xs uppercase tracking-[0.12em] text-muted-foreground">
            <tr>
              <th className="p-3">Class</th>
              <th className="p-3">Range</th>
              <th className="p-3">Velocity</th>
              <th className="p-3">Confidence</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {detections.length ? (
              detections.slice(0, 24).map((detection, index) => (
                <tr key={`${detection.range_bin}-${detection.doppler_bin}-${index}`} className="text-muted-foreground">
                  <td className="p-3 capitalize text-foreground">{detection.classification}</td>
                  <td className="p-3">{detection.estimated_range_m.toFixed(1)} m</td>
                  <td className="p-3">{detection.estimated_velocity_mps.toFixed(1)} m/s</td>
                  <td className="p-3">{Math.round(detection.confidence * 100)}%</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="p-6 text-center text-muted-foreground">
                  Step or start the simulation to populate detections.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </PremiumCard>
  );
}

function PanelTitle({ icon: Icon, title, detail }: { icon: LucideIcon; title: string; detail?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/12 text-primary">
          <Icon size={18} />
        </div>
        <h2 className="truncate font-semibold text-foreground">{title}</h2>
      </div>
      {detail && <span className="shrink-0 text-xs text-muted-foreground">{detail}</span>}
    </div>
  );
}

function NumberField({
  label,
  value,
  suffix,
  min,
  max,
  step,
  disabled,
  onChange
}: {
  label: string;
  value: number;
  suffix?: string;
  min: number;
  max?: number;
  step: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <Input type="number" value={value} min={min} max={max} step={step} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} />
        {suffix && <span className="w-10 text-xs text-muted-foreground">{suffix}</span>}
      </div>
    </label>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  disabled,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
        <span className="rounded-md bg-muted px-2 py-1 text-xs text-foreground">{value.toFixed(step < 0.1 ? 2 : 1)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
      />
    </label>
  );
}

function labelIcon(label: Label) {
  switch (label) {
    case "drone":
      return Radar;
    case "bird":
      return Bird;
    case "vehicle":
      return Car;
    case "human":
      return User;
    case "clutter":
      return CloudFog;
    default:
      return LocateFixed;
  }
}

function heatColor(value: number) {
  const clamped = Math.max(0, Math.min(1, value));
  if (clamped < 0.32) {
    const k = clamped / 0.32;
    return `rgb(${Math.round(8 + k * 5)}, ${Math.round(17 + k * 128)}, ${Math.round(31 + k * 150)})`;
  }
  if (clamped < 0.68) {
    const k = (clamped - 0.32) / 0.36;
    return `rgb(${Math.round(13 + k * 235)}, ${Math.round(145 + k * 80)}, ${Math.round(181 - k * 130)})`;
  }
  const k = (clamped - 0.68) / 0.32;
  return `rgb(${Math.round(248 + k * 7)}, ${Math.round(225 + k * 20)}, ${Math.round(51 + k * 204)})`;
}

function syntheticHeatmap() {
  return Array.from({ length: 48 }, (_, row) =>
    Array.from({ length: 48 }, (_, col) => {
      const p1 = Math.exp(-((row - 28) ** 2 + (col - 18) ** 2) / 72);
      const p2 = Math.exp(-((row - 18) ** 2 + (col - 34) ** 2) / 52);
      return Math.min(1, 0.06 + p1 * 0.78 + p2 * 0.48 + ((row * 3 + col * 5) % 13) * 0.004);
    })
  );
}

function shortPath(path: string) {
  const parts = path.split(/[\\/]/);
  return parts.slice(-2).join("/");
}
