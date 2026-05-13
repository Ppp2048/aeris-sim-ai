"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Clock3,
  Crosshair,
  Database,
  Gauge,
  Pause,
  Play,
  Radar,
  RefreshCcw,
  ShieldAlert,
  SkipBack,
  SkipForward,
  Target,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PremiumCard } from "@/components/ui/premium-card";
import { PremiumButton } from "@/components/ui/premium-button";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { deleteSimulationReplay, getSimulationReplay, listSimulationReplays } from "@/lib/api";
import type { FrameDetection, ReplayDetail, ReplaySummary, SceneObject, SimulationFrame, Track } from "@/lib/types";
import { cn } from "@/lib/utils";

const SPEEDS = [0.5, 1, 2, 4];

export function ReplayVault() {
  const [replays, setReplays] = useState<ReplaySummary[]>([]);
  const [selectedReplay, setSelectedReplay] = useState<ReplayDetail | null>(null);
  const [selectedReplayId, setSelectedReplayId] = useState("");
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingReplay, setLoadingReplay] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    void refreshReplays();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!playing || !selectedReplay?.frames.length) return;
    timerRef.current = setInterval(() => {
      setFrameIndex((current) => {
        const next = current + 1;
        if (next >= selectedReplay.frames.length) {
          setPlaying(false);
          return selectedReplay.frames.length - 1;
        }
        return next;
      });
    }, 650 / speed);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [playing, selectedReplay, speed]);

  async function refreshReplays() {
    setLoading(true);
    setError(null);
    try {
      const rows = await listSimulationReplays();
      setReplays(rows);
      if (!selectedReplayId && rows[0]) {
        await loadReplay(rows[0].replay_id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load replays");
    } finally {
      setLoading(false);
    }
  }

  async function loadReplay(replayId: string) {
    setLoadingReplay(true);
    setError(null);
    setPlaying(false);
    try {
      const replay = await getSimulationReplay(replayId);
      setSelectedReplay(replay);
      setSelectedReplayId(replayId);
      setFrameIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load replay");
    } finally {
      setLoadingReplay(false);
    }
  }

  async function removeReplay(replayId: string) {
    setError(null);
    try {
      await deleteSimulationReplay(replayId);
      if (selectedReplayId === replayId) {
        setSelectedReplay(null);
        setSelectedReplayId("");
        setFrameIndex(0);
      }
      await refreshReplays();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete replay");
    }
  }

  const frame = selectedReplay?.frames[frameIndex] ?? null;
  const analytics = selectedReplay?.analytics ?? emptyAnalytics();
  const enrichedTracks = useMemo(() => enrichTracks(frame?.tracks ?? [], frame?.detections ?? [], frame?.objects ?? []), [frame]);

  return (
    <div className="w-full min-w-0 space-y-5 overflow-x-hidden">
      <SectionHeader
        title="Mission Replay Vault"
        description="Load saved simulation runs once, scrub locally, and review detections, tracks, heatmaps, and alerts frame by frame."
        actions={
          <>
            <Button variant="secondary" onClick={refreshReplays} disabled={loading}>
              <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
              Refresh
            </Button>
            <StatusBadge tone={selectedReplay ? "online" : "neutral"}>
              {selectedReplay ? `${selectedReplay.frame_count} frames loaded` : "No replay loaded"}
            </StatusBadge>
          </>
        }
      />

      {error && <div className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{error}</div>}

      <div className="grid min-w-0 grid-cols-1 gap-6 2xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="grid min-w-0 gap-5 lg:grid-cols-3 2xl:block 2xl:space-y-5">
          <ReplayList
            replays={replays}
            selectedReplayId={selectedReplayId}
            loading={loading}
            onSelect={loadReplay}
            onDelete={removeReplay}
          />
          <AnalyticsSummary analytics={analytics} />
          <ClassDistribution distribution={analytics.predicted_class_distribution} />
        </div>

        <div className="min-w-0 space-y-5">
          <PlaybackControls
            frameIndex={frameIndex}
            totalFrames={selectedReplay?.frames.length ?? 0}
            playing={playing}
            speed={speed}
            loading={loadingReplay}
            onFrame={setFrameIndex}
            onPlay={() => setPlaying((current) => !current)}
            onSpeed={setSpeed}
            onStep={(delta) =>
              setFrameIndex((current) => clamp(current + delta, 0, Math.max((selectedReplay?.frames.length ?? 1) - 1, 0)))
            }
          />

          <div className="grid min-w-0 grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1fr)_420px]">
            <HeatmapReplayPanel frame={frame} />
            <ReplayDetections detections={frame?.detections ?? []} tracks={enrichedTracks} />
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1fr)_420px]">
            <RadarReplayPanel frame={frame} />
            <ReplayAlerts alerts={frame?.alerts ?? []} frameId={frame?.frame_id ?? 0} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ReplayList({
  replays,
  selectedReplayId,
  loading,
  onSelect,
  onDelete
}: {
  replays: ReplaySummary[];
  selectedReplayId: string;
  loading: boolean;
  onSelect: (replayId: string) => void;
  onDelete: (replayId: string) => void;
}) {
  return (
    <PremiumCard>
      <PanelTitle icon={Database} title="Saved Simulation Runs" detail={`${replays.length} runs`} />
      <div className="mt-4 space-y-3">
        {loading ? (
          <>
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </>
        ) : replays.length ? (
          replays.map((replay) => (
            <div
              key={replay.replay_id}
              className={cn(
                "rounded-lg border bg-muted/30 p-4 transition",
                selectedReplayId === replay.replay_id ? "border-primary/60 bg-primary/10" : "border-border"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <button className="min-w-0 text-left" onClick={() => onSelect(replay.replay_id)}>
                  <div className="truncate font-medium text-foreground">{replay.filename}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{formatDate(replay.created_at)}</div>
                </button>
                <Button size="icon" variant="ghost" onClick={() => onDelete(replay.replay_id)} aria-label="Delete replay">
                  <Trash2 size={16} />
                </Button>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                <span className="truncate rounded-md bg-panel px-2 py-1">{replay.frame_count} frames</span>
                <span className="truncate rounded-md bg-panel px-2 py-1">{replay.analytics.total_detections} detections</span>
                <span className="truncate rounded-md bg-panel px-2 py-1">{formatBytes(replay.size_bytes)}</span>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-lg border border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            No saved replay files yet. Start and step a simulation to write JSONL frames.
          </div>
        )}
      </div>
    </PremiumCard>
  );
}

function PlaybackControls({
  frameIndex,
  totalFrames,
  playing,
  speed,
  loading,
  onFrame,
  onPlay,
  onSpeed,
  onStep
}: {
  frameIndex: number;
  totalFrames: number;
  playing: boolean;
  speed: number;
  loading: boolean;
  onFrame: (frameIndex: number) => void;
  onPlay: () => void;
  onSpeed: (speed: number) => void;
  onStep: (delta: number) => void;
}) {
  const disabled = loading || totalFrames === 0;
  return (
    <PremiumCard>
      <div className="flex flex-wrap items-center gap-3">
        <PremiumButton onClick={onPlay} disabled={disabled}>
          {playing ? <Pause size={17} /> : <Play size={17} />}
          {playing ? "Pause" : "Play"}
        </PremiumButton>
        <Button variant="secondary" onClick={() => onStep(-1)} disabled={disabled}>
          <SkipBack size={17} />
          Prev
        </Button>
        <Button variant="secondary" onClick={() => onStep(1)} disabled={disabled}>
          <SkipForward size={17} />
          Next
        </Button>
        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
          {SPEEDS.map((item) => (
            <button
              key={item}
              onClick={() => onSpeed(item)}
              className={cn(
                "rounded-md border px-3 py-2 text-sm transition",
                item === speed ? "border-primary bg-primary/15 text-primary" : "border-border bg-muted/30 text-muted-foreground"
              )}
            >
              {item}x
            </button>
          ))}
        </div>
      </div>
      <div className="mt-5">
        <div className="mb-2 flex justify-between text-xs uppercase tracking-[0.14em] text-muted-foreground">
          <span>Timeline</span>
          <span>
            Frame {totalFrames ? frameIndex + 1 : 0} / {totalFrames}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={Math.max(totalFrames - 1, 0)}
          value={frameIndex}
          disabled={disabled}
          onChange={(event) => onFrame(Number(event.target.value))}
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>
    </PremiumCard>
  );
}

function RadarReplayPanel({ frame }: { frame: SimulationFrame | null }) {
  const objects = frame?.objects ?? [];
  return (
    <PremiumCard className="w-full min-w-0 overflow-hidden">
      <PanelTitle icon={Radar} title="Radar Sweep" detail={frame ? `frame ${frame.frame_id}` : "waiting"} />
      <div className="relative mx-auto mt-4 aspect-square max-h-[390px] rounded-full border border-primary/30 bg-muted/25">
        <div className="absolute inset-[12%] rounded-full border border-border" />
        <div className="absolute inset-[28%] rounded-full border border-border" />
        <div className="absolute inset-[43%] rounded-full border border-danger/40" />
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,hsl(var(--primary)/0.12),transparent_55%)]" />
        <div className="radar-sweep absolute inset-0 rounded-full opacity-60" />
        <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-border/80" />
        <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-border/80" />
        {objects.map((object) => (
          <RadarBlip key={object.id} object={object} />
        ))}
      </div>
    </PremiumCard>
  );
}

function RadarBlip({ object }: { object: SceneObject }) {
  const radarRange = 3000;
  const radius = Math.min(object.range_m / radarRange, 1) * 42;
  const angle = ((object.angle_deg - 90) * Math.PI) / 180;
  const left = 50 + Math.cos(angle) * radius;
  const top = 50 + Math.sin(angle) * radius;
  return (
    <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${left}%`, top: `${top}%` }}>
      <div
        className={cn(
          "h-4 w-4 rounded-full border shadow-[0_0_20px_currentColor]",
          object.label === "drone"
            ? "border-danger bg-danger/30 text-danger"
            : object.label === "unknown"
              ? "border-amber-400 bg-amber-400/25 text-amber-400"
              : "border-primary bg-primary/25 text-primary"
        )}
        title={`${object.label} ${Math.round(object.range_m)}m`}
      />
    </div>
  );
}

function HeatmapReplayPanel({ frame }: { frame: SimulationFrame | null }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const data = frame?.heatmap ?? demoHeatmap();
    const rows = data.length;
    const cols = data[0]?.length ?? 1;
    const width = canvas.width;
    const height = canvas.height;
    ctx.fillStyle = "#07111f";
    ctx.fillRect(0, 0, width, height);
    const cellW = width / cols;
    const cellH = height / rows;
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        ctx.fillStyle = heatColor(data[row][col]);
        ctx.fillRect(col * cellW, row * cellH, Math.ceil(cellW), Math.ceil(cellH));
      }
    }
    frame?.detections.slice(0, 48).forEach((detection) => {
      ctx.strokeStyle = "#fb923c";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc((detection.range_bin / 127) * width, (detection.doppler_bin / 127) * height, 5, 0, Math.PI * 2);
      ctx.stroke();
    });
  }, [frame]);

  return (
    <PremiumCard className="w-full min-w-0 overflow-hidden">
      <PanelTitle icon={Activity} title="Range-Doppler Heatmap" detail={`${frame?.detections.length ?? 0} detections`} />
      <canvas ref={canvasRef} width={920} height={420} className="mt-4 h-[420px] min-h-[360px] w-full rounded-lg border border-border bg-muted/30" />
    </PremiumCard>
  );
}

function ReplayDetections({ detections, tracks }: { detections: FrameDetection[]; tracks: EnrichedTrack[] }) {
  const rows = tracks.length
    ? tracks.map((track) => ({
        id: `track-${track.track_id}`,
        track: `#${track.track_id}`,
        label: track.classification,
        range: track.range_m,
        velocity: track.velocity_mps,
        confidence: track.confidence,
        status: track.status,
        isTrack: true
      }))
    : detections.map((detection, index) => ({
        id: `detection-${detection.range_bin}-${detection.doppler_bin}-${index}`,
        track: "-",
        label: detection.classification,
        range: detection.estimated_range_m,
        velocity: detection.estimated_velocity_mps,
        confidence: detection.confidence,
        status: "detection",
        isTrack: false
      }));

  return (
    <PremiumCard className="w-full min-w-0 overflow-hidden">
      <PanelTitle icon={Target} title="Detections & Tracks" detail={`${tracks.length} tracks`} />
      <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto overflow-x-hidden pr-1">
        {rows.length ? (
          rows.map((row) => (
            <div key={row.id} className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-mono text-sm font-semibold text-foreground">{row.track}</div>
                  <div className="truncate text-xs capitalize text-muted-foreground">{row.label}</div>
                </div>
                <StatusBadge tone={row.status === "lost" ? "danger" : row.status === "locked" ? "online" : row.isTrack ? "neutral" : "warning"}>
                  {row.status}
                </StatusBadge>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <Telemetry label="Range" value={`${row.range.toFixed(1)} m`} />
                <Telemetry label="Velocity" value={`${row.velocity.toFixed(1)} m/s`} />
                <Telemetry label="Confidence" value={`${Math.round(row.confidence * 100)}%`} />
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-lg border border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            No detections or tracks in this frame.
          </div>
        )}
      </div>
    </PremiumCard>
  );
}

function Telemetry({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md bg-panel/80 px-2 py-1.5">
      <div className="truncate text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div className="mt-1 truncate font-mono text-foreground">{value}</div>
    </div>
  );
}

function ReplayAlerts({ alerts, frameId }: { alerts: string[]; frameId: number }) {
  const rows = alerts.length ? alerts : ["system_nominal"];
  return (
    <PremiumCard>
      <PanelTitle icon={ShieldAlert} title="Alerts" detail={`frame ${frameId}`} />
      <div className="mt-4 space-y-3">
        {rows.map((alert) => {
          const danger = alert.includes("breach") || alert.includes("drone") || alert.includes("unknown");
          return (
            <div key={alert} className="flex gap-3 rounded-lg border border-border bg-muted/30 p-3">
              <AlertTriangle className={danger ? "text-danger" : "text-emerald-500"} size={18} />
              <div>
                <div className="text-sm font-medium capitalize text-foreground">{alert.replaceAll("_", " ")}</div>
                <div className="text-xs text-muted-foreground">{danger ? "Review event context" : "No active incident"}</div>
              </div>
            </div>
          );
        })}
      </div>
    </PremiumCard>
  );
}

function AnalyticsSummary({ analytics }: { analytics: ReplayDetail["analytics"] }) {
  const metrics = [
    { label: "Frames", value: analytics.total_frames, icon: Clock3 },
    { label: "Detections", value: analytics.total_detections, icon: Crosshair },
    { label: "Max Confidence", value: `${Math.round(analytics.max_confidence * 100)}%`, icon: Gauge },
    { label: "Alerts", value: analytics.number_of_alerts, icon: ShieldAlert },
    { label: "Longest Track", value: `${analytics.longest_track_duration} frames`, icon: Target }
  ];
  return (
    <PremiumCard>
      <PanelTitle icon={BarChart3} title="Analytics Summary" detail="mission rollup" />
      <div className="mt-4 grid grid-cols-2 gap-3">
        {metrics.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.12em] text-muted-foreground">
              {label}
              <Icon size={15} />
            </div>
            <div className="mt-2 text-xl font-semibold text-foreground">{value}</div>
          </div>
        ))}
      </div>
    </PremiumCard>
  );
}

