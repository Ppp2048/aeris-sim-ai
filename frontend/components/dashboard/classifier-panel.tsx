"use client";

import { useEffect, useState } from "react";
import { BrainCircuit, DatabaseZap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { generateDataset, getModelStatus, trainModel } from "@/lib/api";
import type { ModelStatus } from "@/lib/types";

export function ClassifierPanel() {
  const [status, setStatus] = useState<ModelStatus | null>(null);
  const [message, setMessage] = useState<string>("Ready");

  useEffect(() => {
    void getModelStatus().then(setStatus).catch(() => setMessage("Backend offline"));
  }, []);

  async function train() {
    setMessage("Training local classifier");
    setStatus(await trainModel());
    setMessage("Model trained");
  }

  async function dataset() {
    const result = await generateDataset(300);
    setMessage(`Dataset written: ${result.sample_count} rows`);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-white">Classifier Lab</h1>
        <p className="mt-1 text-sm text-slate-400">Train and inspect the local object classifier for simulated detections.</p>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Model Status</CardTitle>
            <BrainCircuit className="text-cyan-200" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-3xl font-semibold text-white">{status?.trained ? "Trained" : "Untrained"}</div>
            <div>Model: {status?.model_name ?? "Loading"}</div>
            <div>Accuracy: {status?.accuracy ? `${Math.round(status.accuracy * 100)}%` : "Pending local run"}</div>
            <div>Classes: {status?.classes.join(", ") ?? "Loading"}</div>
            <Button onClick={train}>Train Model</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Dataset Generator</CardTitle>
            <DatabaseZap className="text-amber-200" />
          </CardHeader>
          <CardContent className="space-y-4">
            <p>Generate a CSV under backend local data storage for repeatable classifier experiments.</p>
            <Button variant="secondary" onClick={dataset}>
              Generate 300 Samples
            </Button>
            <div className="rounded-md border border-slate-700 bg-slate-950 p-3 text-slate-300">{message}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
