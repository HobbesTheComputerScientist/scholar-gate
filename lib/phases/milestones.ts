import {
  MILESTONES,
  MILESTONE_PHASE,
  type MilestoneId,
  type ProjectState,
} from "@/lib/db/types";

/** Milestones for the student's current phase, in order. */
export function milestonesForPhase(state: ProjectState): MilestoneId[] {
  return MILESTONES.filter((id) => MILESTONE_PHASE[id] === state.phase);
}

/** First milestone in the current phase that is not complete, or null. */
export function currentMilestone(state: ProjectState): MilestoneId | null {
  return (
    milestonesForPhase(state).find(
      (id) => state.milestones[id] !== "complete",
    ) ?? null
  );
}
