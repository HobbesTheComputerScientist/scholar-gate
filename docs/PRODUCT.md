# Research Coach — product spec

Research Coach guides undergraduates through **starting** a research
project in any field. The AI never loses project context: **the Project
Brain (structured state in Postgres) is the source of truth**, and every
model call is assembled from it. Chat history is never treated as memory.

## Who it is for

Undergraduates with a broad interest (or none) who need a tutor and coach
to understand a field and reach a defensible research question, not a
ghostwriter.

## Scope

**In:** Phase 1 (Orient) and Phase 2 (Find your question).

**Out:** experiments, methods, paper drafting, outreach, submission.

The coach teaches, asks, and critiques. It must not write the paper, the
research question, or the novelty claim for the student.

## Information architecture

| Table | Role |
| --- | --- |
| `profiles` | 1:1 with `auth.users` |
| `projects` | Name + `state` jsonb (Project Brain) |
| `papers` | Saved papers (from OpenAlex; `semantic_scholar` / `arxiv` kept for older rows) with a stance |
| `orient_checks` | Comprehension-check attempts, answers, and scores |
| `decisions` | Explicit choices the student accepted |
| `messages` | Chat log (display + rolling summaries, not prompt memory) |
| `summaries` | Rolling condensation every 20 messages |
| `proposed_patches` | Coach suggestions waiting for accept/reject |

All tables use RLS: `auth.uid() = user_id`.

## Project Brain (`projects.state`)

Profile: `interest`, `background`, `experienceLevel`, `constraints`.
Research progress: `candidateQuestions`, `chosenQuestion`, `noveltyClaim`,
`openQuestions`, `studentTakeaways`, `identifiedGaps`,
`conflictingEvidenceNotes`, and seven `milestones`. Plus `phase`.

Who writes what:

- **Student:** can edit any Brain field directly.
- **Coach, directly:** profile fields only (`update_profile`), with an
  on-screen note.
- **Coach, as proposals:** everything else (`update_state`, `add_paper`,
  `log_decision`). Nothing is written until the student accepts.
- **Server only:** `phase` (via the phase gate) and the `orient_check`
  milestone (via a passing comprehension check).

## How the coach teaches

- Explains concepts in layers: intuition, how it works, a worked example
  from the student's topic, common misconceptions, how it connects to their
  interest, and "check yourself" questions.
- Lays out a learning path of core concepts and adapts depth to the
  student's experience level.
- Recommends readings only through `recommend_readings`, which returns real
  OpenAlex papers. Invented references are a product bug.

## Phase 1 — Orient (exit criteria)

1. `interest` is specific (not a one-word field like "AI").
2. `background` describes what the student already knows.
3. At least one constraint (time, compute, data, advisor).
4. At least two candidate questions.
5. A passed comprehension check: three AI-written questions on the subject
   matter plus one on the student's own question, graded against hidden
   rubrics with feedback (mean score ≥ 75%).

## Phase 2 — Find your question (exit criteria)

1. `chosenQuestion` is a concrete, answerable question.
2. `noveltyClaim` states a gap relative to saved papers.
3. At least three papers saved on the project.
4. At least one accepted decision recording why this question was chosen.

Paper search has three modes: general, foundational (most-cited among
relevant results), and counter-evidence (critiques, limitations,
replications), each with a default stance the student can change.

## Prompt assembly

`lib/prompt/assemble.ts` is a **pure function** of project state, papers,
decisions, latest summary, recent messages (from the DB), and the new
message. It instructs the model to teach in depth, cite only saved or
tool-returned papers, and send research-progress changes as proposals.

## Rolling summary

After every **20** messages on a project, a `summaries` row is written and
fed into the next assembled prompt.

## UI

Dark blue academic theme. Three panels on a project:

1. Phase stepper: both phases, seven milestones (locked / active /
   completed), the phase gate, and the comprehension check.
2. Chat: streaming Markdown replies with reading lists.
3. Project Brain: pending suggestions to accept or reject, editable fields,
   and paper search.
