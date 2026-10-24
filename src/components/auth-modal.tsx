"use client";

import { FormEvent, useEffect, useState } from "react";

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

  useEffect(() => {
    if (open) {
      setMode(defaultMode);
      setError(null);
    }
  }, [open, defaultMode]);

  function resetForm() {
    setEmail("");
    setPassword("");
    setIsSubmitting(false);
    setError(null);
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
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "Could not authenticate.");
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
              ? "Sign in to keep Project Brain state across sessions."
              : "Register with email and password. Local demo accounts live in this server process until it restarts unless Supabase is configured."}
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
              onClick={() => setMode(isSignIn ? "signUp" : "signIn")}
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
