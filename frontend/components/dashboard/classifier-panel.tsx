"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  Cpu,
  DatabaseZap,
  FlaskConical,
  Layers3,
  Loader2,
  Play,
  RefreshCcw,
  ScanLine,
  Sparkles,
  TriangleAlert
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PremiumCard } from "@/components/ui/premium-card";
import { Input } from "@/components/ui/input";
import { NeonButton } from "@/components/ui/neon-button";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  generateSyntheticDataset,
  getClassifierStatus,
  getSyntheticSample,
  listClassifierModels,
  listSyntheticDatasets,
  predictClassifierSample,
  trainClassifierModel
} from "@/lib/api";
import type {
  ClassifierModelMetadata,
  ClassifierModelType,
  ClassifierPrediction,
  ClassifierStatus,
  SyntheticDatasetSummary,
  SyntheticSample
} from "@/lib/types";
import { cn } from "@/lib/utils";

type BusyKey = "datasets" | "generate" | "train" | "sample" | "predict";

export function ClassifierPanel() {
  const [datasets, setDatasets] = useState<SyntheticDatasetSummary[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState("");
  const [samplesPerClass, setSamplesPerClass] = useState(25);
  const [noiseLevel, setNoiseLevel] = useState(0.08);
  const [clutterLevel, setClutterLevel] = useState(0.04);
  const [modelType, setModelType] = useState<ClassifierModelType>("sklearn_rf");
  const [status, setStatus] = useState<ClassifierStatus | null>(null);
  const [models, setModels] = useState<ClassifierModelMetadata[]>([]);
  const [sampleId, setSampleId] = useState(1);
  const [sample, setSample] = useState<SyntheticSample | null>(null);
  const [prediction, setPrediction] = useState<ClassifierPrediction | null>(null);
  const [busy, setBusy] = useState<Record<BusyKey, boolean>>({
    datasets: true,
    generate: false,
    train: false,
    sample: false,
    predict: false
  });
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  const selectedDataset = useMemo(
    () => datasets.find((dataset) => dataset.dataset_id === selectedDatasetId) ?? null,
    [datasets, selectedDatasetId]
  );
  const activeModel = useMemo(
    () => models.find((model) => model.model_id === status?.active_model_id) ?? models[0] ?? null,
    [models, status?.active_model_id]
  );

  useEffect(() => {
    void refreshLab();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedDatasetId) return;
    void loadSample(selectedDatasetId, sampleId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDatasetId, sampleId]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(timer);
  }, [toast]);

  async function refreshLab() {
    setBusy((current) => ({ ...current, datasets: true }));
    setError(null);
    try {
      const [datasetRows, modelStatus, modelRows] = await Promise.all([
        listSyntheticDatasets(),
        getClassifierStatus(),
        listClassifierModels()
      ]);
      setDatasets(datasetRows);
      setStatus(modelStatus);
      setModels(modelRows);
      if (!selectedDatasetId && datasetRows[0]) {
        setSelectedDatasetId(datasetRows[0].dataset_id);
      }
    } catch (err) {
      showError(err, "Unable to load classifier lab state");
    } finally {
      setBusy((current) => ({ ...current, datasets: false }));
    }
  }

  async function handleGenerateDataset() {
    setBusy((current) => ({ ...current, generate: true }));
    setError(null);
    try {
      const generated = await generateSyntheticDataset({
        samples_per_class: samplesPerClass,
        noise_level: noiseLevel,
        clutter_level: clutterLevel
      });
      const datasetRows = await listSyntheticDatasets();
      setDatasets(datasetRows);
      setSelectedDatasetId(generated.dataset_id);
      setSampleId(1);
      setPrediction(null);
      setToast({ tone: "success", message: `Generated ${generated.total_samples} synthetic heatmaps` });
    } catch (err) {
      showError(err, "Dataset generation failed");
    } finally {
      setBusy((current) => ({ ...current, generate: false }));
    }
  }

  async function handleTrain() {
    if (!selectedDatasetId) {
      setError("Generate or select a dataset before training.");
      return;
    }
    setBusy((current) => ({ ...current, train: true }));
    setError(null);
    try {
      const trained = await trainClassifierModel({ dataset_id: selectedDatasetId, model_type: modelType });
      const [modelStatus, modelRows] = await Promise.all([getClassifierStatus(), listClassifierModels()]);
      setStatus(modelStatus);
      setModels(modelRows);
      setToast({ tone: "success", message: `Trained ${trained.type} model at ${accuracyText(trained.accuracy_estimate)}` });
    } catch (err) {
      showError(err, "Training failed");
    } finally {
      setBusy((current) => ({ ...current, train: false }));
    }
  }

  async function loadSample(datasetId: string, nextSampleId: number) {
    setBusy((current) => ({ ...current, sample: true }));
    setError(null);
    try {
      const loaded = await getSyntheticSample(datasetId, nextSampleId);
      setSample(loaded);
      setPrediction(null);
    } catch (err) {
      setSample(null);
      showError(err, "Sample preview failed");
    } finally {
      setBusy((current) => ({ ...current, sample: false }));
    }
  }

  async function handlePredict() {
    if (!selectedDatasetId) {
      setError("Select a dataset and sample before prediction.");
      return;
    }
    setBusy((current) => ({ ...current, predict: true }));
    setError(null);
    try {
      const result = await predictClassifierSample({ dataset_id: selectedDatasetId, sample_id: sampleId });
      setPrediction(result);
      setToast({ tone: "success", message: `Prediction: ${result.predicted_class} (${Math.round(result.confidence * 100)}%)` });
    } catch (err) {
      showError(err, "Prediction failed");
    } finally {
      setBusy((current) => ({ ...current, predict: false }));
    }
  }

  function showError(err: unknown, fallback: string) {
    const message = err instanceof Error ? err.message : fallback;
    setError(message);
    setToast({ tone: "error", message });
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Classifier Lab"
        description="Generate synthetic range-Doppler datasets, train compact local models, and inspect heatmap predictions."
        actions={
          <>
            <Button variant="secondary" onClick={refreshLab} disabled={busy.datasets}>
              <RefreshCcw size={16} className={busy.datasets ? "animate-spin" : ""} />
              Refresh
            </Button>
            <StatusBadge tone={status?.trained ? "online" : "warning"}>
              {status?.trained ? "Model loaded" : "No model loaded"}
            </StatusBadge>
          </>
        }
      />

      {toast && <Toast tone={toast.tone} message={toast.message} />}
      {error && <div className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{error}</div>}

      <div className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="space-y-5">
          <DatasetGeneratorCard
            samplesPerClass={samplesPerClass}
            noiseLevel={noiseLevel}
            clutterLevel={clutterLevel}
            busy={busy.generate}
            onSamplesPerClass={setSamplesPerClass}
            onNoiseLevel={setNoiseLevel}
            onClutterLevel={setClutterLevel}
            onGenerate={handleGenerateDataset}
          />
          <TrainingCard
            datasets={datasets}
            selectedDatasetId={selectedDatasetId}
            modelType={modelType}
            torchAvailable={status?.torch_available ?? false}
            busy={busy.train}
            onDataset={setSelectedDatasetId}
            onModelType={setModelType}
            onTrain={handleTrain}
          />
          <PredictionCard
            dataset={selectedDataset}
            sampleId={sampleId}
            busy={busy.predict}
            hasModel={Boolean(status?.trained)}
            onSampleId={setSampleId}
            onPredict={handlePredict}
            prediction={prediction}
          />
        </div>

        <div className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
            <HeatmapPreview sample={sample} busy={busy.sample} prediction={prediction} />
            <ModelStatusPanel status={status} activeModel={activeModel} prediction={prediction} />
          </div>
          <DatasetInventory datasets={datasets} selectedDatasetId={selectedDatasetId} busy={busy.datasets} />
        </div>
      </div>
    </div>
  );
}

