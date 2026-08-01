export type ExperienceLevel =
  | "brand_new"
  | "some_familiarity"
  | "intermediate"
  | "advanced";

export const EXPERIENCE_LEVEL_LABELS: Record<ExperienceLevel, string> = {
  brand_new: "I'm brand new to this topic",
  some_familiarity: "I know a little, but need structure",
  intermediate: "I'm comfortable with the basics",
  advanced: "I have strong subject-matter background",
};

export type StageId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type ResearchStageDefinition = {
  id: StageId;
  shortTitle: string;
  title: string;
  description: string;
};

export const RESEARCH_STAGES: readonly ResearchStageDefinition[] = [
  {
    id: 1,
    shortTitle: "Discovery",
    title: "Stage 1: Discovery",
    description:
      "Help user find specific research ideas and narrow a promising direction.",
  },
  {
    id: 2,
    shortTitle: "Context",
    title: "Stage 2: Context & Subject-Matter Knowledge",
    description:
      "Teaches background info and includes a 75%+ quiz gate to unlock Stage 3.",
  },
  {
    id: 3,
    shortTitle: "Lit foundation",
    title: "Stage 3: Lit Review Foundational",
    description: "Reads broad foundational papers to anchor your literature base.",
  },
  {
    id: 4,
    shortTitle: "Subject lit",
    title: "Stage 4: Subject Matter Literature",
    description:
      "Explores specific subject literature tied to your research question.",
  },
  {
    id: 5,
    shortTitle: "Direction",
    title: "Stage 5: Direction Finalizing",
    description:
      "Finalizes outline, methodology, and experiment plans before drafting.",
  },
  {
    id: 6,
    shortTitle: "Initial draft",
    title: "Stage 6: Initial Drafting",
    description:
      "Drafts Introduction, Related Work, and Methods from your finalized plan.",
  },
  {
    id: 7,
    shortTitle: "Outreach",
    title: "Stage 7: Outreach",
    description:
      "Helps modify experiments and reach out to professors for feedback.",
  },
  {
    id: 8,
    shortTitle: "Full draft",
    title: "Stage 8: Full Draft",
    description:
      "Drafts the paper while executing experiments and discussing results.",
  },
  {
    id: 9,
    shortTitle: "Refinement",
    title: "Stage 9: Refinement & Publication Goal",
    description:
      "Refines the paper, sets publication goals, and connects with professors.",
  },
  {
    id: 10,
    shortTitle: "Submission",
    title: "Stage 10: Final Review & Submission Prep",
    description:
      "Final review checklist and submission preparation for your target venue.",
  },
] as const;

export const STAGE2_QUIZ_PASS_THRESHOLD = 75;

export type ResearchProject = {
  id: string;
  name: string;
  topicArea: string;
  experienceLevel: ExperienceLevel;
  createdAt: string;
  completedStageIds: StageId[];
  currentStageId: StageId;
  /** Mock knowledge-check score for Stage 2 (null until attempted). */
  stage2QuizScore: number | null;
};

/** @deprecated Use ResearchProject for new UI. */
export type Item = ResearchProject;

export type CreateResearchProjectInput = {
  name: string;
  topicArea: string;
  experienceLevel: ExperienceLevel;
};

const MOCK_DELAY_MS = 600;

const seedProject: ResearchProject = {
  id: "demo-project-1",
  name: "Adaptive tutoring with LLMs",
  topicArea: "AI in education and human-computer interaction",
  experienceLevel: "some_familiarity",
  createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
  completedStageIds: [],
  currentStageId: 1,
  stage2QuizScore: null,
};

let projects: ResearchProject[] = [seedProject];

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function findProjectIndex(projectId: string) {
  return projects.findIndex((project) => project.id === projectId);
}

export function isStageUnlocked(
  project: ResearchProject,
  stageId: StageId,
): boolean {
  if (stageId === 1) {
    return true;
  }
  const previousStage = (stageId - 1) as StageId;
  return project.completedStageIds.includes(previousStage);
}

export function getStageProgress(project: ResearchProject) {
  return {
    completedCount: project.completedStageIds.length,
    total: RESEARCH_STAGES.length,
    percent: (project.completedStageIds.length / RESEARCH_STAGES.length) * 100,
  };
}

export function hasPassedStage2Quiz(project: ResearchProject) {
  return (
    project.stage2QuizScore !== null &&
    project.stage2QuizScore >= STAGE2_QUIZ_PASS_THRESHOLD
  );
}

export async function fetchResearchProjects(): Promise<ResearchProject[]> {
  await delay(MOCK_DELAY_MS);
  return [...projects].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export async function fetchResearchProjectById(
  projectId: string,
): Promise<ResearchProject | null> {
  await delay(MOCK_DELAY_MS / 2);
  return projects.find((project) => project.id === projectId) ?? null;
}

export async function createResearchProject(
  input: CreateResearchProjectInput,
): Promise<ResearchProject> {
  await delay(MOCK_DELAY_MS);

  const name = input.name.trim();
  const topicArea = input.topicArea.trim();

  if (!name) {
    throw new Error("Project name is required.");
  }
  if (!topicArea) {
    throw new Error("Broad interest / topic area is required.");
  }

  const project: ResearchProject = {
    id: crypto.randomUUID(),
    name,
    topicArea,
    experienceLevel: input.experienceLevel,
    createdAt: new Date().toISOString(),
    completedStageIds: [],
    currentStageId: 1,
    stage2QuizScore: null,
  };

  projects = [project, ...projects];
  return project;
}

export async function submitStage2Quiz(
  projectId: string,
  score: number,
): Promise<ResearchProject> {
  await delay(MOCK_DELAY_MS);

  const index = findProjectIndex(projectId);
  if (index === -1) {
    throw new Error("Project not found.");
  }

  if (score < 0 || score > 100) {
    throw new Error("Quiz score must be between 0 and 100.");
  }

  const updated: ResearchProject = {
    ...projects[index],
    stage2QuizScore: score,
  };

  projects[index] = updated;
  return updated;
}

export async function completeResearchStage(
  projectId: string,
  stageId: StageId,
): Promise<ResearchProject> {
  await delay(MOCK_DELAY_MS);

  const index = findProjectIndex(projectId);
  if (index === -1) {
    throw new Error("Project not found.");
  }

  const project = projects[index];

  if (!isStageUnlocked(project, stageId)) {
    throw new Error("Complete the previous stage before marking this one done.");
  }

  if (project.completedStageIds.includes(stageId)) {
    return project;
  }

  if (stageId === 2 && !hasPassedStage2Quiz(project)) {
    throw new Error(
      `Pass the Stage 2 knowledge check with at least ${STAGE2_QUIZ_PASS_THRESHOLD}% before continuing.`,
    );
  }

  const completedStageIds = [...project.completedStageIds, stageId].sort(
    (a, b) => a - b,
  );

  const nextStage = RESEARCH_STAGES.find(
    (stage) => !completedStageIds.includes(stage.id),
  );

  const updated: ResearchProject = {
    ...project,
    completedStageIds,
    currentStageId: nextStage?.id ?? 10,
  };

  projects[index] = updated;
  return updated;
}

export async function deleteResearchProject(projectId: string): Promise<void> {
  await delay(MOCK_DELAY_MS / 2);
  projects = projects.filter((project) => project.id !== projectId);
}
