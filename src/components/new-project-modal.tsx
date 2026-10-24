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
import {
  EXPERIENCE_LEVEL_LABELS,
  type ExperienceLevel,
  type Project,
} from "@/lib/db/types";
import { cn } from "@/lib/utils";

const EXPERIENCE_OPTIONS = Object.entries(EXPERIENCE_LEVEL_LABELS) as [
  ExperienceLevel,
  string,
][];

export type NewProjectModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (project: Project) => void;
};

export function NewProjectModal({
  open,
  onOpenChange,
  onCreated,
}: NewProjectModalProps) {
  const [name, setName] = useState("");
  const [interest, setInterest] = useState("");
  const [experienceLevel, setExperienceLevel] =
    useState<ExperienceLevel>("brand_new");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setName("");
      setInterest("");
      setExperienceLevel("brand_new");
      setError(null);
      setIsSubmitting(false);
    }
  }, [open]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, interest, experienceLevel }),
      });
      const body = (await response.json()) as {
        project?: Project;
        error?: string;
      };
      if (!response.ok || !body.project) {
        throw new Error(body.error ?? "Could not create project.");
      }
      onCreated(body.project);
      onOpenChange(false);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not create project.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Start a research project</DialogTitle>
          <DialogDescription>
            MVP covers Orient and Find your question only. The coach will not
            write the paper.
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <label className="text-sm font-medium leading-none" htmlFor="project-name">
              Project name
            </label>
            <Input
              id="project-name"
              name="name"
              placeholder="e.g. Sparse routing for on-device models"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium leading-none" htmlFor="topic-area">
              Broad interest / topic area
            </label>
            <Input
              id="topic-area"
              name="interest"
              placeholder="e.g. efficient transformers for education apps"
              value={interest}
              onChange={(event) => setInterest(event.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="grid gap-2">
            <label
              className="text-sm font-medium leading-none"
              htmlFor="experience-level"
            >
              How much do you already know about this topic?
            </label>
            <select
              id="experience-level"
              name="experienceLevel"
              className={cn(
                "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
              value={experienceLevel}
              onChange={(event) =>
                setExperienceLevel(event.target.value as ExperienceLevel)
              }
              disabled={isSubmitting}
            >
              {EXPERIENCE_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating…" : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