function DatasetGeneratorCard({
  samplesPerClass,
  noiseLevel,
  clutterLevel,
  busy,
  onSamplesPerClass,
  onNoiseLevel,
  onClutterLevel,
  onGenerate
}: {
  samplesPerClass: number;
  noiseLevel: number;
  clutterLevel: number;
  busy: boolean;
  onSamplesPerClass: (value: number) => void;
  onNoiseLevel: (value: number) => void;
  onClutterLevel: (value: number) => void;
  onGenerate: () => void;
}) {
  return (
    <PremiumCard>
      <PanelTitle icon={DatabaseZap} title="Dataset Generator" detail="synthetic .npy heatmaps" />
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <NumberField label="Samples / class" value={samplesPerClass} min={1} max={1000} step={1} onChange={onSamplesPerClass} />
        <NumberField label="Noise level" value={noiseLevel} min={0} max={0.6} step={0.01} onChange={onNoiseLevel} />
        <NumberField label="Clutter level" value={clutterLevel} min={0} max={0.4} step={0.01} onChange={onClutterLevel} />
      </div>
      <div className="mt-5 flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3">
        <div className="text-sm text-muted-foreground">
          Generates five labeled classes locally: drone, bird, vehicle, human, clutter.
        </div>
        <NeonButton onClick={onGenerate} disabled={busy}>
          {busy ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}
          Generate Dataset
        </NeonButton>
      </div>
    </PremiumCard>
  );
}

