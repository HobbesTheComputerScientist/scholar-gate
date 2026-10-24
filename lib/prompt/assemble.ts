import { PHASE_LABELS, type PhaseId } from "@/lib/db/types";
import type { ChatMessage, Decision, Paper, ProjectState } from "@/lib/db/types";
import {
  evaluateFindQuestionGates,
  evaluateOrientGates,
} from "@/lib/phases/gates";

export type AssembleInput = {
  projectName: string;
  state: ProjectState;
  papers: Paper[];
  decisions: Decision[];
  latestSummary: string | null;
  recentMessages: Pick<ChatMessage, "role" | "content">[];
  userMessage: string;
};

export type AssembledPrompt = {
  system: string;
  user: string;
};

const COACH_RULES = `You are Research Coach, a demanding but kind advisor for an undergraduate starting an AI/ML research paper.

Hard rules:
- Coach and critique. Do NOT ghostwrite sections, abstracts, or the paper.
- Postgres project state (the Project Brain JSON below) is the source of truth. Do not rely on chat history as memory.
- You may ONLY cite papers listed in "Allowed papers". If the list is empty, say so and ask the student to search/save papers. Never invent titles, authors, years, or links.
- State changes must be proposed via tools (update_state, add_paper, log_decision). They are NOT applied until the student accepts. Never claim you already saved Brain fields.
- update_state cannot change phase. Phase gates are enforced by the app.
- add_paper may only propose a paper the student (or search) already identified with a real external id — never a fabricated paper.
- Stay in the current phase. MVP is Orient and Find your question only. No experiments, methods, or drafting.`;

function formatPapers(papers: Paper[]): string {
  if (papers.length === 0) {
    return "(none — you must not cite any paper)";
  }
  return papers
    .map((paper) => {
      const authors = paper.authors.join(", ") || "unknown authors";
      const year = paper.year ?? "n.d.";
      return `- [${paper.id}] ${paper.title} (${authors}, ${year}) source=${paper.source} external_id=${paper.externalId}`;
    })
    .join("\n");
}

function formatGates(state: ProjectState, papers: Paper[], decisionCount: number) {
  const checks =
    state.phase === "orient"
      ? evaluateOrientGates(state)
      : evaluateFindQuestionGates(state, papers, decisionCount);
  return checks
    .map((check) => `- [${check.passed ? "x" : " "}] ${check.label}`)
    .join("\n");
}

function phaseBrief(phase: PhaseId): string {
  if (phase === "orient") {
    return `Current phase: ${PHASE_LABELS.orient}
Help the student go from a vague interest to a specific topic, honest background, constraints, and at least two candidate questions. Ask follow-ups. Do not skip ahead to a final question until Orient exit criteria are close.`;
  }
  return `Current phase: ${PHASE_LABELS.find_question}
Help the student pick one candidate, sharpen it against saved papers, and state a novelty/gap claim. Require papers from the allowed list before treating claims as grounded.`;
}

export function assemblePrompt(input: AssembleInput): AssembledPrompt {
  const {
    projectName,
    state,
    papers,
    decisions,
    latestSummary,
    recentMessages,
    userMessage,
  } = input;

  const system = [
    COACH_RULES,
    phaseBrief(state.phase),
    `Project name: ${projectName}`,
    "Project Brain JSON:",
    JSON.stringify(state, null, 2),
    "Exit criteria:",
    formatGates(state, papers, decisions.length),
    "Allowed papers (the only citable set):",
    formatPapers(papers),
    "Accepted decisions:",
    decisions.length === 0
      ? "(none)"
      : decisions
          .map((d) => `- ${d.summary}${d.rationale ? ` — ${d.rationale}` : ""}`)
          .join("\n"),
    "Latest rolling summary:",
    latestSummary ?? "(none yet)",
  ].join("\n\n");

  const recent =
    recentMessages.length === 0
      ? "(no recent messages stored)"
      : recentMessages
          .map((message) => `${message.role}: ${message.content}`)
          .join("\n");

  const user = [
    "Recent messages from the database (context only; Brain above is authoritative):",
    recent,
    "Student's new message:",
    userMessage,
  ].join("\n\n");

  return { system, user };
}