function ClassDistribution({ distribution }: { distribution: Record<string, number> }) {
  const total = Object.values(distribution).reduce((sum, value) => sum + value, 0);
  return (
    <PremiumCard>
      <PanelTitle icon={Activity} title="Class Distribution" detail={`${total} classified detections`} />
      <div className="mt-4 space-y-3">
        {Object.entries(distribution).length ? (
          Object.entries(distribution).map(([label, count]) => (
            <div key={label}>
              <div className="mb-1 flex justify-between text-xs">
                <span className="capitalize text-muted-foreground">{label}</span>
                <span className="text-foreground">{count}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round((count / Math.max(total, 1)) * 100)}%` }} />
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">No classified detections yet.</div>
        )}
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

type EnrichedTrack = Track & {
  classification: string;
};

function enrichTracks(tracks: Track[], detections: FrameDetection[], objects: SceneObject[]): EnrichedTrack[] {
  return tracks.map((track) => {
    const detection = nearestByRange(track.range_m, detections);
    const object = nearestByRange(track.range_m, objects);
    return {
      ...track,
      classification: detection?.classification ?? object?.label ?? "unknown"
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

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-muted", className)} />;
}

function heatColor(value: number) {
  const clamped = Math.max(0, Math.min(1, value));
  if (clamped < 0.34) {
    const k = clamped / 0.34;
    return `rgb(${Math.round(7 + k * 8)}, ${Math.round(17 + k * 120)}, ${Math.round(31 + k * 150)})`;
  }
  if (clamped < 0.7) {
    const k = (clamped - 0.34) / 0.36;
    return `rgb(${Math.round(15 + k * 230)}, ${Math.round(137 + k * 85)}, ${Math.round(181 - k * 120)})`;
  }
  const k = (clamped - 0.7) / 0.3;
  return `rgb(${Math.round(245 + k * 10)}, ${Math.round(222 + k * 25)}, ${Math.round(61 + k * 190)})`;
}

function demoHeatmap() {
  return Array.from({ length: 48 }, (_, row) =>
    Array.from({ length: 48 }, (_, col) => {
      const p1 = Math.exp(-((row - 28) ** 2 + (col - 18) ** 2) / 72);
      const p2 = Math.exp(-((row - 18) ** 2 + (col - 34) ** 2) / 52);
      return Math.min(1, 0.06 + p1 * 0.78 + p2 * 0.48 + ((row * 3 + col * 5) % 13) * 0.004);
    })
  );
}

function emptyAnalytics(): ReplayDetail["analytics"] {
  return {
    total_frames: 0,
    total_detections: 0,
    max_confidence: 0,
    number_of_alerts: 0,
    longest_track_duration: 0,
    predicted_class_distribution: {}
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