function TrainingCard({
  datasets,
  selectedDatasetId,
  modelType,
  torchAvailable,
  busy,
  onDataset,
  onModelType,
  onTrain
}: {
  datasets: SyntheticDatasetSummary[];
  selectedDatasetId: string;
  modelType: ClassifierModelType;
  torchAvailable: boolean;
  busy: boolean;
  onDataset: (datasetId: string) => void;
  onModelType: (modelType: ClassifierModelType) => void;
  onTrain: () => void;
}) {
  return (
    <PremiumCard>
      <PanelTitle icon={FlaskConical} title="Model Training" detail="small local classifier" />
      <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_0.75fr]">
        <label className="block">
          <FieldLabel>Dataset</FieldLabel>
          <select
            value={selectedDatasetId}
            onChange={(event) => onDataset(event.target.value)}
            className="h-10 w-full rounded-md border border-border bg-panel px-3 text-sm text-foreground outline-none focus:border-primary"
          >
            <option value="">Select dataset</option>
            {datasets.map((dataset) => (
              <option key={dataset.dataset_id} value={dataset.dataset_id}>
                {dataset.name} ({dataset.total_samples})
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <FieldLabel>Model type</FieldLabel>
          <select
            value={modelType}
            onChange={(event) => onModelType(event.target.value as ClassifierModelType)}
            className="h-10 w-full rounded-md border border-border bg-panel px-3 text-sm text-foreground outline-none focus:border-primary"
          >
            <option value="sklearn_rf">Sklearn RF</option>
            <option value="logistic_regression">Sklearn Logistic</option>
            <option value="torch_cnn" disabled={!torchAvailable}>
              CNN {torchAvailable ? "" : "(torch unavailable)"}
            </option>
          </select>
        </label>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          CNN mode remains optional; no external model downloads are used.
        </div>
        <Button onClick={onTrain} disabled={busy || !selectedDatasetId}>
          {busy ? <Loader2 size={17} className="animate-spin" /> : <Cpu size={17} />}
          Train
        </Button>
      </div>
    </PremiumCard>
  );
}

function PredictionCard({
  dataset,
  sampleId,
  busy,
  hasModel,
  onSampleId,
  onPredict,
  prediction
}: {
  dataset: SyntheticDatasetSummary | null;
  sampleId: number;
  busy: boolean;
  hasModel: boolean;
  onSampleId: (sampleId: number) => void;
  onPredict: () => void;
  prediction: ClassifierPrediction | null;
}) {
  const maxSample = dataset?.total_samples ?? 1;
  return (
    <PremiumCard>
      <PanelTitle icon={ScanLine} title="Prediction" detail="sample inference" />
      <div className="mt-5 grid gap-4 sm:grid-cols-[0.6fr_1fr]">
        <NumberField label="Sample ID" value={sampleId} min={1} max={maxSample} step={1} onChange={(value) => onSampleId(clamp(Math.round(value), 1, maxSample))} />
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
          {dataset ? `${dataset.total_samples} samples in selected dataset` : "Generate or choose a dataset to preview samples."}
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          {hasModel ? "Runs against the loaded local classifier." : "Train or load a model before predicting."}
        </div>
        <NeonButton onClick={onPredict} disabled={busy || !dataset || !hasModel}>
          {busy ? <Loader2 size={17} className="animate-spin" /> : <Play size={17} />}
          Run Prediction
        </NeonButton>
      </div>
      {prediction && (
        <div className="mt-5 rounded-lg border border-primary/30 bg-primary/10 p-4">
          <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Predicted class</div>
          <div className="mt-2 flex items-end justify-between gap-3">
            <div className="text-3xl font-semibold capitalize text-foreground">{prediction.predicted_class}</div>
            <div className="text-lg font-semibold text-primary">{Math.round(prediction.confidence * 100)}%</div>
          </div>
          <div className="mt-4 space-y-2">
            {prediction.top_predictions.map((item) => (
              <PredictionBar key={item.class_label} label={item.class_label} value={item.confidence} />
            ))}
          </div>
        </div>
      )}
    </PremiumCard>
  );
}

function HeatmapPreview({
  sample,
  busy,
  prediction
}: {
  sample: SyntheticSample | null;
  busy: boolean;
  prediction: ClassifierPrediction | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#07111f";
    ctx.fillRect(0, 0, width, height);
    const heatmap = sample?.heatmap_preview ?? demoHeatmap();
    const rows = heatmap.length;
    const cols = heatmap[0]?.length ?? 1;
    const cellW = width / cols;
    const cellH = height / rows;
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        ctx.fillStyle = heatColor(heatmap[row][col]);
        ctx.fillRect(col * cellW, row * cellH, Math.ceil(cellW), Math.ceil(cellH));
      }
    }
  }, [sample]);

  return (
    <PremiumCard>
      <PanelTitle icon={BarChart3} title="Heatmap Preview" detail={sample ? `sample ${sample.sample_id}` : "demo"} />
      {busy ? (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-[320px]" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : (
        <>
          <canvas ref={canvasRef} width={560} height={380} className="mt-4 h-[320px] w-full rounded-lg border border-border bg-muted/30" />
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <MetaPill label="Label" value={String(sample?.metadata.class_label ?? "preview")} />
            <MetaPill label="Range" value={sample ? `${Number(sample.metadata.range_m).toFixed(1)} m` : "synthetic"} />
            <MetaPill label="Velocity" value={sample ? `${Number(sample.metadata.velocity_mps).toFixed(1)} m/s` : "synthetic"} />
          </div>
          {prediction && <div className="mt-3 text-sm text-muted-foreground">Last inference: {prediction.inference_ms.toFixed(2)} ms</div>}
        </>
      )}
    </PremiumCard>
  );
}

