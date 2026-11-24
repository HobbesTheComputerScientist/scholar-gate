"use client";

import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export type AuthMode = "signIn" | "signUp";

export type AuthModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAuthed: () => Promise<void> | void;
  defaultMode?: AuthMode;
};

export function AuthModal({
  open,
  onOpenChange,
  onAuthed,
  defaultMode = "signIn",
}: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>(defaultMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [wasOpen, setWasOpen] = useState(open);

  // Reset when the dialog opens (adjust state during render, not in an effect).
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setMode(defaultMode);
      setError(null);
      setNotice(null);
    }
  }

  function resetForm() {
    setEmail("");
    setPassword("");
    setIsSubmitting(false);
    setError(null);
    setNotice(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      resetForm();
    }
    onOpenChange(nextOpen);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          email: email.trim(),
          password,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        needsConfirmation?: boolean;
      };
      if (!response.ok) {
        throw new Error(body.error ?? "Could not authenticate.");
      }
      if (body.needsConfirmation) {
        setPassword("");
        setIsSubmitting(false);
        setMode("signIn");
        setNotice(
          `Check ${email.trim()} for a confirmation link. After you open it you'll be signed in here.`,
        );
        return;
      }
      resetForm();
      onOpenChange(false);
      await onAuthed();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not authenticate.",
      );
      setIsSubmitting(false);
    }
  }

  const isSignIn = mode === "signIn";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isSignIn ? "Sign in" : "Create account"}</DialogTitle>
          <DialogDescription>
            {isSignIn
              ? "Welcome back. Sign in to continue your projects."
              : "Create an account with your email and a password."}
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <label className="text-sm font-medium leading-none" htmlFor="auth-email">
              Email
            </label>
            <Input
              id="auth-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@school.edu"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>
          <div className="grid gap-2">
            <label
              className="text-sm font-medium leading-none"
              htmlFor="auth-password"
            >
              Password
            </label>
            <Input
              id="auth-password"
              name="password"
              type="password"
              autoComplete={isSignIn ? "current-password" : "new-password"}
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isSubmitting}
              required
              minLength={6}
            />
          </div>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p
              className="rounded-md border border-sky-400/30 bg-sky-400/10 px-3 py-2 text-sm text-sky-200"
              role="status"
            >
              {notice}
            </p>
          ) : null}

          <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting
                ? isSignIn
                  ? "Signing in…"
                  : "Creating account…"
                : isSignIn
                  ? "Sign in"
                  : "Sign up"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              disabled={isSubmitting}
              onClick={() => {
                setMode(isSignIn ? "signUp" : "signIn");
                setError(null);
                setNotice(null);
              }}
            >
              {isSignIn
                ? "Need an account? Sign up"
                : "Already have an account? Sign in"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
