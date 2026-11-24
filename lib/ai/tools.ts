import type { FunctionDeclaration } from "@google/genai";

export const coachTools: FunctionDeclaration[] = [
  {
    name: "update_profile",
    description:
      "Fill in the student's profile directly from what they told you (applied immediately, no review). Use whenever the student reveals their topic of interest, background (courses, skills, experience), experience level, or practical constraints (time, compute, data, advisor). For constraints, send the FULL updated list, keeping earlier items.",
    parametersJsonSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        interest: {
          type: "string",
          description: "Specific topic the student wants to study, in their terms.",
        },
        background: {
          type: "string",
          description:
            "What the student already knows: courses, skills, projects. Summarize faithfully; do not embellish.",
        },
        experienceLevel: {
          type: "string",
          enum: ["brand_new", "some_familiarity", "intermediate", "advanced"],
        },
        constraints: { type: "array", items: { type: "string" } },
      },
    },
  },
  {
    name: "recommend_readings",
    description:
      "Find REAL papers for the student to learn from. Give 1-3 short scholarly search queries (e.g. 'transformer attention survey', 'coral bleaching recovery review'). The app searches OpenAlex and shows the real results under your reply. Use this whenever you teach a concept or the student asks what to read. Never write paper titles yourself.",
    parametersJsonSchema: {
      type: "object",
      additionalProperties: false,
      required: ["queries"],
      properties: {
        queries: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          maxItems: 3,
        },
      },
    },
  },
  {
    name: "update_state",
    description:
      "Propose a Project Brain patch for research-progress fields (candidate questions, chosen question, novelty claim, takeaways, gaps, conflict notes, open questions, milestones). It is NOT saved until the student accepts. Use update_profile for interest/background/experience/constraints. Do not include phase.",
    parametersJsonSchema: {
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
        chosenQuestion: {
          type: "string",
          description: "Chosen research question, or empty if none.",
        },
        noveltyClaim: {
          type: "string",
          description: "Novelty/gap claim, or empty if none.",
        },
        openQuestions: { type: "array", items: { type: "string" } },
        milestones: {
          type: "object",
          description:
            "Partial milestone status update. orient_check cannot be set here; the app sets it when the student passes the comprehension check.",
          additionalProperties: false,
          properties: Object.fromEntries(
            [
              "orient_foundations",
              "broad_ideation",
              "literature_discussion",
              "gap_analysis",
              "question_formulation",
              "conflict_refinement",
            ].map((id) => [
              id,
              { type: "string", enum: ["not_started", "in_progress", "complete"] },
            ]),
          ),
        },
        studentTakeaways: {
          type: "array",
          items: { type: "string" },
          description:
            "Takeaways the STUDENT stated, quoted or lightly trimmed. Never write takeaways for them.",
        },
        identifiedGaps: {
          type: "array",
          items: { type: "string" },
          description: "Gaps the student identified, each tied to saved papers.",
        },
        conflictingEvidenceNotes: {
          type: "array",
          items: { type: "string" },
          description:
            "Student notes on where saved papers disagree with each other or with the question.",
        },
      },
    },
  },
  {
    name: "add_paper",
    description:
      "Propose saving a real paper the student found (OpenAlex / arXiv) with its real external id. Never invent a paper.",
    parametersJsonSchema: {
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
        year: { type: "integer" },
        abstract: { type: "string" },
        url: { type: "string" },
        citationCount: { type: "integer" },
        stance: {
          type: "string",
          enum: ["supporting", "conflicting", "foundational", "neutral"],
          description: "How this paper relates to the student's question.",
        },
        doi: { type: "string" },
        publicationYear: { type: "integer" },
        openAccessUrl: { type: "string" },
      },
    },
  },
  {
    name: "log_decision",
    description:
      "Propose logging an explicit student decision (for example choosing a question).",
    parametersJsonSchema: {
      type: "object",
      additionalProperties: false,
      required: ["summary"],
      properties: {
        summary: { type: "string" },
        rationale: { type: "string" },
      },
    },
  },
];
