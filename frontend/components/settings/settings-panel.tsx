"use client";

import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { useTheme } from "next-themes";
import {
  Activity,
  BrainCircuit,
  CheckCircle2,
  Code2,
  Database,
  Gauge,
  Moon,
  Radar,
  RadioTower,
  RefreshCcw,
  Save,
  ServerCog,
  ShieldAlert,
  SlidersHorizontal,
  Sun,
  UserCircle2,
  Wifi,
  WifiOff
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { Input } from "@/components/ui/input";
import { NeonButton } from "@/components/ui/neon-button";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { API_BASE, getClassifierStatus, getMe } from "@/lib/api";
import { readToken } from "@/lib/auth";
import { simulationSocketUrl } from "@/lib/websocket";
import type { ClassifierStatus, User } from "@/lib/types";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "aeris_settings";
const APP_VERSION = "0.1.0";

type SimulationDefaults = {
  radar_range_m: number;
  noise_level: number;
  clutter_level: number;
  frame_rate: number;
};

type ModelPreferences = {
  active_model: string;
  classifier_mode: "auto" | "sklearn_rf" | "logistic_regression" | "torch_cnn";
};

type LocalSettings = {
  simulation: SimulationDefaults;
  model: ModelPreferences;
};

const DEFAULT_SETTINGS: LocalSettings = {
  simulation: {
    radar_range_m: 3000,
    noise_level: 0.08,
    clutter_level: 0.04,
    frame_rate: 4
  },
  model: {
    active_model: "latest",
    classifier_mode: "auto"
  }
};

export function SettingsPanel() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [profile, setProfile] = useState<User | null>(null);
  const [classifier, setClassifier] = useState<ClassifierStatus | null>(null);
  const [settings, setSettings] = useState<LocalSettings>(DEFAULT_SETTINGS);
  const [socketStatus, setSocketStatus] = useState<"checking" | "online" | "offline">("checking");
  const [message, setMessage] = useState("Settings ready");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    setSettings(readLocalSettings());
    void loadProfile();
    void loadModelStatus();
    checkWebSocket();
  }, []);

  function loadProfile() {
    const token = readToken();
    if (!token) return Promise.resolve();
    return getMe(token)
      .then(setProfile)
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load profile"));
  }

  function loadModelStatus() {
    return getClassifierStatus()
      .then(setClassifier)
      .catch(() => {
        setClassifier(null);
      });
  }

  function checkWebSocket() {
    setSocketStatus("checking");
    try {
      const socket = new WebSocket(simulationSocketUrl());
      const timer = setTimeout(() => {
        socket.close();
        setSocketStatus("offline");
      }, 2500);
      socket.onopen = () => {
        clearTimeout(timer);
        setSocketStatus("online");
        socket.close();
      };
      socket.onerror = () => {
        clearTimeout(timer);
        setSocketStatus("offline");
      };
    } catch {
      setSocketStatus("offline");
    }
  }

  function updateSimulation(key: keyof SimulationDefaults, value: number) {
    setSettings((current) => ({
      ...current,
      simulation: { ...current.simulation, [key]: value }
    }));
  }

  function updateModel(key: keyof ModelPreferences, value: string) {
    setSettings((current) => ({
      ...current,
      model: { ...current.model, [key]: value }
    }));
  }

  function saveSettings() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    setMessage("Settings saved to localStorage");
    setTimeout(() => setMessage("Settings ready"), 2400);
  }

  const activeModel = settings.model.active_model === "latest" ? classifier?.active_model_id ?? "latest available" : settings.model.active_model;
  const themeValue = mounted ? theme ?? "dark" : "dark";
  const socketTone = socketStatus === "online" ? "online" : socketStatus === "checking" ? "warning" : "danger";

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Settings"
        description="Local operator preferences, simulation defaults, model settings, and software-only safety scope."
        actions={
          <>
            <StatusBadge tone={socketTone}>
              {socketStatus === "online" ? <Wifi size={14} /> : <WifiOff size={14} />}
              WebSocket {socketStatus}
            </StatusBadge>
            <NeonButton onClick={saveSettings}>
              <Save size={17} />
              Save Settings
            </NeonButton>
          </>
        }
      />

      {error && <div className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{error}</div>}
      <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm text-primary">{message}</div>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-5">
          <ProfileCard profile={profile} />
          <ThemeCard value={themeValue} resolvedTheme={resolvedTheme} mounted={mounted} onTheme={setTheme} />
          <SafetyScopeCard />
        </div>

        <div className="space-y-5">
          <SimulationDefaultsCard values={settings.simulation} onChange={updateSimulation} />
          <ModelSettingsCard
            preferences={settings.model}
            classifier={classifier}
            activeModel={activeModel}
            onChange={updateModel}
            onRefresh={loadModelStatus}
          />
          <DeveloperInfoCard socketStatus={socketStatus} onCheckSocket={checkWebSocket} />
        </div>
      </div>
    </div>
  );
}

