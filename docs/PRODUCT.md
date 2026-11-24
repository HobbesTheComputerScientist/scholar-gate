# Research Coach — MVP product spec

Research Coach guides undergrads through **starting** a research
paper. The AI never loses project context: **Postgres project state is
the source of truth**. Every model call is assembled from that state.
Do not treat chat history as memory.

## Who it is for

Undergraduates who have a broad interest (or none) and need a coach to
reach a defensible research question — not a ghostwriter.

## MVP scope

**In:** Phase 1 (Orient) and Phase 2 (Find your question).

**Out:** experiments, methods, paper drafting, outreach, submission.

The model coaches and critiques. It must not write the paper.

## Information architecture

| Table | Role |
| --- | --- |
| `profiles` | 1:1 with `auth.users` |
| `projects` | Name + `state` jsonb (Project Brain) |
| `papers` | User-saved papers (searched via OpenAlex; `semantic_scholar` / `arxiv` sources kept for older rows) |
| `decisions` | Explicit choices the student accepted |
| `messages` | Chat log (display + rolling summaries, not prompt memory) |
| `summaries` | Rolling condensation every 20 messages |
| `proposed_patches` | Tool outputs waiting for accept/reject |

All tables use RLS: `auth.uid() = user_id`.

## Project Brain (`projects.state`)

```ts
{
  phase: "orient" | "find_question",
  interest: string,
  background: string,
  experienceLevel: "brand_new" | "some_familiarity" | "intermediate" | "advanced",
  constraints: string[],
  candidateQuestions: { id: string, text: string, notes: string }[],
  chosenQuestion: string | null,
  noveltyClaim: string | null,
  openQuestions: string[],
}
```

The student can edit these fields directly. The model may only **propose**
patches (`update_state`, `add_paper`, `log_decision`). Nothing is written
to Brain / papers / decisions until the student accepts.

Citations in chat may only refer to rows in `papers` for that project.
Invented references are a product bug.

## Phase 1 — Orient (exit criteria)

All must be true before unlocking Phase 2:

1. `interest` is specific (not empty, not a one-word field like "AI").
2. `background` describes what the student already knows.
3. At least one `constraints` entry (time, compute, data, advisor).
4. At least two `candidateQuestions`.

## Phase 2 — Find your question (exit criteria)

All must be true to mark Phase 2 complete (still MVP — no Phase 3 UI):

1. `chosenQuestion` is a concrete, answerable question.
2. `noveltyClaim` states a gap relative to saved papers.
3. At least three papers saved on the project.
4. At least one accepted decision logging why this question was chosen.

## Prompt assembly

`lib/prompt/assemble.ts` is a **pure function**. Inputs: project state,
papers, decisions, latest summary, recent messages (from DB), user turn.
It must instruct the model to coach, cite only listed papers, and emit
tools as proposals — never as fait accompli.

## Rolling summary

After every **20** messages on a project, persist a `summaries` row and
feed the latest summary into the next assembled prompt.

## UI

Three panels on a project:

1. Phase stepper (Orient → Find your question) with gates.
2. Chat (streaming).
3. Editable Project Brain + pending patches + paper search.
