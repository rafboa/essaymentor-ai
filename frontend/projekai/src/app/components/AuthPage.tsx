"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthForm } from "./AuthForm";
import { safeNext, useAuth } from "../contexts/AuthContext";

function AuthPageInner({ mode }: { mode: "login" | "register" }) {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) router.replace(next ?? "/dashboard");
  }, [user, isLoading, next, router]);

  return (
    <div className="mx-auto grid max-w-[1440px] px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_28rem_minmax(0,1fr)] lg:px-8 lg:py-24">
      <div className="lg:col-start-2">
        <AuthForm initialMode={mode} redirectTo={next ?? "/dashboard"} next={next} />
      </div>
    </div>
  );
}

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  return (
    <Suspense fallback={<div className="min-h-[60vh]" />}>
      <AuthPageInner mode={mode} />
    </Suspense>
  );
}
