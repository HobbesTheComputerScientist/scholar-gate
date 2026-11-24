"use client";

import { useState } from "react";
import { Check, Lock, Unlock } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  MILESTONES,
  MILESTONE_PHASE,
  PHASE_LABELS,
  type MilestoneId,
  type PhaseId,
  type Project,
} from "@/lib/db/types";
import type { Paper } from "@/lib/db/types";
import {
  evaluateFindQuestionGates,
  evaluateOrientGates,
  isInterestSpecific,
  type GateCheck,
} from "@/lib/phases/gates";
import { currentMilestone } from "@/lib/phases/milestones";
import { OrientCheckDialog } from "@/src/components/orient-check-dialog";
import { cn } from "@/lib/utils";

const ORDER: PhaseId[] = ["orient", "find_question"];

export function PhaseStepper({
  project,
  papers,
  decisionCount,
  onAdvance,
  advancing,
  onCheckPassed,
}: {
  project: Project;
  papers: Paper[];
  decisionCount: number;
  onAdvance: () => void;
  advancing: boolean;
  onCheckPassed: () => void;
}) {
  const [checkOpen, setCheckOpen] = useState(false);
  const checkPassed = project.state.milestones.orient_check === "complete";
  const canTakeCheck = isInterestSpecific(project.state.interest);
  const orient = evaluateOrientGates(project.state);
  const find = evaluateFindQuestionGates(project.state, papers, decisionCount);
  const activeChecks =
    project.state.phase === "orient" ? orient : find;

  const phase2Unlocked = project.state.phase === "find_question";
  const active = currentMilestone(project.state);

  return (
    <div className="flex h-full flex-col gap-6">
      <ol className="relative space-y-1" aria-label="Phases and milestones">
        {ORDER.map((phase, index) => {
          const unlocked = phase === "orient" || phase2Unlocked;
          const current = project.state.phase === phase;
          const completed = phase === "orient" && phase2Unlocked;
          const milestones = MILESTONES.filter(
            (id) => MILESTONE_PHASE[id] === phase,
          );
          const doneCount = milestones.filter(
            (id) => project.state.milestones[id] === "complete",
          ).length;
          return (
            <li key={phase}>
              <div
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-3 py-2.5",
                  current
                    ? "border-sky-400/40 bg-sky-400/10 shadow-[0_0_0_1px_rgba(56,189,248,0.15)]"
                    : completed
                      ? "border-indigo-500/30 bg-indigo-500/10"
                      : "border-slate-800 bg-slate-900/60",
                )}
              >
                <div
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    current && "bg-sky-400 text-slate-950",
                    completed && "bg-indigo-500 text-white",
                    !unlocked && "border border-slate-700 bg-slate-900 text-slate-500",
                  )}
                >
                  {!unlocked ? (
                    <Lock className="size-3.5" aria-hidden />
                  ) : completed ? (
                    <Check className="size-4" aria-hidden />
                  ) : (
                    index + 1
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      !unlocked && "text-slate-500",
                    )}
                  >
                    {PHASE_LABELS[phase]}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {!unlocked
                      ? "Locked until Phase 1 gates pass"
                      : `${doneCount}/${milestones.length} milestones`}
                  </p>
                </div>
              </div>

              <ul className="ml-[1.6rem] space-y-0.5 border-l border-slate-800 py-2 pl-4">
                {milestones.map((id) => {
                  const status: MilestoneView = !unlocked
                    ? "locked"
                    : project.state.milestones[id] === "complete"
                      ? "completed"
                      : current && id === active
                        ? "active"
                        : "pending";
                  return (
                    <MilestoneRow
                      key={id}
                      label={MILESTONE_SHORT_LABELS[id]}
                      status={status}
                    />
                  );
                })}
              </ul>

              {index === 0 ? (
                <div
                  className={cn(
                    "my-1 ml-[1.6rem] flex items-center gap-2 pl-4 text-[11px] font-medium uppercase tracking-wide",
                    phase2Unlocked ? "text-indigo-300" : "text-slate-500",
                  )}
                >
                  {phase2Unlocked ? (
                    <Unlock className="size-3" aria-hidden />
                  ) : (
                    <Lock className="size-3" aria-hidden />
                  )}
                  Phase gate {phase2Unlocked ? "passed" : "closed"}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          {project.state.phase === "orient" ? "Gate to Phase 2" : "Phase 2 exit criteria"}
        </p>
        <ul className="space-y-1.5">
          {activeChecks.map((check) => (
            <GateRow key={check.id} check={check} />
          ))}
        </ul>
      </div>

      {project.state.phase === "orient" ? (
        <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
          <p className="text-xs font-medium">Comprehension check</p>
          <p className="text-xs text-slate-400">
            {checkPassed
              ? "Passed. You can retake it any time."
              : canTakeCheck
                ? "Explain your topic in your own words to unlock Phase 2."
                : "Set a specific topic in the Project Brain first."}
          </p>
          <Button
            type="button"
            size="sm"
            variant={checkPassed ? "outline" : "default"}
            className="w-full"
            disabled={!canTakeCheck}
            onClick={() => setCheckOpen(true)}
          >
            {checkPassed ? "Retake check" : "Take the check"}
          </Button>
          <OrientCheckDialog
            projectId={project.id}
            open={checkOpen}
            onOpenChange={setCheckOpen}
            onPassed={onCheckPassed}
          />
        </div>
      ) : null}

      {project.state.phase === "orient" ? (
        <Button
          type="button"
          size="sm"
          className="bg-indigo-500 text-white hover:bg-indigo-400 disabled:bg-slate-800 disabled:text-slate-400 disabled:opacity-100"
          disabled={advancing || orient.some((check) => !check.passed)}
          onClick={onAdvance}
        >
          {orient.some((check) => !check.passed) ? (
            <Lock aria-hidden />
          ) : (
            <Unlock aria-hidden />
          )}
          {advancing ? "Checking…" : "Enter Phase 2"}
        </Button>
      ) : find.every((check) => check.passed) ? (
        <p className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-xs text-indigo-100">
          Phase 2 complete. You have a defensible research question.
        </p>
      ) : (
        <p className="text-xs text-slate-400">
          Save papers and accept a decision patch to finish Phase 2.
        </p>
      )}
    </div>
  );
}

type MilestoneView = "locked" | "pending" | "active" | "completed";

/** Labels without the "Orient:" prefix; the phase heading already says it. */
const MILESTONE_SHORT_LABELS: Record<MilestoneId, string> = {
  orient_foundations: "Foundations of the topic",
  orient_check: "Pass the comprehension check",
  broad_ideation: "Broad ideation",
  literature_discussion: "Discuss saved literature",
  gap_analysis: "Gap analysis",
  question_formulation: "Formulate one question",
  conflict_refinement: "Refine against counter-evidence",
};

function MilestoneRow({
  label,
  status,
}: {
  label: string;
  status: MilestoneView;
}) {
  return (
    <li
      className={cn(
        "relative flex items-center gap-2.5 rounded-md px-2 py-1.5 text-xs",
        status === "active" && "bg-sky-400/10 text-sky-100",
        status === "completed" && "text-slate-200",
        status === "pending" && "text-slate-400",
        status === "locked" && "text-slate-600",
      )}
      aria-current={status === "active" ? "step" : undefined}
    >
      <span
        className={cn(
          "absolute -left-[1.4rem] flex size-3.5 items-center justify-center rounded-full",
          status === "completed" && "bg-indigo-500 text-white",
          status === "active" &&
            "bg-sky-400 ring-4 ring-sky-400/20",
          status === "pending" && "border-2 border-slate-500 bg-slate-900",
          status === "locked" && "border border-slate-800 bg-slate-950",
        )}
        aria-hidden
      >
        {status === "completed" ? <Check className="size-2.5" strokeWidth={3} /> : null}
      </span>
      <span className="flex-1">{label}</span>
      {status === "locked" ? (
        <Lock className="size-3 text-slate-600" aria-label="Locked" />
      ) : status === "active" ? (
        <span className="rounded-full bg-sky-400/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-300">
          Now
        </span>
      ) : status === "completed" ? (
        <span className="sr-only">Completed</span>
      ) : null}
    </li>
  );
}

function GateRow({ check }: { check: GateCheck }) {
  return (
    <li className="flex items-start gap-2 text-xs">
      <span
        className={cn(
          "mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-sm border",
          check.passed
            ? "border-indigo-500 bg-indigo-500 text-white"
            : "border-slate-600",
        )}
        aria-hidden
      >
        {check.passed ? <Check className="size-2.5" strokeWidth={3} /> : null}
      </span>
      <span className={check.passed ? "text-slate-200" : "text-slate-400"}>
        {check.label}
      </span>
    </li>
  );
}
