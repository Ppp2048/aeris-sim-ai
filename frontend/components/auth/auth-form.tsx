"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { login, register } from "@/lib/api";
import { saveToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [name, setName] = useState("AERIS Analyst");
  const [email, setEmail] = useState(mode === "login" ? "admin@aeris.local" : "operator@aeris.local");
  const [password, setPassword] = useState(mode === "login" ? "admin123" : "aeris-local-pass");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      const result = mode === "login" ? await login(email, password) : await register(name, email, password);
      saveToken(result.access_token);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-cyan-300 text-slate-950">
            <LockKeyhole size={22} />
          </div>
          <CardTitle>{mode === "login" ? "Operator Login" : "Create Local Account"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            {mode === "register" && (
              <Input value={name} onChange={(event) => setName(event.target.value)} type="text" aria-label="Name" />
            )}
            <Input value={email} onChange={(event) => setEmail(event.target.value)} type="email" aria-label="Email" />
            <Input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              aria-label="Password"
            />
            {error && <div className="rounded-md border border-rose-400/40 bg-rose-400/10 p-3 text-sm text-rose-100">{error}</div>}
            <Button className="w-full" type="submit">
              {mode === "login" ? "Login" : "Register"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