function ProfileCard({ profile }: { profile: User | null }) {
  return (
    <GlassCard>
      <PanelTitle icon={UserCircle2} title="Profile" detail="authenticated operator" />
      <div className="mt-5 grid gap-3">
        <InfoRow label="Name" value={profile?.name ?? "Loading"} />
        <InfoRow label="Email" value={profile?.email ?? "Loading"} />
        <InfoRow label="Role" value={profile?.role ?? "local"} capitalize />
      </div>
    </GlassCard>
  );
}

function ThemeCard({
  value,
  resolvedTheme,
  mounted,
  onTheme
}: {
  value: string;
  resolvedTheme?: string;
  mounted: boolean;
  onTheme: (theme: string) => void;
}) {
  const options = [
    { id: "dark", label: "Dark", icon: Moon },
    { id: "light", label: "Light", icon: Sun },
    { id: "system", label: "System", icon: Activity }
  ];
  return (
    <GlassCard>
      <PanelTitle icon={SlidersHorizontal} title="Theme" detail={mounted ? `resolved ${resolvedTheme ?? value}` : "loading"} />
      <div className="mt-5 grid grid-cols-3 gap-2">
        {options.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onTheme(id)}
            className={cn(
              "rounded-lg border p-3 text-sm transition",
              value === id ? "border-primary bg-primary/15 text-primary" : "border-border bg-muted/30 text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="mx-auto mb-2" size={18} />
            {label}
          </button>
        ))}
      </div>
    </GlassCard>
  );
}

function SimulationDefaultsCard({
  values,
  onChange
}: {
  values: SimulationDefaults;
  onChange: (key: keyof SimulationDefaults, value: number) => void;
}) {
  return (
    <GlassCard>
      <PanelTitle icon={Radar} title="Simulation Defaults" detail="saved locally" />
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <NumberField label="Radar range" suffix="m" value={values.radar_range_m} min={500} max={20000} step={100} onChange={(value) => onChange("radar_range_m", value)} />
        <NumberField label="Frame rate" suffix="fps" value={values.frame_rate} min={0.5} max={30} step={0.5} onChange={(value) => onChange("frame_rate", value)} />
      </div>
      <div className="mt-5 grid gap-5">
        <SliderField label="Noise level" value={values.noise_level} min={0} max={0.6} step={0.01} onChange={(value) => onChange("noise_level", value)} />
        <SliderField label="Clutter level" value={values.clutter_level} min={0} max={0.4} step={0.01} onChange={(value) => onChange("clutter_level", value)} />
      </div>
    </GlassCard>
  );
}

