"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { safeRedirectPath } from "@/lib/utils";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Mode = "login" | "signup";

const COPY: Record<
  Mode,
  {
    title: string;
    submit: string;
    togglePrompt: string;
    toggleLabel: string;
    toggleHref: string;
  }
> = {
  login: {
    title: "Sign in",
    submit: "Sign in",
    togglePrompt: "Don't have an account?",
    toggleLabel: "Sign up",
    toggleHref: "/signup",
  },
  signup: {
    title: "Create your account",
    submit: "Create account",
    togglePrompt: "Already have an account?",
    toggleLabel: "Sign in",
    toggleHref: "/login",
  },
};

/** Password field with a show/hide (eye) toggle. */
function PasswordInput({
  id,
  label,
  value,
  onChange,
  autoComplete,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  disabled?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          name={id}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          required
          minLength={6}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="••••••••"
          disabled={disabled}
          className="pr-10"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          tabIndex={-1}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-brand-slate transition-colors hover:text-brand-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export function AuthForm({
  mode,
  redirectTo,
  initialEmail,
}: {
  mode: Mode;
  redirectTo?: string;
  initialEmail?: string;
}) {
  const router = useRouter();
  const copy = COPY[mode];

  const [email, setEmail] = useState(initialEmail ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);

  const destination = safeRedirectPath(redirectTo);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const supabase = createClient();

    try {
      if (mode === "login") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) {
          setError(signInError.message);
          return;
        }
        router.push(destination);
        router.refresh();
        return;
      }

      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${location.origin}/auth/callback`,
        },
      });
      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      if (data.session) {
        router.push("/");
        router.refresh();
        return;
      }

      setConfirmSent(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmSent) {
    return (
      <Card className="w-full">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-green/15 text-brand-green">
            <MailCheck className="h-6 w-6" aria-hidden="true" />
          </span>
          <h2 className="text-lg font-semibold text-brand-charcoal">
            Check your email
          </h2>
          <p className="max-w-xs text-sm text-brand-slate">
            We sent a confirmation link to{" "}
            <span className="font-medium text-brand-charcoal">{email}</span>.
            Click it to confirm your account, then sign in.
          </p>
          <Link href="/login" className="mt-2 text-sm font-medium text-brand-blue hover:underline">
            Back to sign in
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <p className="eyebrow">{mode === "login" ? "Welcome back" : "Get started"}</p>
        <CardTitle className="mt-1">{copy.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <OAuthButtons redirectTo={destination} />

        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-line" />
          <span className="text-xs font-medium uppercase tracking-wide text-brand-slate">
            or
          </span>
          <span className="h-px flex-1 bg-line" />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {error ? (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {error}
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={submitting}
            />
          </div>

          <PasswordInput
            id="password"
            label="Password"
            value={password}
            onChange={setPassword}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            disabled={submitting}
          />

          {mode === "signup" ? (
            <PasswordInput
              id="confirm-password"
              label="Confirm password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              autoComplete="new-password"
              disabled={submitting}
            />
          ) : null}

          <Button type="submit" disabled={submitting} className="mt-1 w-full">
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Please wait…</span>
              </>
            ) : (
              copy.submit
            )}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-brand-slate">
          {copy.togglePrompt}{" "}
          <Link
            href={copy.toggleHref}
            className="font-medium text-brand-blue hover:underline"
          >
            {copy.toggleLabel}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
