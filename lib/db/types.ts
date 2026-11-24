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

export const MILESTONES = [
  "orient_foundations",
  "orient_check",
  "broad_ideation",
  "literature_discussion",
  "gap_analysis",
  "question_formulation",
  "conflict_refinement",
] as const;
export type MilestoneId = (typeof MILESTONES)[number];

export const MILESTONE_STATUSES = [
  "not_started",
  "in_progress",
  "complete",
] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

export type Milestones = Record<MilestoneId, MilestoneStatus>;

export const MILESTONE_LABELS: Record<MilestoneId, string> = {
  orient_foundations: "Orient: foundations of the topic",
  orient_check: "Orient: pass the comprehension check",
  broad_ideation: "Broad ideation of possible questions",
  literature_discussion: "Discuss saved literature",
  gap_analysis: "Gap analysis against saved papers",
  question_formulation: "Formulate one research question",
  conflict_refinement: "Refine against conflicting evidence",
};

export const MILESTONE_PHASE: Record<MilestoneId, PhaseId> = {
  orient_foundations: "orient",
  orient_check: "orient",
  broad_ideation: "find_question",
  literature_discussion: "find_question",
  gap_analysis: "find_question",
  question_formulation: "find_question",
  conflict_refinement: "find_question",
};

/**
 * Milestones only the server may set (from a passed `orient_checks` row).
 * Coach patches and student PATCHes cannot change them.
 */
export const SERVER_OWNED_MILESTONES: readonly MilestoneId[] = ["orient_check"];

export function emptyMilestones(): Milestones {
  return Object.fromEntries(
    MILESTONES.map((id) => [id, "not_started"]),
  ) as Milestones;
}

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
  milestones: Milestones;
  /** Takeaways in the student's own words (never written by the coach). */
  studentTakeaways: string[];
  identifiedGaps: string[];
  conflictingEvidenceNotes: string[];
};

/** Project Brain: the `projects.state` jsonb column. */
export type ProjectBrain = ProjectState;

export const PAPER_STANCES = [
  "supporting",
  "conflicting",
  "foundational",
  "neutral",
] as const;
export type PaperStance = (typeof PAPER_STANCES)[number];

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
  stance: PaperStance;
  doi: string | null;
  publicationYear: number | null;
  openAccessUrl: string | null;
  createdAt: string;
};

export type OrientCheckQuestion = {
  id: string;
  prompt: string;
  /** What a passing answer must show; used by the grader, never sent to the client. */
  rubric: string;
  /** Optional nudge shown to the student (never the answer). */
  hint?: string;
  /** "subject": tests the topic's subject matter; "project": tests their plan. */
  kind?: "subject" | "project";
};

export type OrientCheckAnswer = {
  questionId: string;
  answer: string;
};

export type OrientCheck = {
  id: string;
  projectId: string;
  userId: string;
  topic: string;
  questions: OrientCheckQuestion[];
  studentAnswers: OrientCheckAnswer[];
  /** 0–100. */
  score: number;
  passed: boolean;
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
    milestones: emptyMilestones(),
    studentTakeaways: [],
    identifiedGaps: [],
    conflictingEvidenceNotes: [],
  };
}
