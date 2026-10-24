import { z } from "zod";

import {
  EXPERIENCE_LEVELS,
  PATCH_TOOLS,
  PHASES,
  emptyProjectState,
  type ProjectState,
} from "@/lib/db/types";

export const experienceLevelSchema = z.enum(EXPERIENCE_LEVELS);
export const phaseSchema = z.enum(PHASES);

export const candidateQuestionSchema = z.object({
  id: z.string().min(1),
  text: z.string(),
  notes: z.string(),
});

export const projectStateSchema: z.ZodType<ProjectState> = z.object({
  phase: phaseSchema,
  interest: z.string(),
  background: z.string(),
  experienceLevel: experienceLevelSchema,
  constraints: z.array(z.string()),
  candidateQuestions: z.array(candidateQuestionSchema),
  chosenQuestion: z.string().nullable(),
  noveltyClaim: z.string().nullable(),
  openQuestions: z.array(z.string()),
});

export const updateStatePayloadSchema = z
  .object({
    interest: z.string().optional(),
    background: z.string().optional(),
    experienceLevel: experienceLevelSchema.optional(),
    constraints: z.array(z.string()).optional(),
    candidateQuestions: z.array(candidateQuestionSchema).optional(),
    chosenQuestion: z.string().nullable().optional(),
    noveltyClaim: z.string().nullable().optional(),
    openQuestions: z.array(z.string()).optional(),
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
});

export const savePaperInputSchema = addPaperPayloadSchema.extend({
  projectId: z.string().uuid(),
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