function ModelStatusPanel({
  status,
  activeModel,
  prediction
}: {
  status: ClassifierStatus | null;
  activeModel: ClassifierModelMetadata | null;
  prediction: ClassifierPrediction | null;
}) {
  return (
    <PremiumCard>
      <PanelTitle icon={BrainCircuit} title="Model Status" detail={status?.torch_available ? "torch available" : "sklearn mode"} />
      {!status ? (
        <div className="mt-5 space-y-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <StatusMetric label="Loaded model" value={activeModel?.model_id ?? "none"} tone={status.trained ? "text-primary" : "text-muted-foreground"} />
          <StatusMetric label="Model type" value={activeModel?.type ?? status.active_model_type ?? "untrained"} />
          <StatusMetric label="Accuracy estimate" value={accuracyText(activeModel?.accuracy_estimate ?? status.accuracy_estimate)} />
          <StatusMetric label="Created at" value={activeModel ? formatDate(activeModel.created_at) : "pending"} />
          <StatusMetric label="Inference ms" value={prediction ? prediction.inference_ms.toFixed(2) : "pending"} />
          <div>
            <FieldLabel>Classes</FieldLabel>
            <div className="mt-2 flex flex-wrap gap-2">
              {status.classes.map((className) => (
                <span key={className} className="rounded-md border border-border bg-muted/35 px-2 py-1 text-xs capitalize text-muted-foreground">
                  {className}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </PremiumCard>
  );
}

function DatasetInventory({
  datasets,
  selectedDatasetId,
  busy
}: {
  datasets: SyntheticDatasetSummary[];
  selectedDatasetId: string;
  busy: boolean;
}) {
  return (
    <PremiumCard>
      <PanelTitle icon={Layers3} title="Dataset Inventory" detail={`${datasets.length} local datasets`} />
      {busy ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : datasets.length ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {datasets.slice(0, 6).map((dataset) => (
            <div
              key={dataset.dataset_id}
              className={cn(
                "rounded-lg border bg-muted/30 p-4",
                dataset.dataset_id === selectedDatasetId ? "border-primary/50" : "border-border"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-foreground">{dataset.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{formatDate(dataset.created_at)}</div>
                </div>
                <StatusBadge tone={dataset.dataset_id === selectedDatasetId ? "online" : "neutral"}>
                  {dataset.total_samples}
                </StatusBadge>
              </div>
              <div className="mt-3 text-xs text-muted-foreground">{dataset.classes.join(", ")}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          No classifier datasets yet. Generate a small default dataset to begin.
        </div>
      )}
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
  min,
  max,
  step,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      <Input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2"
      />
    </label>
  );
}

function PredictionBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="capitalize text-muted-foreground">{label}</span>
        <span className="text-foreground">{Math.round(value * 100)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
    </div>
  );
}

function StatusMetric({ label, value, tone = "text-foreground" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className={cn("mt-2 break-words text-sm font-medium", tone)}>{value}</div>
    </div>
  );
}

function MetaPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium capitalize text-foreground">{value}</div>
    </div>
  );
}

function Toast({ tone, message }: { tone: "success" | "error"; message: string }) {
  const Icon = tone === "success" ? CheckCircle2 : TriangleAlert;
  return (
    <div
      className={cn(
        "fixed right-5 top-5 z-50 flex max-w-sm items-start gap-3 rounded-lg border p-4 text-sm shadow-lg",
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
  return Array.from({ length: 32 }, (_, row) =>
    Array.from({ length: 32 }, (_, col) => {
      const p1 = Math.exp(-((row - 18) ** 2 + (col - 10) ** 2) / 38);
      const p2 = Math.exp(-((row - 12) ** 2 + (col - 23) ** 2) / 28);
      return Math.min(1, 0.06 + p1 * 0.8 + p2 * 0.48 + ((row * 5 + col * 3) % 11) * 0.005);
    })
  );
}

function accuracyText(value: number | null | undefined) {
  return typeof value === "number" ? `${Math.round(value * 100)}%` : "pending";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
