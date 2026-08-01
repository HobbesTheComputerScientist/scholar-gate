"use client";

import {
  ArrowLeft,
  BookOpen,
  FlaskConical,
  GraduationCap,
  Lock,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ItemList } from "@/src/components/item-list";
import { MilestoneTracker } from "@/src/components/milestone-tracker";
import { NewProjectModal } from "@/src/components/new-project-modal";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  EXPERIENCE_LEVEL_LABELS,
  RESEARCH_STAGES,
  STAGE2_QUIZ_PASS_THRESHOLD,
  completeResearchStage,
  createResearchProject,
  deleteResearchProject,
  fetchResearchProjectById,
  fetchResearchProjects,
  getStageProgress,
  hasPassedStage2Quiz,
  isStageUnlocked,
  submitStage2Quiz,
  type CreateResearchProjectInput,
  type ResearchProject,
  type StageId,
} from "@/lib/api-placeholder";

const JOURNEY_HIGHLIGHTS = [
  {
    icon: BookOpen,
    title: "Structured discovery",
    body: "Move from a broad interest to a focused research question with AI-guided prompts.",
  },
  {
    icon: FlaskConical,
    title: "Literature to methods",
    body: "Build foundational and subject-specific reading lists before you draft.",
  },
  {
    icon: GraduationCap,
    title: "Submission-ready",
    body: "Outreach, refinement, and final review milestones prepare you for publication goals.",
  },
] as const;

function ProjectListSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <Card key={index} className="animate-pulse">
          <CardHeader className="space-y-3">
            <div className="h-5 w-2/3 rounded bg-muted" />
            <div className="h-4 w-full rounded bg-muted" />
          </CardHeader>
          <CardContent>
            <div className="h-1.5 w-full rounded bg-muted" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<ResearchProject[]>([]);
  const [activeProject, setActiveProject] = useState<ResearchProject | null>(
    null,
  );
  const [selectedStageId, setSelectedStageId] = useState<StageId>(1);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [isRefreshingProject, setIsRefreshingProject] = useState(false);
  const [isCompletingStage, setIsCompletingStage] = useState(false);
  const [isSubmittingQuiz, setIsSubmittingQuiz] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    setIsLoadingProjects(true);
    setLoadError(null);

    try {
      // TODO: Connect Real Backend Here
      const data = await fetchResearchProjects();
      setProjects(data);
    } catch {
      setLoadError("Could not load your research projects. Please try again.");
    } finally {
      setIsLoadingProjects(false);
    }
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const selectedStage = useMemo(
    () => RESEARCH_STAGES.find((stage) => stage.id === selectedStageId),
    [selectedStageId],
  );

  const activeProgress = activeProject
    ? getStageProgress(activeProject)
    : null;

  function syncProjectInLists(updated: ResearchProject) {
    setActiveProject(updated);
    setProjects((current) =>
      current.map((project) => (project.id === updated.id ? updated : project)),
    );
  }

  async function handleCreateProject(input: CreateResearchProjectInput) {
    // TODO: Connect Real Backend Here
    const created = await createResearchProject(input);
    setProjects((current) => [created, ...current]);
    setActiveProject(created);
    setSelectedStageId(1);
  }

  async function openProject(projectId: string) {
    setWorkspaceError(null);
    setIsRefreshingProject(true);

    try {
      // TODO: Connect Real Backend Here
      const project = await fetchResearchProjectById(projectId);
      if (!project) {
        setWorkspaceError("That project could not be found.");
        return;
      }
      setActiveProject(project);
      setSelectedStageId(project.currentStageId);
    } catch {
      setWorkspaceError("Could not open this project workspace.");
    } finally {
      setIsRefreshingProject(false);
    }
  }

  function exitWorkspace() {
    setActiveProject(null);
    setSelectedStageId(1);
    setWorkspaceError(null);
  }

  async function handleCompleteStage() {
    if (!activeProject || !selectedStage) {
      return;
    }

    setIsCompletingStage(true);
    setWorkspaceError(null);

    try {
      // TODO: Connect Real Backend Here
      const updated = await completeResearchStage(
        activeProject.id,
        selectedStage.id,
      );
      syncProjectInLists(updated);

      const next = RESEARCH_STAGES.find(
        (stage) => !updated.completedStageIds.includes(stage.id),
      );
      if (next) {
        setSelectedStageId(next.id);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not update this stage.";
      setWorkspaceError(message);
    } finally {
      setIsCompletingStage(false);
    }
  }

  async function handleStage2QuizDemo(passed: boolean) {
    if (!activeProject) {
      return;
    }

    setIsSubmittingQuiz(true);
    setWorkspaceError(null);

    try {
      // TODO: Connect Real Backend Here
      const score = passed ? 82 : 68;
      const updated = await submitStage2Quiz(activeProject.id, score);
      syncProjectInLists(updated);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not submit quiz score.";
      setWorkspaceError(message);
    } finally {
      setIsSubmittingQuiz(false);
    }
  }

  async function handleDeleteProject(projectId: string) {
    try {
      // TODO: Connect Real Backend Here
      await deleteResearchProject(projectId);
      setProjects((current) =>
        current.filter((project) => project.id !== projectId),
      );
      if (activeProject?.id === projectId) {
        exitWorkspace();
      }
    } catch {
      setLoadError("Could not delete that project.");
    }
  }

  const stageUnlocked =
    activeProject && selectedStage
      ? isStageUnlocked(activeProject, selectedStage.id)
      : false;
  const stageCompleted =
    activeProject && selectedStage
      ? activeProject.completedStageIds.includes(selectedStage.id)
      : false;

  if (activeProject) {
    return (
      <div className="min-h-full bg-muted/30">
        <header className="border-b bg-background">
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="-ml-2 mb-4 w-fit gap-2"
              onClick={exitWorkspace}
            >
              <ArrowLeft className="size-4" aria-hidden />
              All projects
            </Button>

            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                  Project workspace
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
                  {activeProject.name}
                </h1>
                <p className="mt-2 max-w-2xl text-muted-foreground">
                  {activeProject.topicArea}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {EXPERIENCE_LEVEL_LABELS[activeProject.experienceLevel]}
                </p>
              </div>

              {activeProgress ? (
                <div className="w-full max-w-xs space-y-2 rounded-lg border bg-muted/40 p-4">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">Overall progress</span>
                    <span className="text-muted-foreground">
                      {activeProgress.completedCount}/{activeProgress.total}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${activeProgress.percent}%` }}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Milestone navigation</CardTitle>
              <CardDescription>
                Stage 1: Discovery is unlocked by default. Stages 2–10 stay
                locked until the previous milestone is complete. Stage 2 requires
                a 75%+ knowledge check before you can advance to Stage 3.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MilestoneTracker
                project={activeProject}
                selectedStageId={selectedStageId}
                onSelectStage={setSelectedStageId}
              />
            </CardContent>
          </Card>

          {selectedStage ? (
            <Card>
              <CardHeader>
                <div className="flex items-start gap-3">
                  {!stageUnlocked ? (
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Lock className="size-4 text-muted-foreground" aria-hidden />
                    </div>
                  ) : (
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {selectedStage.id}
                    </div>
                  )}
                  <div>
                    <CardTitle>{selectedStage.title}</CardTitle>
                    <CardDescription className="mt-1.5">
                      {selectedStage.description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {!stageUnlocked ? (
                  <p className="rounded-lg border border-dashed bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                    This stage is locked. Complete the previous milestone to
                    unlock AI-guided tasks here.
                  </p>
                ) : stageCompleted ? (
                  <p className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
                    Milestone complete. Select the next stage bubble to continue
                    drafting your first research paper.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Scholar Gate will guide you through AI-assisted work for this
                    milestone. Use the preview controls below to simulate progress
                    until the real backend is connected.
                  </p>
                )}

                {selectedStage.id === 2 &&
                stageUnlocked &&
                !stageCompleted ? (
                  <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                    <p className="text-sm font-medium">
                      Stage 2 knowledge check (75%+ required)
                    </p>
                    {activeProject.stage2QuizScore === null ? (
                      <p className="text-sm text-muted-foreground">
                        Complete a short subject-matter quiz before marking
                        Stage 2 done and unlocking Lit Review Foundational.
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Latest score:{" "}
                        <span className="font-medium text-foreground">
                          {activeProject.stage2QuizScore}%
                        </span>
                        {hasPassedStage2Quiz(activeProject)
                          ? " — passed"
                          : ` — need ${STAGE2_QUIZ_PASS_THRESHOLD}%+ to continue`}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isSubmittingQuiz || isCompletingStage}
                        onClick={() => void handleStage2QuizDemo(false)}
                      >
                        Simulate quiz (68%)
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={isSubmittingQuiz || isCompletingStage}
                        onClick={() => void handleStage2QuizDemo(true)}
                      >
                        {isSubmittingQuiz
                          ? "Submitting…"
                          : "Simulate quiz (82% pass)"}
                      </Button>
                    </div>
                  </div>
                ) : null}

                {workspaceError ? (
                  <p className="text-sm text-destructive" role="alert">
                    {workspaceError}
                  </p>
                ) : null}

                {stageUnlocked && !stageCompleted ? (
                  <Button
                    type="button"
                    onClick={() => void handleCompleteStage()}
                    disabled={
                      isCompletingStage ||
                      isRefreshingProject ||
                      isSubmittingQuiz ||
                      (selectedStage.id === 2 &&
                        !hasPassedStage2Quiz(activeProject))
                    }
                  >
                    {isCompletingStage
                      ? "Saving progress…"
                      : `Mark "${selectedStage.shortTitle}" complete (demo)`}
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-center">
            <div className="flex flex-col gap-5">
              <p className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Sparkles className="size-3.5" aria-hidden />
                Scholar Gate · AI-guided research writing
              </p>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl lg:text-[2.5rem] lg:leading-tight">
                Want help drafting your first research paper?
              </h1>
              <p className="max-w-xl text-lg text-muted-foreground">
                Scholar Gate walks you from a broad interest to submission-ready
                work through a structured 10-stage milestone framework—discovery,
                literature, drafting, outreach, and refinement.
              </p>
              <div className="flex flex-wrap gap-3 pt-1">
                <Button
                  type="button"
                  size="lg"
                  onClick={() => setNewProjectOpen(true)}
                >
                  Start new project
                </Button>
                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  onClick={() => void loadProjects()}
                  disabled={isLoadingProjects}
                >
                  Refresh projects
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {JOURNEY_HIGHLIGHTS.map(({ icon: Icon, title, body }) => (
                <div
                  key={title}
                  className="rounded-xl border bg-card p-4 shadow-sm"
                >
                  <Icon
                    className="mb-2 size-5 text-primary"
                    aria-hidden
                  />
                  <p className="text-sm font-medium">{title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <section aria-labelledby="projects-heading" className="space-y-4">
          <div>
            <h2 id="projects-heading" className="text-lg font-semibold">
              Your research projects
            </h2>
            <p className="text-sm text-muted-foreground">
              {isLoadingProjects
                ? "Loading projects…"
                : projects.length === 0
                  ? "No projects yet—start one to unlock Stage 1: Discovery."
                  : `${projects.length} project${projects.length === 1 ? "" : "s"} in progress`}
            </p>
          </div>

          {loadError ? (
            <Card className="border-destructive/50">
              <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-destructive">{loadError}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void loadProjects()}
                >
                  Retry
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {isLoadingProjects ? (
            <ProjectListSkeleton />
          ) : projects.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  Your milestone journey begins with a project name, topic area,
                  and experience level.
                </p>
                <Button
                  type="button"
                  className="mt-4"
                  onClick={() => setNewProjectOpen(true)}
                >
                  Start new project
                </Button>
              </CardContent>
            </Card>
          ) : (
            <ItemList
              items={projects}
              onOpenProject={(id) => void openProject(id)}
              onDeleteProject={(id) => void handleDeleteProject(id)}
            />
          )}
        </section>
      </main>

      <NewProjectModal
        open={newProjectOpen}
        onOpenChange={setNewProjectOpen}
        onCreateProject={handleCreateProject}
      />
    </div>
  );
}
