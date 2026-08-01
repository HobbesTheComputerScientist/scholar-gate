"use client";

import { Check, Lock } from "lucide-react";

import {
  RESEARCH_STAGES,
  getStageProgress,
  isStageUnlocked,
  type ResearchProject,
  type StageId,
} from "@/lib/api-placeholder";
import { cn } from "@/lib/utils";

export type MilestoneTrackerProps = {
  project: ResearchProject;
  selectedStageId: StageId;
  onSelectStage: (stageId: StageId) => void;
};

export function MilestoneTracker({
  project,
  selectedStageId,
  onSelectStage,
}: MilestoneTrackerProps) {
  const { completedCount, total, percent } = getStageProgress(project);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="font-medium">10-stage research journey</span>
          <span className="shrink-0 text-muted-foreground">
            {completedCount} / {total} complete
          </span>
        </div>
        <div
          className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={Math.round(percent)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Overall milestone progress"
        >
          <div
            className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <div className="overflow-x-auto pb-2">
        <ol className="flex min-w-max list-none items-start gap-0 p-0 m-0">
          {RESEARCH_STAGES.map((stage, index) => {
            const unlocked = isStageUnlocked(project, stage.id);
            const completed = project.completedStageIds.includes(stage.id);
            const selected = selectedStageId === stage.id;
            const locked = !unlocked;
            const isLast = index === RESEARCH_STAGES.length - 1;

            return (
              <li
                key={stage.id}
                className="flex min-w-[5.5rem] max-w-[6.5rem] flex-1 flex-col items-center sm:min-w-[6rem]"
              >
                <div className="flex w-full items-center">
                  {index > 0 ? (
                    <div
                      className={cn(
                        "h-0.5 flex-1 transition-colors",
                        project.completedStageIds.includes(
                          (stage.id - 1) as StageId,
                        )
                          ? "bg-primary"
                          : "bg-border",
                      )}
                      aria-hidden
                    />
                  ) : (
                    <div className="flex-1" aria-hidden />
                  )}

                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => onSelectStage(stage.id)}
                    title={stage.description}
                    aria-label={`${stage.title}${locked ? " (locked)" : ""}${completed ? " (complete)" : ""}`}
                    aria-current={selected ? "step" : undefined}
                    className={cn(
                      "relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-all sm:size-11 sm:text-sm",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      locked &&
                        "cursor-not-allowed border-muted-foreground/30 bg-muted text-muted-foreground",
                      !locked &&
                        !selected &&
                        !completed &&
                        "border-border bg-background hover:border-primary/60 hover:bg-accent",
                      !locked &&
                        selected &&
                        "scale-105 border-primary bg-primary text-primary-foreground shadow-md ring-4 ring-primary/15",
                      !locked &&
                        completed &&
                        !selected &&
                        "border-primary/50 bg-primary/10 text-primary",
                    )}
                  >
                    {locked ? (
                      <Lock className="size-3.5 sm:size-4" aria-hidden />
                    ) : completed ? (
                      <Check className="size-3.5 sm:size-4" aria-hidden />
                    ) : (
                      stage.id
                    )}
                  </button>

                  {!isLast ? (
                    <div
                      className={cn(
                        "h-0.5 flex-1 transition-colors",
                        completed ? "bg-primary" : "bg-border",
                      )}
                      aria-hidden
                    />
                  ) : (
                    <div className="flex-1" aria-hidden />
                  )}
                </div>

                <div className="mt-2 px-1 text-center">
                  <p
                    className={cn(
                      "text-[10px] font-medium leading-tight sm:text-xs",
                      locked ? "text-muted-foreground" : "text-foreground",
                    )}
                  >
                    {stage.shortTitle}
                  </p>
                  <p className="mt-0.5 hidden text-[10px] leading-snug text-muted-foreground lg:block">
                    {stage.title.replace(/^Stage \d+: /, "")}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
