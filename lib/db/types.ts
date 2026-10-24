export const EXPERIENCE_LEVELS = [
  "brand_new",
  "some_familiarity",
  "intermediate",
  "advanced",
] as const;

export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

export const EXPERIENCE_LEVEL_LABELS: Record<ExperienceLevel, string> = {
  brand_new: "I'm brand new to this topic",
  some_familiarity: "I know a little, but need structure",
  intermediate: "I'm comfortable with the basics",
  advanced: "I have strong subject-matter background",
};

export const PHASES = ["orient", "find_question"] as const;
export type PhaseId = (typeof PHASES)[number];

export const PHASE_LABELS: Record<PhaseId, string> = {
  orient: "Phase 1: Orient",
  find_question: "Phase 2: Find your question",
};

export type CandidateQuestion = {
  id: string;
  text: string;
  notes: string;
};

export type ProjectState = {
  phase: PhaseId;
  interest: string;
  background: string;
  experienceLevel: ExperienceLevel;
  constraints: string[];
  candidateQuestions: CandidateQuestion[];
  chosenQuestion: string | null;
  noveltyClaim: string | null;
  openQuestions: string[];
};

export type Profile = {
  id: string;
  email: string | null;
  displayName: string | null;
  createdAt: string;
};

export type Project = {
  id: string;
  userId: string;
  name: string;
  state: ProjectState;
  createdAt: string;
  updatedAt: string;
};

export type Paper = {
  id: string;
  userId: string;
  projectId: string;
  source: "semantic_scholar" | "openalex" | "arxiv";
  externalId: string;
  title: string;
  authors: string[];
  year: number | null;
  abstract: string | null;
  url: string | null;
  citationCount: number | null;
  createdAt: string;
};

export type Decision = {
  id: string;
  userId: string;
  projectId: string;
  summary: string;
  rationale: string | null;
  createdAt: string;
};

export type ChatMessage = {
  id: string;
  userId: string;
  projectId: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
};

export type Summary = {
  id: string;
  userId: string;
  projectId: string;
  content: string;
  messageCountAt: number;
  createdAt: string;
};

export const PATCH_TOOLS = [
  "update_state",
  "add_paper",
  "log_decision",
] as const;
export type PatchTool = (typeof PATCH_TOOLS)[number];

export type ProposedPatch = {
  id: string;
  userId: string;
  projectId: string;
  tool: PatchTool;
  payload: Record<string, unknown>;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
};

export function emptyProjectState(
  experienceLevel: ExperienceLevel = "brand_new",
): ProjectState {
  return {
    phase: "orient",
    interest: "",
    background: "",
    experienceLevel,
    constraints: [],
    candidateQuestions: [],
    chosenQuestion: null,
    noveltyClaim: null,
    openQuestions: [],
  };
}
