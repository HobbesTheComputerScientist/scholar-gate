"use client";

import { useEffect, useState, type ReactNode } from "react";

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

  useEffect(() => {
    setInterest(project.state.interest);
    setBackground(project.state.background);
    setExperienceLevel(project.state.experienceLevel);
    setConstraints(project.state.constraints.join("\n"));
    setCandidates(project.state.candidateQuestions.map((q) => q.text).join("\n"));
    setChosenQuestion(project.state.chosenQuestion ?? "");
    setNoveltyClaim(project.state.noveltyClaim ?? "");
  }, [project]);

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
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Pending patches</h2>
        <PatchReview
          patches={patches}
          busyId={busyPatchId}
          onResolve={onResolvePatch}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Project Brain</h2>
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

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Literature</h2>
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
    <label className="grid gap-1 text-xs font-medium">
      {label}
      {children}
    </label>
  );
}
