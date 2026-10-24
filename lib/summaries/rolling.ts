import type { DbRepo } from "@/lib/db/repo";
import type { Project } from "@/lib/db/types";
import { assemblePrompt } from "@/lib/prompt/assemble";

export const SUMMARY_EVERY = 20;

export function shouldWriteSummary(messageCount: number) {
  return messageCount > 0 && messageCount % SUMMARY_EVERY === 0;
}

export async function maybeWriteRollingSummary(
  repo: DbRepo,
  userId: string,
  project: Project,
): Promise<void> {
  const messageCount = await repo.countMessages(userId, project.id);
  if (!shouldWriteSummary(messageCount)) {
    return;
  }

  const [papers, decisions, recent, latest] = await Promise.all([
    repo.listPapers(userId, project.id),
    repo.listDecisions(userId, project.id),
    repo.listRecentMessages(userId, project.id, SUMMARY_EVERY),
    repo.latestSummary(userId, project.id),
  ]);

  const assembled = assemblePrompt({
    projectName: project.name,
    state: project.state,
    papers,
    decisions,
    latestSummary: latest?.content ?? null,
    recentMessages: recent,
    userMessage:
      "Write a concise rolling summary of progress (facts only from Brain, papers, and decisions). No new citations.",
  });

  const content = [
    `Summary at ${messageCount} messages.`,
    `Phase: ${project.state.phase}.`,
    `Interest: ${project.state.interest || "(none)"}.`,
    `Chosen question: ${project.state.chosenQuestion || "(none)"}.`,
    `Papers saved: ${papers.length}. Decisions: ${decisions.length}.`,
    latest ? `Previous summary: ${latest.content}` : "",
    "Recent thread:",
    recent.map((m) => `${m.role}: ${m.content.slice(0, 280)}`).join("\n"),
    `(Prompt fingerprint: ${assembled.system.length} system chars)`,
  ]
    .filter(Boolean)
    .join("\n");

  await repo.insertSummary({
    userId,
    projectId: project.id,
    content,
    messageCountAt: messageCount,
  });
}
