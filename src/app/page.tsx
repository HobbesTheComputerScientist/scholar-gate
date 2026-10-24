"use client";

import { BookOpen, Compass, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AuthModal } from "@/src/components/auth-modal";
import { ItemList } from "@/src/components/item-list";
import { NewProjectModal } from "@/src/components/new-project-modal";
import type { Project } from "@/lib/db/types";

type MeResponse = {
  user: { id: string; email: string | null; displayName: string | null } | null;
  persistence: "supabase" | "local";
};

const HIGHLIGHTS = [
  {
    icon: Compass,
    title: "Orient",
    body: "Turn a vague interest into constraints and candidate questions.",
  },
  {
    icon: BookOpen,
    title: "Find your question",
    body: "Ground a gap claim in papers you actually saved — never invented cites.",
  },
  {
    icon: Sparkles,
    title: "Project Brain",
    body: "Postgres state is memory. The coach proposes patches; you accept them.",
  },
] as const;

export default function DashboardPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);

  const loadMe = useCallback(async () => {
    const response = await fetch("/api/me");
    const body = (await response.json()) as MeResponse;
    setMe(body);
    return body;
  }, []);

  const loadProjects = useCallback(async () => {
    setIsLoadingProjects(true);
    setLoadError(null);
    try {
      const response = await fetch("/api/projects");
      const body = (await response.json()) as {
        projects?: Project[];
        error?: string;
      };
      if (response.status === 401) {
        setProjects([]);
        return;
      }
      if (!response.ok) {
        throw new Error(body.error ?? "Could not load projects.");
      }
      setProjects(body.projects ?? []);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Could not load projects.",
      );
    } finally {
      setIsLoadingProjects(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const current = await loadMe();
      if (current.user) {
        await loadProjects();
      }
    })();
  }, [loadMe, loadProjects]);

  async function handleAuthed() {
    await loadMe();
    await loadProjects();
  }

  async function handleSignOut() {
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "signOut" }),
    });
    setMe({ user: null, persistence: me?.persistence ?? "local" });
    setProjects([]);
  }

  async function handleDelete(projectId: string) {
    await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
    setProjects((current) => current.filter((project) => project.id !== projectId));
  }

  return (
    <div className="min-h-full bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold">Research Coach</p>
          <div className="flex items-center gap-2">
            {me?.user ? (
              <>
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  {me.user.email} · {me.persistence}
                </span>
                <Button type="button" size="sm" variant="outline" onClick={() => void handleSignOut()}>
                  Sign out
                </Button>
              </>
            ) : (
              <Button type="button" size="sm" onClick={() => setAuthOpen(true)}>
                Sign in
              </Button>
            )}
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-12 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-center">
            <div className="flex flex-col gap-5">
              <p className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Sparkles className="size-3.5" aria-hidden />
                Phase 1–2 MVP · AI never loses project context
              </p>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Start an AI/ML research question, not a ghostwritten paper.
              </h1>
              <p className="max-w-xl text-lg text-muted-foreground">
                Structured Project Brain in Postgres is the source of truth.
                Prompts are assembled from it. You accept or reject every state
                change.
              </p>
              <div className="flex flex-wrap gap-3 pt-1">
                <Button
                  type="button"
                  size="lg"
                  onClick={() =>
                    me?.user ? setNewProjectOpen(true) : setAuthOpen(true)
                  }
                >
                  Start new project
                </Button>
                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  onClick={() => void loadProjects()}
                  disabled={!me?.user || isLoadingProjects}
                >
                  Refresh projects
                </Button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {HIGHLIGHTS.map(({ icon: Icon, title, body }) => (
                <div key={title} className="rounded-xl border bg-card p-4 shadow-sm">
                  <Icon className="mb-2 size-5 text-primary" aria-hidden />
                  <p className="text-sm font-medium">{title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Your research projects</h2>
            <p className="text-sm text-muted-foreground">
              {!me?.user
                ? "Sign in to create a project."
                : isLoadingProjects
                  ? "Loading projects…"
                  : projects.length === 0
                    ? "No projects yet — start one to enter Orient."
                    : `${projects.length} project${projects.length === 1 ? "" : "s"}`}
            </p>
          </div>

          {loadError ? (
            <Card className="border-destructive/50">
              <CardContent className="pt-6">
                <p className="text-sm text-destructive">{loadError}</p>
              </CardContent>
            </Card>
          ) : null}

          {me?.user && projects.length > 0 ? (
            <ItemList
              items={projects}
              onOpenProject={(id) => router.push(`/projects/${id}`)}
              onDeleteProject={(id) => void handleDelete(id)}
            />
          ) : null}
        </section>
      </main>

      <AuthModal
        open={authOpen}
        onOpenChange={setAuthOpen}
        onAuthed={handleAuthed}
      />
      <NewProjectModal
        open={newProjectOpen}
        onOpenChange={setNewProjectOpen}
        onCreated={(project) => {
          setProjects((current) => [project, ...current]);
          router.push(`/projects/${project.id}`);
        }}
      />
    </div>
  );
}
