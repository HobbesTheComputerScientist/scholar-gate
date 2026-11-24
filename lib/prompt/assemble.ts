import {
  MILESTONES,
  MILESTONE_LABELS,
  MILESTONE_PHASE,
  PHASE_LABELS,
  type ChatMessage,
  type Decision,
  type MilestoneId,
  type Paper,
  type PhaseId,
  type ProjectState,
} from "@/lib/db/types";
import {
  evaluateFindQuestionGates,
  evaluateOrientGates,
} from "@/lib/phases/gates";
import { currentMilestone } from "@/lib/phases/milestones";

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

const COACH_RULES = `You are Research Coach, a demanding but kind advisor for an undergraduate starting a research paper.

Hard rules:
- Coach and critique. Do NOT ghostwrite sections, abstracts, or the paper. Do not write the student's research question, novelty claim, takeaways, gaps, or conflict notes for them; ask questions until THEY state it, then you may propose saving their words.
- studentTakeaways, identifiedGaps, and conflictingEvidenceNotes must be the student's own words (quoted or lightly trimmed). Never fill them with your own summaries.
- Postgres project state (the Project Brain JSON below) is the source of truth. Do not rely on chat history as memory.
- You may ONLY cite papers listed in "Allowed papers". If the list is empty, say so and ask the student to search/save papers. Never invent titles, authors, years, or links.
- State changes must be proposed via tools (update_state, add_paper, log_decision). They are NOT applied until the student accepts. Never claim you already saved Brain fields.
- update_state cannot change phase or the orient_check milestone. Phase gates and the comprehension check are enforced by the app; never quiz-grade the student yourself or give them answers to the check.
- Gaps and conflicting evidence must be grounded in Allowed papers (refer to them by their [id] and title). If the needed papers are not saved, tell the student which kind of paper to search for instead.
- add_paper may only propose a paper the student (or search) already identified with a real external id — never a fabricated paper.
- Stay in the current phase. MVP is Orient and Find your question only. No experiments, methods, or drafting.`;

function formatPapers(papers: Paper[]): string {
  if (papers.length === 0) {
    return "(none — you must not cite any paper)";
  }
  return papers
    .map((paper) => {
      const authors = paper.authors.join(", ") || "unknown authors";
      const year = paper.publicationYear ?? paper.year ?? "n.d.";
      const extras = [
        `stance=${paper.stance}`,
        `source=${paper.source}`,
        `external_id=${paper.externalId}`,
        paper.doi ? `doi=${paper.doi}` : null,
        paper.openAccessUrl ? `open_access=${paper.openAccessUrl}` : null,
      ]
        .filter(Boolean)
        .join(" ");
      return `- [${paper.id}] ${paper.title} (${authors}, ${year}) ${extras}`;
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

const MILESTONE_BRIEFS: Record<MilestoneId, string> = {
  orient_foundations:
    "Build foundations: get a specific topic, honest background, and constraints. Ask the student to explain core concepts back to you; record takeaways only in their words.",
  orient_check:
    "The student must pass the app's comprehension check before Phase 2. Help them review their own understanding; do not supply answers to the check.",
  broad_ideation:
    "Widen before narrowing: push the student to generate several candidate questions themselves and say what each would require.",
  literature_discussion:
    "Discuss Allowed papers only. Ask what each paper claims, its method, and its limits. Encourage tagging stance (supporting / conflicting / foundational / neutral).",
  gap_analysis:
    "Ask the student where Allowed papers stop short. Each gap they name should point at specific saved papers.",
  question_formulation:
    "The student writes one concrete, answerable question and a novelty claim. Critique scope and clarity; do not rewrite it for them.",
  conflict_refinement:
    "Use papers tagged conflicting (or disagreements the student noticed) to stress-test the question. The student records how the conflict changes their question.",
};

function formatMilestones(state: ProjectState): string {
  const current = currentMilestone(state);
  const lines = MILESTONES.map((id) => {
    const status = state.milestones[id];
    const box = status === "complete" ? "x" : status === "in_progress" ? "~" : " ";
    const phaseTag = MILESTONE_PHASE[id] === "orient" ? "P1" : "P2";
    const marker = id === current ? "  <- current" : "";
    return `- [${box}] ${phaseTag} ${id}: ${MILESTONE_LABELS[id]}${marker}`;
  });
  const focus = current
    ? `Current milestone focus (${current}): ${MILESTONE_BRIEFS[current]}`
    : "All milestones for this phase are complete; help the student meet any remaining exit criteria.";
  return [...lines, "", focus].join("\n");
}

function formatList(items: string[], empty: string): string {
  const filled = items.filter((item) => item.trim().length > 0);
  return filled.length === 0 ? empty : filled.map((item) => `- ${item}`).join("\n");
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
    "Milestones ([x] complete, [~] in progress):",
    formatMilestones(state),
    "Exit criteria:",
    formatGates(state, papers, decisions.length),
    "Student takeaways (student's own words):",
    formatList(state.studentTakeaways, "(none yet)"),
    "Identified gaps:",
    formatList(state.identifiedGaps, "(none yet)"),
    "Conflicting evidence notes:",
    formatList(state.conflictingEvidenceNotes, "(none yet)"),
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
