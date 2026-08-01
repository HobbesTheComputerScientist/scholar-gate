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
  type CreateResearchProjectInput,
  type ExperienceLevel,
} from "@/lib/api-placeholder";
import { cn } from "@/lib/utils";

const EXPERIENCE_OPTIONS = Object.entries(EXPERIENCE_LEVEL_LABELS) as [
  ExperienceLevel,
  string,
][];

export type NewProjectModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateProject: (input: CreateResearchProjectInput) => Promise<void>;
};

export function NewProjectModal({
  open,
  onOpenChange,
  onCreateProject,
}: NewProjectModalProps) {
  const [name, setName] = useState("");
  const [topicArea, setTopicArea] = useState("");
  const [experienceLevel, setExperienceLevel] =
    useState<ExperienceLevel>("brand_new");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setName("");
      setTopicArea("");
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
      await onCreateProject({ name, topicArea, experienceLevel });
      onOpenChange(false);
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Could not create project.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Start new project</DialogTitle>
          <DialogDescription>
            Scholar Gate will guide you from discovery through submission using
            ten structured milestones. Share a name, topic area, and how familiar
            you already are with the subject.
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
              placeholder="e.g. Efficient routing in sparse networks"
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
              name="topicArea"
              placeholder="e.g. graph algorithms, climate modeling, HCI for education"
              value={topicArea}
              onChange={(event) => setTopicArea(event.target.value)}
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
