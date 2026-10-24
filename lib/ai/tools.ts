import type { Anthropic } from "@anthropic-ai/sdk";

export const coachTools: Anthropic.Messages.Tool[] = [
  {
    name: "update_state",
    description:
      "Propose a Project Brain patch. It is NOT saved until the student accepts. Do not include phase.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        interest: { type: "string" },
        background: { type: "string" },
        experienceLevel: {
          type: "string",
          enum: [
            "brand_new",
            "some_familiarity",
            "intermediate",
            "advanced",
          ],
        },
        constraints: { type: "array", items: { type: "string" } },
        candidateQuestions: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              id: { type: "string" },
              text: { type: "string" },
              notes: { type: "string" },
            },
            required: ["id", "text", "notes"],
          },
        },
        chosenQuestion: { type: ["string", "null"] },
        noveltyClaim: { type: ["string", "null"] },
        openQuestions: { type: "array", items: { type: "string" } },
      },
    },
  },
  {
    name: "add_paper",
    description:
      "Propose saving a real paper the student found (Semantic Scholar / OpenAlex / arXiv). Never invent a paper.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["source", "externalId", "title"],
      properties: {
        source: {
          type: "string",
          enum: ["semantic_scholar", "openalex", "arxiv"],
        },
        externalId: { type: "string" },
        title: { type: "string" },
        authors: { type: "array", items: { type: "string" } },
        year: { type: ["integer", "null"] },
        abstract: { type: ["string", "null"] },
        url: { type: ["string", "null"] },
        citationCount: { type: ["integer", "null"] },
      },
    },
  },
  {
    name: "log_decision",
    description:
      "Propose logging an explicit student decision (for example choosing a question).",
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["summary"],
      properties: {
        summary: { type: "string" },
        rationale: { type: ["string", "null"] },
      },
    },
  },
];
