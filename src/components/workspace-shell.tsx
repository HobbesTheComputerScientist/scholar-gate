"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ChatPanel, streamChat } from "@/src/components/chat-panel";
import { PhaseStepper } from "@/src/components/phase-stepper";
import { ProjectBrain } from "@/src/components/project-brain";
import type {
  ChatMessage,
  Paper,
  Project,
  ProjectState,
  ProposedPatch,
  Summary,
} from "@/lib/db/types";

type WorkspacePayload = {
  project: Project;
  papers: Paper[];
  decisions: { id: string }[];
  messages: ChatMessage[];
  patches: ProposedPatch[];
  latestSummary: Summary | null;
  error?: string;
};

export function WorkspaceShell({ projectId }: { projectId: string }) {
  const [payload, setPayload] = useState<WorkspacePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [busyPatchId, setBusyPatchId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch(`/api/projects/${projectId}`);
    const body = (await response.json()) as WorkspacePayload;
    if (!response.ok) {
      setError(body.error ?? "Could not load project.");
      return;
    }
    setPayload(body);
    setError(null);
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSend(message: string) {
    if (!payload) {
      return;
    }
    const optimistic: ChatMessage = {
      id: `local-${Date.now()}`,
      userId: payload.project.userId,
      projectId,
      role: "user",
      content: message,
      createdAt: new Date().toISOString(),
    };
    const assistantId = `local-a-${Date.now()}`;
    setPayload({
      ...payload,
      messages: [
        ...payload.messages,
        optimistic,
        {
          id: assistantId,
          userId: payload.project.userId,
          projectId,
          role: "assistant",
          content: "",
          createdAt: new Date().toISOString(),
        },
      ],
    });
    setSending(true);
    try {
      await streamChat(projectId, message, (event) => {
        if (event.type === "text" && event.delta) {
          setPayload((current) => {
            if (!current) return current;
            return {
              ...current,
              messages: current.messages.map((row) =>
                row.id === assistantId
                  ? { ...row, content: row.content + event.delta }
                  : row,
              ),
            };
          });
        }
        if (event.type === "patch" && event.patch) {
          setPayload((current) =>
            current
              ? { ...current, patches: [...current.patches, event.patch!] }
              : current,
          );
        }
      });
      await load();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Chat failed.");
    } finally {
      setSending(false);
    }
  }

  async function saveState(patch: Partial<ProjectState>) {
    const response = await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const body = (await response.json()) as { error?: string };
    if (!response.ok) {
      throw new Error(body.error ?? "Could not save.");
    }
    await load();
  }

  async function resolvePatch(
    id: string,
    action: "accepted" | "rejected",
  ) {
    setBusyPatchId(id);
    try {
      const response = await fetch(`/api/patches/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "Could not update patch.");
      }
      await load();
    } catch (patchError) {
      setError(
        patchError instanceof Error ? patchError.message : "Patch failed.",
      );
    } finally {
      setBusyPatchId(null);
    }
  }

  async function advance() {
    setAdvancing(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/advance`, {
        method: "POST",
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "Cannot advance yet.");
      }
      await load();
    } catch (advanceError) {
      setError(
        advanceError instanceof Error
          ? advanceError.message
          : "Cannot advance yet.",
      );
    } finally {
      setAdvancing(false);
    }
  }

  if (error && !payload) {
    return (
      <div className="p-8">
        <p className="text-sm text-destructive">{error}</p>
        <Button asChild className="mt-4" variant="outline">
          <Link href="/">Back to projects</Link>
        </Button>
      </div>
    );
  }

  if (!payload) {
    return <p className="p-8 text-sm text-muted-foreground">Loading workspace…</p>;
  }

  const { project, papers, messages, patches, latestSummary, decisions } =
    payload;

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b bg-background">
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <div>
            <Button asChild variant="ghost" size="sm" className="-ml-2 mb-1">
              <Link href="/">All projects</Link>
            </Button>
            <h1 className="text-lg font-semibold">{project.name}</h1>
            <p className="text-xs text-muted-foreground">
              Research Coach · structured Brain is the source of truth
            </p>
          </div>
        </div>
        {error ? (
          <p className="border-t px-4 py-2 text-xs text-destructive">{error}</p>
        ) : null}
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)_340px]">
        <aside className="border-b bg-muted/20 p-4 lg:border-b-0 lg:border-r">
          <PhaseStepper
            project={project}
            papers={papers}
            decisionCount={decisions.length}
            onAdvance={() => void advance()}
            advancing={advancing}
          />
        </aside>
        <section className="min-h-[420px] p-4">
          <ChatPanel
            messages={messages}
            sending={sending}
            onSend={handleSend}
          />
        </section>
        <aside className="border-t bg-muted/20 p-4 lg:border-l lg:border-t-0">
          <ProjectBrain
            project={project}
            papers={papers}
            patches={patches}
            latestSummary={latestSummary?.content ?? null}
            busyPatchId={busyPatchId}
            onSaveState={saveState}
            onResolvePatch={(id, action) => void resolvePatch(id, action)}
            onPaperSaved={() => void load()}
          />
        </aside>
      </div>
    </div>
  );
}
