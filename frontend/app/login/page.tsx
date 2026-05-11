import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";
import { LoadingPulse } from "@/components/ui/loading-pulse";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingPulse className="m-6" />}>
      <AuthForm mode="login" />
    </Suspense>
  );
}
