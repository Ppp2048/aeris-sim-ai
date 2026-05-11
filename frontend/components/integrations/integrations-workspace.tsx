"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Binary,
  CheckCircle2,
  FileJson,
  FileUp,
  Loader2,
  Network,
  PlugZap,
  RefreshCcw,
  Table2,
  UploadCloud,
  Wand2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { Input } from "@/components/ui/input";
import { NeonButton } from "@/components/ui/neon-button";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  listIntegrationParsers,
  listModelAdapters,
  parseIntegrationData,
  uploadIntegrationData,
  uploadModelMetadata
} from "@/lib/api";
import type {
  IntegrationColumnMapping,
  IntegrationParseResponse,
  IntegrationUploadResponse,
  ModelAdapter,
  ParserInfo
} from "@/lib/types";
import { cn } from "@/lib/utils";

const TARGET_FIELDS: Array<keyof IntegrationColumnMapping> = [
  "range_m",
  "velocity_mps",
  "angle_deg",
  "amplitude",
  "timestamp",
  "class_label"
];

const FIELD_HINTS: Record<keyof IntegrationColumnMapping, string[]> = {
  range_m: ["range_m", "range", "distance", "r"],
  velocity_mps: ["velocity_mps", "velocity", "doppler", "speed", "v"],
  angle_deg: ["angle_deg", "angle", "azimuth", "bearing"],
  amplitude: ["amplitude", "power", "rcs", "magnitude", "confidence"],
  timestamp: ["timestamp", "time", "created_at", "frame_time"],
  class_label: ["class_label", "label", "class", "target_type"]
};

type BusyKey = "upload" | "parse" | "registry" | "adapter";

export function IntegrationsWorkspace() {
  const [upload, setUpload] = useState<IntegrationUploadResponse | null>(null);
  const [mapping, setMapping] = useState<IntegrationColumnMapping>(emptyMapping());
  const [parseResult, setParseResult] = useState<IntegrationParseResponse | null>(null);
  const [parsers, setParsers] = useState<ParserInfo[]>([]);
  const [adapters, setAdapters] = useState<ModelAdapter[]>([]);
  const [selectedParser, setSelectedParser] = useState("sample_csv_parser");
  const [adapterForm, setAdapterForm] = useState({
    model_name: "",
    model_type: "sklearn-compatible",
    expected_input_shape: "128x128",
    classes: "drone,bird,vehicle,human,clutter,unknown",
    notes: ""
  });
  const [busy, setBusy] = useState<Record<BusyKey, boolean>>({
    upload: false,
    parse: false,
    registry: true,
    adapter: false
  });
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    void refreshRegistries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(timer);
  }, [toast]);

  async function refreshRegistries() {
    setBusy((current) => ({ ...current, registry: true }));
    try {
      const [parserRows, adapterRows] = await Promise.all([listIntegrationParsers(), listModelAdapters()]);
      setParsers(parserRows);
      setAdapters(adapterRows);
      if (parserRows[0] && !selectedParser) setSelectedParser(parserRows[0].name);
    } catch (err) {
      showError(err, "Unable to load integration registries");
    } finally {
      setBusy((current) => ({ ...current, registry: false }));
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy((current) => ({ ...current, upload: true }));
    setError(null);
    try {
      const result = await uploadIntegrationData(file);
      setUpload(result);
      setMapping(autoMapColumns(result.columns));
      setParseResult(null);
      setToast({ tone: "success", message: `Uploaded ${result.filename} with ${result.row_count} rows` });
    } catch (err) {
      showError(err, "Upload failed");
    } finally {
      setBusy((current) => ({ ...current, upload: false }));
    }
  }

  async function handleParse() {
    if (!upload) {
      setError("Upload a CSV before parsing.");
      return;
    }
    setBusy((current) => ({ ...current, parse: true }));
    setError(null);
    try {
      const result = await parseIntegrationData({
        file_id: upload.file_id,
        parser_name: selectedParser,
        column_mapping: mapping
      });
      setParseResult(result);
      setToast({ tone: "success", message: `Parsed ${result.row_count} mapped radar rows` });
    } catch (err) {
      showError(err, "Parse failed");
    } finally {
      setBusy((current) => ({ ...current, parse: false }));
    }
  }

  async function handleAdapterSubmit() {
    setBusy((current) => ({ ...current, adapter: true }));
    setError(null);
    try {
      const adapter = await uploadModelMetadata({
        model_name: adapterForm.model_name,
        model_type: adapterForm.model_type,
        expected_input_shape: adapterForm.expected_input_shape,
        classes: adapterForm.classes.split(",").map((item) => item.trim()).filter(Boolean),
        notes: adapterForm.notes
      });
      setAdapters((current) => [adapter, ...current]);
      setToast({ tone: "success", message: `Registered adapter metadata for ${adapter.model_name}` });
      setAdapterForm((current) => ({ ...current, model_name: "", notes: "" }));
    } catch (err) {
      showError(err, "Model metadata registration failed");
    } finally {
      setBusy((current) => ({ ...current, adapter: false }));
    }
  }

  function showError(err: unknown, fallback: string) {
    const message = err instanceof Error ? err.message : fallback;
    setError(message);
    setToast({ tone: "error", message });
  }

  const warnings = [...(upload?.warnings ?? []), ...(parseResult?.warnings ?? [])];
  const previewRows = parseResult?.mapped_rows ?? upload?.preview_rows ?? [];

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Integration Platform"
        description="Bring your own radar-like CSV data and register local model adapter metadata without enabling arbitrary code execution."
        actions={
          <>
            <Button variant="secondary" onClick={refreshRegistries} disabled={busy.registry}>
              <RefreshCcw size={16} className={busy.registry ? "animate-spin" : ""} />
              Refresh
            </Button>
            <StatusBadge tone="online">Local sandbox</StatusBadge>
          </>
        }
      />

      {toast && <Toast tone={toast.tone} message={toast.message} />}
      {error && <div className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{error}</div>}

      <div className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="space-y-5">
          <UploadRadarDataCard upload={upload} busy={busy.upload} onFile={handleFileChange} />
          <ColumnMapperCard
            upload={upload}
            mapping={mapping}
            selectedParser={selectedParser}
            parsers={parsers}
            busy={busy.parse}
            onMapping={setMapping}
            onParser={setSelectedParser}
            onParse={handleParse}
          />
          <ParserRegistryCard parsers={parsers} busy={busy.registry} />
        </div>

        <div className="space-y-5">
          <DataPreviewCard rows={previewRows} heatmap={parseResult?.heatmap_preview ?? null} warnings={warnings} />
          <CustomModelAdapterCard
            form={adapterForm}
            adapters={adapters}
            busy={busy.adapter}
            onForm={setAdapterForm}
            onSubmit={handleAdapterSubmit}
          />
        </div>
      </div>
    </div>
  );
}

