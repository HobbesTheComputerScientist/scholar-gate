import { randomUUID } from "crypto";

import type { AssembleInput } from "@/lib/prompt/assemble";
import { evaluateOrientGates } from "@/lib/phases/gates";
import type { PatchTool } from "@/lib/db/types";

export type LocalCoachResult = {
  text: string;
  patches: Array<{ tool: PatchTool; payload: Record<string, unknown> }>;
};

function looksLikeQuestion(text: string) {
  return text.includes("?") && text.trim().length >= 20;
}

export function localCoach(input: AssembleInput): LocalCoachResult {
  const { state, papers, userMessage } = input;
  const patches: LocalCoachResult["patches"] = [];
  const lines: string[] = [];
  const message = userMessage.trim();

  if (state.phase === "orient") {
    const gates = evaluateOrientGates(state);
    if (!state.interest && message.length >= 12) {
      patches.push({
        tool: "update_state",
        payload: { interest: message.slice(0, 280) },
      });
      lines.push(
        "I captured a draft topic from your message. Accept the Project Brain patch if it is accurate, then tell me what you already know and what limits you (weeks, GPU, dataset access).",
      );
    } else if (!state.background && message.length >= 20) {
      patches.push({
        tool: "update_state",
        payload: { background: message.slice(0, 800) },
      });
      lines.push(
        "That reads like background. I proposed saving it. Next: name constraints and at least two candidate questions — I will not invent them for you.",
      );
    } else if (state.constraints.length === 0 && message.length >= 8) {
      patches.push({
        tool: "update_state",
        payload: { constraints: [message.slice(0, 200)] },
      });
      lines.push(
        "Logged a constraint proposal. We still need two distinct candidate questions before Phase 2.",
      );
    } else if (looksLikeQuestion(message)) {
      const existing = state.candidateQuestions;
      const next = [
        ...existing,
        { id: randomUUID(), text: message, notes: "" },
      ];
      patches.push({
        tool: "update_state",
        payload: { candidateQuestions: next },
      });
      lines.push(
        existing.length >= 1
          ? "Proposed adding this as another candidate. Accept it if you want it in the Brain, then we can compare the two."
          : "Proposed this as candidate #1. Give me a second, different question so Orient can complete.",
      );
    } else {
      const missing = gates.filter((gate) => !gate.passed).map((g) => g.label);
      lines.push(
        `I'm coaching, not writing the paper. Orient still needs: ${missing.join("; ")}. Answer in your own words — I'll propose Brain patches for you to accept.`,
      );
    }
  } else {
    if (!state.chosenQuestion && looksLikeQuestion(message)) {
      patches.push({
        tool: "update_state",
        payload: { chosenQuestion: message },
      });
      patches.push({
        tool: "log_decision",
        payload: {
          summary: "Proposed choosing this research question",
          rationale: message,
        },
      });
      lines.push(
        "I proposed locking this as your chosen question and logging a decision. Accept both patches only if you mean it.",
      );
    } else if (!state.noveltyClaim && message.length >= 20) {
      patches.push({
        tool: "update_state",
        payload: { noveltyClaim: message.slice(0, 800) },
      });
      lines.push(
        "Proposed a novelty/gap claim. Ground it in saved papers — I will only cite papers already in your Brain.",
      );
    } else {
      lines.push(
        papers.length < 3
          ? `You have ${papers.length} saved paper(s). Search OpenAlex in the Brain panel (use Foundational and Counter-evidence modes too) and save at least three before treating the gap as evidence. I will not invent citations.`
          : "Critique the question for undergrad scope: data access, compute, and whether the gap is actually supported by your saved papers. I won't draft the paper.",
      );
    }
  }

  if (papers.length > 0) {
    const allowed = papers
      .slice(0, 3)
      .map((paper) => `“${paper.title}”`)
      .join("; ");
    lines.push(`Allowed citations right now: ${allowed}.`);
  } else {
    lines.push("Allowed papers list is empty — I must not cite anything yet.");
  }

  return { text: lines.join("\n\n"), patches };
}
