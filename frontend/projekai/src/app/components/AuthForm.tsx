"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { apiPost, ApiError } from "../lib/api";
import { useAuth, type User } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";

type Mode = "login" | "register";

interface AuthFormProps {
  initialMode: Mode;
  /** null = stay on the page (inline); undefined = default destination. */
  redirectTo?: string | null;
  onSuccess?: () => void;
  /** Lets the inline panel switch modes in place instead of navigating. */
  inline?: boolean;
  headingLevel?: "h1" | "h2";
  notice?: string | null;
  /** Carried across the login/register switch on the standalone pages. */
  next?: string | null;
}

export function AuthForm({ initialMode, redirectTo, onSuccess, inline, headingLevel = "h1", notice, next }: AuthFormProps) {
  const { t } = useLanguage();
  const { login } = useAuth();
  const ids = useId();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isRegister = mode === "register";
  const Heading = headingLevel;

  const submit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const body = isRegister ? { fullName, email, password } : { email, password };
      const data = await apiPost<{ access_token: string; user: User }>(
        isRegister ? "/auth/register" : "/auth/login",
        body,
      );
      login(data.access_token, data.user, { redirectTo });
      onSuccess?.();
    } catch (err) {
      if (err instanceof ApiError && err.status > 0 && err.message && err.status !== 401) {
        setError(err.message);
      } else if (err instanceof ApiError && err.status === 401) {
        setError(t.auth.failedLogin);
      } else if (err instanceof TypeError) {
        setError(t.evaluator.errors.network);
      } else {
        setError(isRegister ? t.auth.failedRegister : t.auth.failedLogin);
      }
    } finally {
      setBusy(false);
    }
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
  };

  const switchLink = (target: Mode, label: string) =>
    inline ? (
      <button type="button" onClick={() => switchMode(target)} className="font-semibold text-ink underline">
        {label}
      </button>
    ) : (
      <Link
        href={{ pathname: target === "login" ? "/login" : "/register", query: next ? { next } : undefined }}
        className="font-semibold text-ink underline"
      >
        {label}
      </Link>
    );

  return (
    <div>
      <Heading className="font-display text-[2rem] font-extrabold uppercase leading-none tracking-tight [font-variation-settings:'opsz'_72]">
        {inline ? t.auth.inlineTitle : isRegister ? t.auth.registerTitle : t.auth.loginTitle}
      </Heading>
      <p className="mt-3 text-sm text-ink-2">
        {inline ? t.auth.inlineSub : isRegister ? t.auth.registerSub : t.auth.loginSub}
      </p>

      {notice && (
        <p role="status" className="mt-5 border-l-2 border-rule-strong pl-3 text-sm text-ink">
          {notice}
        </p>
      )}

      {inline && (
        <div role="group" aria-label={t.auth.loginTitle} className="mt-6 grid grid-cols-2 border-b border-rule">
          {(["login", "register"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => switchMode(m)}
              className={`-mb-px min-h-11 border-b-2 text-sm font-semibold ${
                mode === m ? "border-rule-strong text-ink" : "border-transparent text-ink-3 hover:text-ink"
              }`}
            >
              {m === "login" ? t.auth.login : t.auth.register}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={submit} className="mt-6 flex flex-col gap-4" noValidate={false}>
        {isRegister && (
          <div>
            <label htmlFor={`${ids}-name`} className="mb-1.5 block text-sm font-medium">
              {t.auth.fullName}
            </label>
            <input
              id={`${ids}-name`}
              className="field"
              type="text"
              autoComplete="name"
              required
              minLength={2}
              maxLength={100}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
        )}
        <div>
          <label htmlFor={`${ids}-email`} className="mb-1.5 block text-sm font-medium">
            {t.auth.email}
          </label>
          <input
            id={`${ids}-email`}
            className="field"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor={`${ids}-password`} className="mb-1.5 block text-sm font-medium">
            {t.auth.password}
          </label>
          <input
            id={`${ids}-password`}
            className="field"
            type="password"
            autoComplete={isRegister ? "new-password" : "current-password"}
            required
            minLength={isRegister ? 8 : undefined}
            maxLength={64}
            aria-describedby={isRegister ? `${ids}-rule` : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {isRegister && (
            <p id={`${ids}-rule`} className="mt-1.5 text-xs text-ink-2">
              {t.auth.passwordRule}
            </p>
          )}
        </div>

        {error && (
          <p role="alert" className="text-sm font-medium text-mark-critical">
            {error}
          </p>
        )}

        <button type="submit" disabled={busy} aria-busy={busy} className="btn btn-primary mt-2 min-h-11 w-full">
          {busy ? t.auth.working : isRegister ? t.auth.register : t.auth.login}
        </button>
      </form>

      {!inline && (
        <p className="mt-6 text-sm text-ink-2">
          {isRegister ? t.auth.toLogin : t.auth.toRegister}{" "}
          {switchLink(isRegister ? "login" : "register", isRegister ? t.auth.toLoginLink : t.auth.toRegisterLink)}
        </p>
      )}
    </div>
  );
}