function UploadRadarDataCard({
  upload,
  busy,
  onFile
}: {
  upload: IntegrationUploadResponse | null;
  busy: boolean;
  onFile: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <GlassCard>
      <PanelTitle icon={FileUp} title="Upload Radar Data" detail="CSV ingest" />
      <label className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-primary/40 bg-primary/5 p-8 text-center transition hover:bg-primary/10">
        {busy ? <Loader2 className="animate-spin text-primary" size={32} /> : <UploadCloud className="text-primary" size={34} />}
        <span className="mt-3 text-sm font-medium text-foreground">{busy ? "Uploading..." : "Select CSV file"}</span>
        <span className="mt-1 text-xs text-muted-foreground">Accepted formats: .csv</span>
        <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
      </label>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <MetaPill label="File" value={upload?.filename ?? "none"} />
        <MetaPill label="Rows" value={upload ? String(upload.row_count) : "0"} />
        <MetaPill label="Columns" value={upload ? String(upload.columns.length) : "0"} />
      </div>
    </GlassCard>
  );
}

function ColumnMapperCard({
  upload,
  mapping,
  selectedParser,
  parsers,
  busy,
  onMapping,
  onParser,
  onParse
}: {
  upload: IntegrationUploadResponse | null;
  mapping: IntegrationColumnMapping;
  selectedParser: string;
  parsers: ParserInfo[];
  busy: boolean;
  onMapping: (mapping: IntegrationColumnMapping) => void;
  onParser: (parserName: string) => void;
  onParse: () => void;
}) {
  const columns = upload?.columns ?? [];
  return (
    <GlassCard>
      <PanelTitle icon={Wand2} title="Column Mapper" detail="normalize schema" />
      <div className="mt-5">
        <FieldLabel>Parser</FieldLabel>
        <select
          value={selectedParser}
          onChange={(event) => onParser(event.target.value)}
          className="mt-2 h-10 w-full rounded-md border border-border bg-panel px-3 text-sm text-foreground outline-none focus:border-primary"
        >
          {parsers.map((parser) => (
            <option key={parser.name} value={parser.name}>
              {parser.name}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {TARGET_FIELDS.map((field) => (
          <label key={field} className="block">
            <FieldLabel>{field}</FieldLabel>
            <select
              value={mapping[field] ?? ""}
              onChange={(event) => onMapping({ ...mapping, [field]: event.target.value || null })}
              disabled={!upload}
              className="mt-2 h-10 w-full rounded-md border border-border bg-panel px-3 text-sm text-foreground outline-none focus:border-primary disabled:opacity-50"
            >
              <option value="">Not mapped</option>
              {columns.map((column) => (
                <option key={column} value={column}>
                  {column}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="mt-5 flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3">
        <div className="text-sm text-muted-foreground">Maps arbitrary CSV headers into AERIS radar fields for preview and downstream experiments.</div>
        <NeonButton onClick={onParse} disabled={!upload || busy}>
          {busy ? <Loader2 size={17} className="animate-spin" /> : <Network size={17} />}
          Parse
        </NeonButton>
      </div>
    </GlassCard>
  );
}

function DataPreviewCard({
  rows,
  heatmap,
  warnings
}: {
  rows: Array<Record<string, number | string | null>>;
  heatmap: number[][] | null;
  warnings: string[];
}) {
  const columns = Object.keys(rows[0] ?? {});
  return (
    <GlassCard>
      <PanelTitle icon={Table2} title="Data Preview" detail={`${rows.length} preview rows`} />
      <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="max-h-[300px] overflow-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="sticky top-0 bg-panel text-xs uppercase tracking-[0.12em] text-muted-foreground">
                <tr>{columns.length ? columns.map((column) => <th key={column} className="p-3">{column}</th>) : <th className="p-3">Preview</th>}</tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.length ? (
                  rows.slice(0, 30).map((row, index) => (
                    <tr key={index} className="text-muted-foreground">
                      {columns.map((column) => (
                        <td key={column} className="p-3">{String(row[column] ?? "")}</td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="p-6 text-center text-muted-foreground">Upload and parse CSV data to preview rows.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <HeatmapCanvas heatmap={heatmap} />
          <WarningsPanel warnings={warnings} />
        </div>
      </div>
    </GlassCard>
  );
}

function ParserRegistryCard({ parsers, busy }: { parsers: ParserInfo[]; busy: boolean }) {
  return (
    <GlassCard>
      <PanelTitle icon={PlugZap} title="Parser Registry" detail={`${parsers.length} available`} />
      <div className="mt-4 space-y-3">
        {busy ? (
          <>
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </>
        ) : (
          parsers.map((parser) => (
            <div key={parser.name} className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-foreground">{parser.name}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{parser.description}</div>
                </div>
                <StatusBadge tone="online">active</StatusBadge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {parser.supported_extensions.map((extension) => (
                  <span key={extension} className="rounded-md border border-border bg-panel px-2 py-1 text-xs text-muted-foreground">
                    {extension}
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </GlassCard>
  );
}

function CustomModelAdapterCard({
  form,
  adapters,
  busy,
  onForm,
  onSubmit
}: {
  form: { model_name: string; model_type: string; expected_input_shape: string; classes: string; notes: string };
  adapters: ModelAdapter[];
  busy: boolean;
  onForm: (form: { model_name: string; model_type: string; expected_input_shape: string; classes: string; notes: string }) => void;
  onSubmit: () => void;
}) {
  return (
    <GlassCard>
      <PanelTitle icon={Binary} title="Custom Model Adapter" detail={`${adapters.length} registered`} />
      <div className="mt-4 rounded-lg border border-amber-400/35 bg-amber-400/10 p-3 text-sm text-amber-200 dark:text-amber-100">
        Arbitrary Python execution is disabled by default. This registry stores metadata only until an operator explicitly builds a safe adapter.
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <TextField label="Model name" value={form.model_name} onChange={(value) => onForm({ ...form, model_name: value })} placeholder="my-lab-radar-cnn" />
        <TextField label="Model type" value={form.model_type} onChange={(value) => onForm({ ...form, model_type: value })} placeholder="onnx, sklearn, torch-cnn" />
        <TextField label="Expected input shape" value={form.expected_input_shape} onChange={(value) => onForm({ ...form, expected_input_shape: value })} placeholder="128x128 or 1x128x128" />
        <TextField label="Classes" value={form.classes} onChange={(value) => onForm({ ...form, classes: value })} placeholder="drone,bird,vehicle" />
      </div>
      <label className="mt-4 block">
        <FieldLabel>Notes</FieldLabel>
        <textarea
          value={form.notes}
          onChange={(event) => onForm({ ...form, notes: event.target.value })}
          className="mt-2 min-h-24 w-full rounded-md border border-border bg-panel px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          placeholder="Input normalization, provenance, validation notes..."
        />
      </label>
      <div className="mt-5 flex justify-end">
        <Button onClick={onSubmit} disabled={busy || !form.model_name.trim()}>
          {busy ? <Loader2 size={17} className="animate-spin" /> : <FileJson size={17} />}
          Register Metadata
        </Button>
      </div>
      <div className="mt-5 grid gap-3">
        {adapters.slice(0, 4).map((adapter) => (
          <div key={adapter.adapter_id} className="rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium text-foreground">{adapter.model_name}</div>
                <div className="mt-1 text-xs text-muted-foreground">{adapter.model_type} · {adapter.expected_input_shape}</div>
              </div>
              <StatusBadge tone="neutral">metadata</StatusBadge>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">{adapter.classes.join(", ")}</div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

function HeatmapCanvas({ heatmap }: { heatmap: number[][] | null }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const data = heatmap ?? demoHeatmap();
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
  }, [heatmap]);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <FieldLabel>Heatmap preview</FieldLabel>
        <StatusBadge tone={heatmap ? "online" : "neutral"}>{heatmap ? "mapped" : "demo"}</StatusBadge>
      </div>
      <canvas ref={canvasRef} width={480} height={260} className="h-56 w-full rounded-lg border border-border bg-muted/30" />
    </div>
  );
}

function WarningsPanel({ warnings }: { warnings: string[] }) {
  return (
    <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <AlertTriangle size={16} className={warnings.length ? "text-amber-400" : "text-emerald-400"} />
        Warnings
      </div>
      <div className="mt-3 space-y-2 text-sm text-muted-foreground">
        {warnings.length ? warnings.slice(0, 6).map((warning) => <div key={warning}>{warning}</div>) : <div>No parser warnings yet.</div>}
      </div>
    </div>
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

function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      <Input className="mt-2" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}

function MetaPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}

function Toast({ tone, message }: { tone: "success" | "error"; message: string }) {
  const Icon = tone === "success" ? CheckCircle2 : AlertTriangle;
  return (
    <div
      className={cn(
        "fixed right-5 top-5 z-50 flex max-w-sm items-start gap-3 rounded-lg border p-4 text-sm shadow-glow backdrop-blur",
        tone === "success"
          ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
          : "border-danger/40 bg-danger/15 text-danger"
      )}
    >
      <Icon size={18} />
      <span>{message}</span>
    </div>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-muted", className)} />;
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{children}</span>;
}

function emptyMapping(): IntegrationColumnMapping {
  return {
    range_m: null,
    velocity_mps: null,
    angle_deg: null,
    amplitude: null,
    timestamp: null,
    class_label: null
  };
}

function autoMapColumns(columns: string[]): IntegrationColumnMapping {
  const lower = columns.map((column) => ({ original: column, normalized: column.toLowerCase().replace(/[^a-z0-9]/g, "_") }));
  const mapped = emptyMapping();
  TARGET_FIELDS.forEach((field) => {
    const match = lower.find((column) => FIELD_HINTS[field].some((hint) => column.normalized === hint || column.normalized.includes(hint)));
    mapped[field] = match?.original ?? null;
  });
  return mapped;
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
  return Array.from({ length: 36 }, (_, row) =>
    Array.from({ length: 36 }, (_, col) => {
      const p1 = Math.exp(-((row - 20) ** 2 + (col - 12) ** 2) / 42);
      const p2 = Math.exp(-((row - 13) ** 2 + (col - 26) ** 2) / 32);
      return Math.min(1, 0.05 + p1 * 0.78 + p2 * 0.48 + ((row * 5 + col * 3) % 11) * 0.004);
    })
  );
}
