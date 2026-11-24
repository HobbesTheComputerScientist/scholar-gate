"use client";

import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PaperSearch } from "@/src/components/paper-search";
import { PatchReview } from "@/src/components/patch-review";
import {
  EXPERIENCE_LEVEL_LABELS,
  type ExperienceLevel,
  type Paper,
  type Project,
  type ProjectState,
  type ProposedPatch,
} from "@/lib/db/types";

export function ProjectBrain({
  project,
  papers,
  patches,
  latestSummary,
  busyPatchId,
  onSaveState,
  onResolvePatch,
  onPaperSaved,
}: {
  project: Project;
  papers: Paper[];
  patches: ProposedPatch[];
  latestSummary: string | null;
  busyPatchId: string | null;
  onSaveState: (patch: Partial<ProjectState>) => Promise<void>;
  onResolvePatch: (id: string, action: "accepted" | "rejected") => void;
  onPaperSaved: (paper: Paper) => void;
}) {
  const [interest, setInterest] = useState(project.state.interest);
  const [background, setBackground] = useState(project.state.background);
  const [experienceLevel, setExperienceLevel] = useState(
    project.state.experienceLevel,
  );
  const [constraints, setConstraints] = useState(
    project.state.constraints.join("\n"),
  );
  const [candidates, setCandidates] = useState(
    project.state.candidateQuestions.map((q) => q.text).join("\n"),
  );
  const [chosenQuestion, setChosenQuestion] = useState(
    project.state.chosenQuestion ?? "",
  );
  const [noveltyClaim, setNoveltyClaim] = useState(
    project.state.noveltyClaim ?? "",
  );
  const [saving, setSaving] = useState(false);

  const [syncedProject, setSyncedProject] = useState(project);

  // Re-sync the form when a fresh project arrives (e.g. after accepting a
  // patch). Adjusting state during render avoids an extra effect pass.
  if (project !== syncedProject) {
    setSyncedProject(project);
    setInterest(project.state.interest);
    setBackground(project.state.background);
    setExperienceLevel(project.state.experienceLevel);
    setConstraints(project.state.constraints.join("\n"));
    setCandidates(project.state.candidateQuestions.map((q) => q.text).join("\n"));
    setChosenQuestion(project.state.chosenQuestion ?? "");
    setNoveltyClaim(project.state.noveltyClaim ?? "");
  }

  async function save() {
    setSaving(true);
    try {
      await onSaveState({
        interest,
        background,
        experienceLevel,
        constraints: constraints
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
        candidateQuestions: candidates
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .map((text, index) => ({
            id: project.state.candidateQuestions[index]?.id ?? `q-${index + 1}`,
            text,
            notes: project.state.candidateQuestions[index]?.notes ?? "",
          })),
        chosenQuestion: chosenQuestion.trim() ? chosenQuestion : null,
        noveltyClaim: noveltyClaim.trim() ? noveltyClaim : null,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto pr-1">
      <section
        className={
          patches.length > 0
            ? "space-y-2 rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-2.5"
            : "space-y-2"
        }
        aria-label="Pending patches"
      >
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          Needs your review
          {patches.length > 0 ? (
            <span className="relative flex size-5 items-center justify-center rounded-full bg-indigo-500 text-[11px] font-bold text-white">
              <span className="absolute inset-0 animate-ping rounded-full bg-indigo-500/50" aria-hidden />
              <span className="relative">{patches.length}</span>
            </span>
          ) : null}
        </h2>
        <PatchReview
          patches={patches}
          busyId={busyPatchId}
          onResolve={onResolvePatch}
        />
      </section>

      <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
        <h2 className="text-sm font-semibold text-sky-300">Project Brain</h2>
        <Field label="Interest">
          <Textarea
            value={interest}
            onChange={(event) => setInterest(event.target.value)}
            rows={2}
          />
        </Field>
        <Field label="Background">
          <Textarea
            value={background}
            onChange={(event) => setBackground(event.target.value)}
            rows={3}
          />
        </Field>
        <Field label="Experience">
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={experienceLevel}
            onChange={(event) =>
              setExperienceLevel(event.target.value as ExperienceLevel)
            }
          >
            {(
              Object.entries(EXPERIENCE_LEVEL_LABELS) as [
                ExperienceLevel,
                string,
              ][]
            ).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Constraints (one per line)">
          <Textarea
            value={constraints}
            onChange={(event) => setConstraints(event.target.value)}
            rows={3}
          />
        </Field>
        <Field label="Candidate questions (one per line)">
          <Textarea
            value={candidates}
            onChange={(event) => setCandidates(event.target.value)}
            rows={4}
          />
        </Field>
        <Field label="Chosen question">
          <Input
            value={chosenQuestion}
            onChange={(event) => setChosenQuestion(event.target.value)}
          />
        </Field>
        <Field label="Novelty / gap claim">
          <Textarea
            value={noveltyClaim}
            onChange={(event) => setNoveltyClaim(event.target.value)}
            rows={3}
          />
        </Field>
        <Button type="button" size="sm" onClick={() => void save()} disabled={saving}>
          {saving ? "Saving…" : "Save Brain"}
        </Button>
      </section>

      <section className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
        <h2 className="text-sm font-semibold text-sky-300">Literature</h2>
        <PaperSearch
          projectId={project.id}
          papers={papers}
          onSaved={onPaperSaved}
        />
      </section>

      {latestSummary ? (
        <section className="space-y-1">
          <h2 className="text-sm font-semibold">Latest rolling summary</h2>
          <p className="whitespace-pre-wrap rounded-md border bg-muted/30 p-2 text-[11px] text-muted-foreground">
            {latestSummary}
          </p>
        </section>
      ) : null}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1 text-xs font-medium text-slate-300">
      {label}
      {children}
    </label>
  );
}
