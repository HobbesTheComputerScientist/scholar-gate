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

const MOCK_AUTH_DELAY_MS = 800;

export type AuthMode = "signIn" | "signUp";

export type AuthSuccessPayload = {
  email: string;
  mode: AuthMode;
};

export type AuthModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAuthSuccess: (payload: AuthSuccessPayload) => void;
  defaultMode?: AuthMode;
};

export function AuthModal({
  open,
  onOpenChange,
  onAuthSuccess,
  defaultMode = "signIn",
}: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>(defaultMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setMode(defaultMode);
    }
  }, [open, defaultMode]);

  function resetForm() {
    setEmail("");
    setPassword("");
    setIsSubmitting(false);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      resetForm();
    }
    onOpenChange(nextOpen);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    const credentials = { email: email.trim(), password };

    if (mode === "signIn") {
      // TODO: Replace with supabase.auth.signInWithPassword()
    } else {
      // TODO: Replace with supabase.auth.signUp()
    }

    console.log({ mode, ...credentials });

    window.setTimeout(() => {
      onAuthSuccess({ email: credentials.email, mode });
      resetForm();
      onOpenChange(false);
    }, MOCK_AUTH_DELAY_MS);
  }

  const isSignIn = mode === "signIn";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isSignIn ? "Sign in" : "Create account"}</DialogTitle>
          <DialogDescription>
            {isSignIn
              ? "Enter your email and password to access Scholar Gate."
              : "Register with email and password to get started."}
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
