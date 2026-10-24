"use client";

import { Check, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PHASE_LABELS, type PhaseId, type Project } from "@/lib/db/types";
import type { Paper } from "@/lib/db/types";
import {
  evaluateFindQuestionGates,
  evaluateOrientGates,
  type GateCheck,
} from "@/lib/phases/gates";
import { cn } from "@/lib/utils";

const ORDER: PhaseId[] = ["orient", "find_question"];

export function PhaseStepper({
  project,
  papers,
  decisionCount,
  onAdvance,
  advancing,
}: {
  project: Project;
  papers: Paper[];
  decisionCount: number;
  onAdvance: () => void;
  advancing: boolean;
}) {
  const orient = evaluateOrientGates(project.state);
  const find = evaluateFindQuestionGates(project.state, papers, decisionCount);
  const activeChecks =
    project.state.phase === "orient" ? orient : find;

  return (
    <div className="flex h-full flex-col gap-6">
      <ol className="space-y-3">
        {ORDER.map((phase, index) => {
          const unlocked =
            phase === "orient" || project.state.phase === "find_question";
          const current = project.state.phase === phase;
          const completed =
            phase === "orient" && project.state.phase === "find_question";
          return (
            <li key={phase} className="flex gap-3">
              <div
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold",
                  current &&
                    "border-primary bg-primary text-primary-foreground",
                  completed &&
                    "border-primary/50 bg-primary/10 text-primary",
                  !unlocked &&
                    "border-muted-foreground/30 bg-muted text-muted-foreground",
                )}
              >
                {!unlocked ? (
                  <Lock className="size-3.5" aria-hidden />
                ) : completed ? (
                  <Check className="size-3.5" aria-hidden />
                ) : (
                  index + 1
                )}
              </div>
              <div>
                <p className="text-sm font-medium">{PHASE_LABELS[phase]}</p>
                <p className="text-xs text-muted-foreground">
                  {phase === "orient"
                    ? "Topic, background, constraints, candidates"
                    : "Question, novelty, papers, decision"}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Exit criteria
        </p>
        <ul className="space-y-1.5">
          {activeChecks.map((check) => (
            <GateRow key={check.id} check={check} />
          ))}
        </ul>
      </div>

      {project.state.phase === "orient" ? (
        <Button
          type="button"
          size="sm"
          disabled={advancing || orient.some((check) => !check.passed)}
          onClick={onAdvance}
        >
          {advancing ? "Checking…" : "Enter Phase 2"}
        </Button>
      ) : find.every((check) => check.passed) ? (
        <p className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
          Phase 2 exit criteria met. MVP stops here — no drafting or
          experiments yet.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Save papers and accept a decision patch to finish Phase 2.
        </p>
      )}
    </div>
  );
}

function GateRow({ check }: { check: GateCheck }) {
  return (
    <li className="flex items-start gap-2 text-xs">
      <span
        className={cn(
          "mt-0.5 size-3.5 shrink-0 rounded-sm border",
          check.passed
            ? "border-primary bg-primary"
            : "border-muted-foreground/40",
        )}
        aria-hidden
      />
      <span className={check.passed ? "text-foreground" : "text-muted-foreground"}>
        {check.label}
      </span>
    </li>
  );
}
