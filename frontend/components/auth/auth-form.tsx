"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowRight, Eye, EyeOff, LockKeyhole, Radar, ScanLine, ShieldCheck } from "lucide-react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { AppBackground } from "@/components/ui/app-background";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PremiumCard } from "@/components/ui/premium-card";
import { PremiumButton } from "@/components/ui/premium-button";
import { StatusBadge } from "@/components/ui/status-badge";
import { checkBackendHealth, login, register } from "@/lib/api";
import { saveToken } from "@/lib/auth";
import { cn } from "@/lib/utils";

type FormErrors = {
  name?: string;
  email?: string;
  password?: string;
  form?: string;
};

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState("AERIS Analyst");
  const [email, setEmail] = useState(mode === "login" ? "admin@aeris.local" : "operator@aeris.local");
  const [password, setPassword] = useState(mode === "login" ? "admin123" : "aeris-local-pass");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const isLogin = mode === "login";

  function validate() {
    const nextErrors: FormErrors = {};
    if (!isLogin && name.trim().length < 2) {
      nextErrors.name = "Enter a name with at least 2 characters.";
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      nextErrors.email = "Enter a valid email address.";
    }
    if (password.length < 8) {
      nextErrors.password = "Password must be at least 8 characters.";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setErrors({});
    try {
      await checkBackendHealth();
      const result = isLogin ? await login(email.trim(), password) : await register(name.trim(), email.trim(), password);
      saveToken(result.access_token);
      const next = searchParams.get("next");
      router.push(isSafeInternalPath(next) ? next : "/dashboard");
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : "Authentication failed." });
    } finally {
      setLoading(false);
    }
  }

  function useDefaultCredentials() {
    setEmail("admin@aeris.local");
    setPassword("admin123");
    setErrors({});
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <AppBackground />

      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-4 py-5 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/35 bg-primary text-slate-950 shadow-[0_0_30px_hsl(var(--primary)/0.24)]">
            <Radar size={21} />
          </div>
          <div>
            <div className="font-semibold">AERIS-Sim AI</div>
            <div className="text-xs text-muted-foreground">Local mission console</div>
          </div>
        </Link>
        <ThemeToggle />
      </header>

      <section className="relative z-10 mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl items-center gap-8 px-4 pb-10 lg:grid-cols-[1.04fr_0.96fr] lg:px-8">
        <MissionGraphic />

        <div className="w-full animate-[auth-slide-in_420ms_ease-out_both]">
          <PremiumCard className="mx-auto w-full max-w-md p-6 md:p-7">
            <div className="mb-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-primary/35 bg-primary text-slate-950 shadow-[0_0_30px_hsl(var(--primary)/0.24)]">
                <LockKeyhole size={23} />
              </div>
              <h1 className="text-2xl font-semibold text-foreground">{isLogin ? "Operator Login" : "Create Local Account"}</h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {isLogin
                  ? "Access the radar digital twin dashboard with your local development credentials."
                  : "Create an analyst account for local-only simulation workflows."}
              </p>
            </div>

            <button
              type="button"
              onClick={useDefaultCredentials}
              className="mb-5 w-full rounded-lg border border-primary/25 bg-primary/10 p-3 text-left text-sm transition hover:border-primary/45 hover:bg-primary/15"
            >
              <div className="flex items-center gap-2 font-medium text-foreground">
                <ShieldCheck size={16} className="text-primary" />
                Default credentials
              </div>
              <div className="mt-1 text-muted-foreground">admin@aeris.local / admin123</div>
            </button>

            <form className="space-y-4" onSubmit={submit} noValidate>
              {!isLogin && (
                <Field label="Name" error={errors.name}>
                  <Input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    type="text"
                    autoComplete="name"
                    placeholder="AERIS Analyst"
                    aria-invalid={Boolean(errors.name)}
                  />
                </Field>
              )}

              <Field label="Email" error={errors.email}>
                <Input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  autoComplete="email"
                  placeholder="admin@aeris.local"
                  aria-invalid={Boolean(errors.email)}
                />
              </Field>

              <Field label="Password" error={errors.password}>
                <div className="relative">
                  <Input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    type={showPassword ? "text" : "password"}
                    autoComplete={isLogin ? "current-password" : "new-password"}
                    placeholder="Enter password"
                    className="pr-11"
                    aria-invalid={Boolean(errors.password)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </Field>

              {errors.form && (
                <div className="flex gap-2 rounded-md border border-danger/35 bg-danger/10 p-3 text-sm text-danger">
                  <AlertCircle className="mt-0.5 shrink-0" size={16} />
                  <span>{errors.form}</span>
                </div>
              )}

              <PremiumButton className="w-full" type="submit" disabled={loading}>
                {loading ? "Authenticating..." : isLogin ? "Login" : "Register"}
                <ArrowRight size={18} />
              </PremiumButton>
            </form>

            <div className="mt-5 text-center text-sm text-muted-foreground">
              {isLogin ? "Need a local account?" : "Already have an account?"}{" "}
              <Link className="font-medium text-primary hover:underline" href={isLogin ? "/register" : "/login"}>
                {isLogin ? "Register" : "Login"}
              </Link>
            </div>
          </PremiumCard>
        </div>
      </section>
    </main>
  );
}

function isSafeInternalPath(path: string | null): path is string {
  return Boolean(path && path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/login") && !path.startsWith("/register"));
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-foreground">{label}</span>
      {children}
      {error && <span className="mt-2 block text-xs text-danger">{error}</span>}
    </label>
  );
}

function MissionGraphic() {
  const contacts = [
    ["left-[58%] top-[28%]", "Drone", "bg-danger"],
    ["left-[36%] top-[58%]", "Vehicle", "bg-emerald-400"],
    ["left-[70%] top-[66%]", "Unknown", "bg-amber-400"]
  ];

  return (
    <div className="hidden animate-[auth-slide-in-left_480ms_ease-out_both] lg:block">
      <PremiumCard className="relative min-h-[560px] overflow-hidden p-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_48%_44%,hsl(var(--primary)/0.22),transparent_20rem)]" />
        <div className="relative flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Mission Graphic</div>
            <h2 className="mt-2 text-3xl font-semibold text-foreground">Local radar command access</h2>
          </div>
          <StatusBadge tone="online">Secure local token</StatusBadge>
        </div>

        <div className="relative mx-auto mt-8 aspect-square max-w-[420px] rounded-full border border-primary/30 bg-muted/20">
          <div className="absolute inset-[9%] rounded-full border border-border" />
          <div className="absolute inset-[24%] rounded-full border border-border" />
          <div className="absolute inset-[39%] rounded-full border border-border" />
          <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-border" />
          <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-border" />
          <div className="radar-sweep absolute inset-0 rounded-full" />
          <div className="absolute inset-[48%] rounded-full bg-primary shadow-[0_0_28px_hsl(var(--primary)/0.7)]" />
          {contacts.map(([position, label, tone]) => (
            <div key={label} className={cn("absolute", position)}>
              <div className={cn("h-3 w-3 rounded-full", tone)} />
              <div className="mt-2 rounded-md border border-border bg-panel/90 px-2 py-1 text-xs text-foreground">
                {label}
              </div>
            </div>
          ))}
        </div>

        <div className="relative mt-7 grid grid-cols-3 gap-3">
          {[
            ["Auth", "JWT"],
            ["Mode", "Local"],
            ["Replay", "Ready"]
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-border bg-muted/35 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                <ScanLine size={14} />
                {label}
              </div>
              <div className="mt-2 text-xl font-semibold text-foreground">{value}</div>
            </div>
          ))}
        </div>
      </PremiumCard>
    </div>
  );
}
