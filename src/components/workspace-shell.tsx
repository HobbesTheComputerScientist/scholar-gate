"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ChatPanel, streamChat } from "@/src/components/chat-panel";
import { LogoMark } from "@/src/components/logo";
import { PhaseStepper } from "@/src/components/phase-stepper";
import { ProjectBrain } from "@/src/components/project-brain";
import {
  PHASE_LABELS,
  type ChatMessage,
  type Paper,
  type Project,
  type ProjectState,
  type ProposedPatch,
  type Summary,
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
  const [chatNotices, setChatNotices] = useState<string[]>([]);

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
    void (async () => {
      await load();
    })();
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
    setChatNotices([]);
    let streamError: string | null = null;
    try {
      await streamChat(projectId, message, (event) => {
        if (event.type === "error") {
          streamError = event.message ?? "The coach could not answer.";
          setChatNotices((current) => [
            ...current,
            "The coach ran into a problem answering. Please try again in a moment.",
          ]);
        }
        if (event.type === "notice" && event.message) {
          setChatNotices((current) => [...current, event.message!]);
        }
        if (event.type === "profile" && event.fields?.length) {
          const labels: Record<string, string> = {
            interest: "topic",
            background: "background",
            experienceLevel: "experience level",
            constraints: "constraints",
          };
          setChatNotices((current) => [
            ...current,
            `Coach updated your profile: ${event.fields!
              .map((field) => labels[field] ?? field)
              .join(", ")}.`,
          ]);
        }
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
      if (streamError) {
        console.error("[chat]", streamError);
      }
      // Always resync: the server saves partial replies, papers, and profile.
      await load();
    } catch (sendError) {
      const text =
        sendError instanceof Error ? sendError.message : "Chat failed.";
      // Show the failure in the coach bubble instead of leaving it blank.
      setPayload((current) =>
        current
          ? {
              ...current,
              messages: current.messages.map((row) =>
                row.id === assistantId && !row.content
                  ? { ...row, content: `_The coach couldn't answer: ${text} Please try again._` }
                  : row,
              ),
            }
          : current,
      );
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
    <div className="flex min-h-full flex-col bg-slate-950 lg:h-dvh lg:min-h-0">
      <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur">
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <div>
            <Button asChild variant="ghost" size="sm" className="-ml-2 mb-1">
              <Link href="/">All projects</Link>
            </Button>
            <div className="flex items-center gap-2.5">
              <LogoMark className="size-7" />
              <div>
                <h1 className="text-lg font-semibold leading-tight tracking-tight">
                  {project.name}
                </h1>
                <p className="text-xs text-slate-400">Research Coach</p>
              </div>
            </div>
          </div>
          <span
            className={
              project.state.phase === "orient"
                ? "rounded-full border border-sky-400/40 bg-sky-400/10 px-3 py-1 text-xs font-medium text-sky-300"
                : "rounded-full border border-indigo-500/40 bg-indigo-500/15 px-3 py-1 text-xs font-medium text-indigo-200"
            }
          >
            {PHASE_LABELS[project.state.phase]}
          </span>
        </div>
        {error ? (
          <p className="border-t px-4 py-2 text-xs text-destructive">{error}</p>
        ) : null}
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-[264px_minmax(0,1fr)_360px]">
        <aside className="rounded-xl border border-slate-800 bg-slate-900 p-4 lg:min-h-0 lg:overflow-y-auto">
          <PhaseStepper
            project={project}
            papers={papers}
            decisionCount={decisions.length}
            onAdvance={() => void advance()}
            advancing={advancing}
            onCheckPassed={() => void load()}
          />
        </aside>
        <section className="h-[70dvh] rounded-xl border border-slate-800 bg-slate-900 p-4 lg:h-auto lg:min-h-0">
          <ChatPanel
            messages={messages}
            sending={sending}
            notices={chatNotices}
            onSend={handleSend}
          />
        </section>
        <aside className="rounded-xl border border-slate-800 bg-slate-900 p-3 lg:min-h-0 lg:overflow-hidden">
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
