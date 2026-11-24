import { z } from "zod";

import { PAPER_SEARCH_MODES } from "@/lib/papers/openalex";

import {
  EXPERIENCE_LEVELS,
  MILESTONES,
  MILESTONE_STATUSES,
  PAPER_STANCES,
  PATCH_TOOLS,
  PHASES,
  SERVER_OWNED_MILESTONES,
  emptyMilestones,
  emptyProjectState,
  type Milestones,
  type ProjectState,
} from "@/lib/db/types";

export const experienceLevelSchema = z.enum(EXPERIENCE_LEVELS);
export const phaseSchema = z.enum(PHASES);

export const candidateQuestionSchema = z.object({
  id: z.string().min(1),
  text: z.string(),
  notes: z.string(),
});

export const milestoneIdSchema = z.enum(MILESTONES);
export const milestoneStatusSchema = z.enum(MILESTONE_STATUSES);
export const paperStanceSchema = z.enum(PAPER_STANCES);

/** Missing keys (older Brain rows) default to not_started. */
const milestonesSchema = z
  .record(z.string(), z.unknown())
  .default({})
  .transform((raw): Milestones => {
    const base = emptyMilestones();
    for (const id of MILESTONES) {
      const parsed = milestoneStatusSchema.safeParse(raw[id]);
      if (parsed.success) base[id] = parsed.data;
    }
    return base;
  });

const stringList = z.array(z.string());

/**
 * Fields added after launch use `.default` so Brain rows written before the
 * upgrade still parse instead of falling back to an empty Brain.
 */
export const projectStateSchema = z.object({
  phase: phaseSchema,
  interest: z.string(),
  background: z.string(),
  experienceLevel: experienceLevelSchema,
  constraints: stringList,
  candidateQuestions: z.array(candidateQuestionSchema),
  chosenQuestion: z.string().nullable(),
  noveltyClaim: z.string().nullable(),
  openQuestions: stringList,
  milestones: milestonesSchema,
  studentTakeaways: stringList.default([]),
  identifiedGaps: stringList.default([]),
  conflictingEvidenceNotes: stringList.default([]),
}) satisfies z.ZodType<ProjectState, unknown>;

/** Milestone updates the coach or student may propose (not server-owned ones). */
export const milestonesPatchSchema = z
  .partialRecord(milestoneIdSchema, milestoneStatusSchema)
  .refine(
    (value) => SERVER_OWNED_MILESTONES.every((id) => !(id in value)),
    {
      message:
        "orient_check is set only by passing the comprehension check.",
    },
  );

export const updateStatePayloadSchema = z
  .object({
    interest: z.string().optional(),
    background: z.string().optional(),
    experienceLevel: experienceLevelSchema.optional(),
    constraints: stringList.optional(),
    candidateQuestions: z.array(candidateQuestionSchema).optional(),
    chosenQuestion: z.string().nullable().optional(),
    noveltyClaim: z.string().nullable().optional(),
    openQuestions: stringList.optional(),
    milestones: milestonesPatchSchema.optional(),
    studentTakeaways: stringList.optional(),
    identifiedGaps: stringList.optional(),
    conflictingEvidenceNotes: stringList.optional(),
  })
  .strict();

export const addPaperPayloadSchema = z
  .object({
    source: z.enum(["semantic_scholar", "openalex", "arxiv"]),
    externalId: z.string().min(1),
    title: z.string().min(1),
    authors: z.array(z.string()).default([]),
    year: z.number().int().nullable().optional(),
    abstract: z.string().nullable().optional(),
    url: z.string().nullable().optional(),
    citationCount: z.number().int().nullable().optional(),
    stance: paperStanceSchema.default("neutral"),
    doi: z.string().nullable().optional(),
    publicationYear: z.number().int().nullable().optional(),
    openAccessUrl: z.string().nullable().optional(),
  })
  .strict();

export const logDecisionPayloadSchema = z
  .object({
    summary: z.string().min(1),
    rationale: z.string().nullable().optional(),
  })
  .strict();

export const proposedPatchPayloadSchema = z.discriminatedUnion("tool", [
  z.object({
    tool: z.literal("update_state"),
    payload: updateStatePayloadSchema,
  }),
  z.object({
    tool: z.literal("add_paper"),
    payload: addPaperPayloadSchema,
  }),
  z.object({
    tool: z.literal("log_decision"),
    payload: logDecisionPayloadSchema,
  }),
]);

export const createProjectInputSchema = z.object({
  name: z.string().trim().min(1, "Project name is required."),
  interest: z.string().trim().min(1, "Topic area is required."),
  experienceLevel: experienceLevelSchema,
});

export const authInputSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(6),
});

export const chatInputSchema = z.object({
  projectId: z.string().uuid(),
  message: z.string().trim().min(1).max(8000),
});

export const paperSearchInputSchema = z.object({
  query: z.string().trim().min(2).max(300),
  limit: z.number().int().min(1).max(20).optional(),
  mode: z.enum(PAPER_SEARCH_MODES).default("general"),
});

export const savePaperInputSchema = addPaperPayloadSchema.extend({
  projectId: z.string().uuid(),
});

export const updatePaperStanceInputSchema = z.object({
  stance: paperStanceSchema,
});

export const orientCheckQuestionSchema = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1),
  rubric: z.string(),
});

export const orientCheckAnswerSchema = z.object({
  questionId: z.string().min(1),
  answer: z.string().max(4000),
});

export const orientCheckSubmitSchema = z.object({
  checkId: z.string().min(1),
  answers: z.array(orientCheckAnswerSchema).min(1).max(20),
});

export const patchActionSchema = z.object({
  action: z.enum(["accepted", "rejected"]),
});

export const projectStatePatchSchema = updateStatePayloadSchema;

export function parseProjectState(value: unknown): ProjectState {
  const parsed = projectStateSchema.safeParse(value);
  if (parsed.success) {
    return parsed.data;
  }
  return emptyProjectState();
}

export function validateToolOutput(tool: string, payload: unknown) {
  if (!PATCH_TOOLS.includes(tool as (typeof PATCH_TOOLS)[number])) {
    throw new Error(`Unknown tool: ${tool}`);
  }
  return proposedPatchPayloadSchema.parse({ tool, payload });
}
