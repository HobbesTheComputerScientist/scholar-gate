import type {
  ChatMessage,
  Decision,
  OrientCheck,
  Paper,
  PaperStance,
  Profile,
  Project,
  ProjectState,
  ProposedPatch,
  Summary,
} from "@/lib/db/types";

export type NewPaper = Omit<Paper, "id" | "createdAt">;
export type NewDecision = Omit<Decision, "id" | "createdAt">;
export type NewMessage = Omit<ChatMessage, "id" | "createdAt">;
export type NewSummary = Omit<Summary, "id" | "createdAt">;
export type NewOrientCheck = Omit<OrientCheck, "id" | "createdAt">;
export type OrientCheckResult = Pick<
  OrientCheck,
  "studentAnswers" | "score" | "passed"
>;
export type NewPatch = Omit<ProposedPatch, "id" | "createdAt" | "status">;

export type DbRepo = {
  upsertProfile(profile: Omit<Profile, "createdAt"> & { createdAt?: string }): Promise<Profile>;
  getProfile(userId: string): Promise<Profile | null>;
  listProjects(userId: string): Promise<Project[]>;
  getProject(userId: string, projectId: string): Promise<Project | null>;
  createProject(input: {
    userId: string;
    name: string;
    state: ProjectState;
  }): Promise<Project>;
  updateProjectState(
    userId: string,
    projectId: string,
    state: ProjectState,
  ): Promise<Project>;
  deleteProject(userId: string, projectId: string): Promise<void>;
  listPapers(userId: string, projectId: string): Promise<Paper[]>;
  insertPaper(paper: NewPaper): Promise<Paper>;
  updatePaperStance(
    userId: string,
    paperId: string,
    stance: PaperStance,
  ): Promise<Paper>;
  /** Newest first. */
  listOrientChecks(userId: string, projectId: string): Promise<OrientCheck[]>;
  getOrientCheck(userId: string, checkId: string): Promise<OrientCheck | null>;
  insertOrientCheck(check: NewOrientCheck): Promise<OrientCheck>;
  gradeOrientCheck(
    userId: string,
    checkId: string,
    result: OrientCheckResult,
  ): Promise<OrientCheck>;
  listDecisions(userId: string, projectId: string): Promise<Decision[]>;
  insertDecision(decision: NewDecision): Promise<Decision>;
  listRecentMessages(
    userId: string,
    projectId: string,
    limit: number,
  ): Promise<ChatMessage[]>;
  insertMessage(message: NewMessage): Promise<ChatMessage>;
  countMessages(userId: string, projectId: string): Promise<number>;
  latestSummary(userId: string, projectId: string): Promise<Summary | null>;
  insertSummary(summary: NewSummary): Promise<Summary>;
  listPendingPatches(userId: string, projectId: string): Promise<ProposedPatch[]>;
  insertPatch(patch: NewPatch): Promise<ProposedPatch>;
  getPatch(userId: string, patchId: string): Promise<ProposedPatch | null>;
  setPatchStatus(
    userId: string,
    patchId: string,
    status: "accepted" | "rejected",
  ): Promise<ProposedPatch>;
};

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