function ModelSettingsCard({
  preferences,
  classifier,
  activeModel,
  onChange,
  onRefresh
}: {
  preferences: ModelPreferences;
  classifier: ClassifierStatus | null;
  activeModel: string;
  onChange: (key: keyof ModelPreferences, value: string) => void;
  onRefresh: () => Promise<void>;
}) {
  return (
    <GlassCard>
      <PanelTitle icon={BrainCircuit} title="Model Settings" detail={classifier?.trained ? "loaded" : "untrained"} />
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <FieldLabel>Active model</FieldLabel>
          <Input className="mt-2" value={preferences.active_model} onChange={(event) => onChange("active_model", event.target.value)} placeholder="latest" />
        </label>
        <label className="block">
          <FieldLabel>Classifier mode</FieldLabel>
          <select
            value={preferences.classifier_mode}
            onChange={(event) => onChange("classifier_mode", event.target.value)}
            className="mt-2 h-10 w-full rounded-md border border-border bg-panel px-3 text-sm text-foreground outline-none focus:border-primary"
          >
            <option value="auto">Auto</option>
            <option value="sklearn_rf">Sklearn RF</option>
            <option value="logistic_regression">Sklearn Logistic</option>
            <option value="torch_cnn">Torch CNN</option>
          </select>
        </label>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <InfoTile label="Backend active" value={activeModel} />
        <InfoTile label="Accuracy" value={classifier?.accuracy_estimate ? `${Math.round(classifier.accuracy_estimate * 100)}%` : "pending"} />
        <InfoTile label="Classes" value={String(classifier?.classes.length ?? 0)} />
      </div>
      <div className="mt-5 flex justify-end">
        <Button variant="secondary" onClick={() => void onRefresh()}>
          <RefreshCcw size={16} />
          Refresh Model
        </Button>
      </div>
    </GlassCard>
  );
}

function SafetyScopeCard() {
  const rows = [
    "Software simulation only",
    "No hardware control",
    "No RF transmission",
    "No PCB, STM32, or FPGA implementation"
  ];
  return (
    <GlassCard>
      <PanelTitle icon={ShieldAlert} title="Safety and Scope" detail="local digital twin" />
      <div className="mt-5 space-y-3">
        {rows.map((row) => (
          <div key={row} className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
            <CheckCircle2 className="text-emerald-500" size={18} />
            <span className="text-sm text-foreground">{row}</span>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

function DeveloperInfoCard({
  socketStatus,
  onCheckSocket
}: {
  socketStatus: "checking" | "online" | "offline";
  onCheckSocket: () => void;
}) {
  const wsUrl = simulationSocketUrl();
  return (
    <GlassCard>
      <PanelTitle icon={Code2} title="Developer Info" detail={`v${APP_VERSION}`} />
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <InfoTile icon={ServerCog} label="Backend URL" value={API_BASE} />
        <InfoTile icon={Wifi} label="WebSocket" value={wsUrl} />
        <InfoTile icon={Database} label="Storage" value="SQLite + localStorage" />
        <InfoTile icon={Gauge} label="App version" value={APP_VERSION} />
      </div>
      <div className="mt-5 flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3">
        <div className="text-sm text-muted-foreground">Simulation stream status: {socketStatus}</div>
        <Button variant="secondary" onClick={onCheckSocket}>
          <RadioTower size={16} />
          Check Socket
        </Button>
      </div>
    </GlassCard>
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
  onChange
}: {
  label: string;
  value: number;
  suffix?: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      <div className="mt-2 flex items-center gap-2">
        <Input type="number" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} />
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
      <div className="mb-2 flex items-center justify-between gap-3">
        <FieldLabel>{label}</FieldLabel>
        <span className="rounded-md bg-muted px-2 py-1 text-xs text-foreground">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-cyan-400"
      />
    </label>
  );
}

function InfoRow({ label, value, capitalize = false }: { label: string; value: string; capitalize?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-sm font-medium text-foreground", capitalize && "capitalize")}>{value}</div>
    </div>
  );
}

function InfoTile({ label, value, icon: Icon }: { label: string; value: string; icon?: LucideIcon }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.14em] text-muted-foreground">
        {label}
        {Icon && <Icon size={15} />}
      </div>
      <div className="mt-2 break-words text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{children}</span>;
}

function readLocalSettings(): LocalSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<LocalSettings>;
    return {
      simulation: { ...DEFAULT_SETTINGS.simulation, ...parsed.simulation },
      model: { ...DEFAULT_SETTINGS.model, ...parsed.model }
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}
