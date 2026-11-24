import { addPaperPayloadSchema, logDecisionPayloadSchema, updateStatePayloadSchema } from "@/lib/db/schema";
import type { DbRepo } from "@/lib/db/repo";
import type { Project, ProjectState, ProposedPatch } from "@/lib/db/types";

export function applyStatePatch(
  current: ProjectState,
  payload: unknown,
): ProjectState {
  const { milestones, ...patch } = updateStatePayloadSchema.parse(payload);
  return {
    ...current,
    ...patch,
    // Partial merge; server-owned milestones are rejected by the schema.
    milestones: { ...current.milestones, ...milestones },
    phase: current.phase,
  };
}

export async function applyAcceptedPatch(
  repo: DbRepo,
  userId: string,
  project: Project,
  patch: ProposedPatch,
): Promise<Project> {
  if (patch.tool === "update_state") {
    const nextState = applyStatePatch(project.state, patch.payload);
    return repo.updateProjectState(userId, project.id, nextState);
  }

  if (patch.tool === "add_paper") {
    const paper = addPaperPayloadSchema.parse(patch.payload);
    const existing = await repo.listPapers(userId, project.id);
    const duplicate = existing.find(
      (row) =>
        row.source === paper.source && row.externalId === paper.externalId,
    );
    if (!duplicate) {
      await repo.insertPaper({
        userId,
        projectId: project.id,
        source: paper.source,
        externalId: paper.externalId,
        title: paper.title,
        authors: paper.authors,
        year: paper.year ?? null,
        abstract: paper.abstract ?? null,
        url: paper.url ?? null,
        citationCount: paper.citationCount ?? null,
        stance: paper.stance,
        doi: paper.doi ?? null,
        publicationYear: paper.publicationYear ?? paper.year ?? null,
        openAccessUrl: paper.openAccessUrl ?? null,
      });
    }
    return project;
  }

  const decision = logDecisionPayloadSchema.parse(patch.payload);
  await repo.insertDecision({
    userId,
    projectId: project.id,
    summary: decision.summary,
    rationale: decision.rationale ?? null,
  });
  return project;
}
