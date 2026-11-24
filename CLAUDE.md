@AGENTS.md

# Research Coach

Web app that coaches undergrads through **starting** a research paper (any field).
MVP is **Phase 1 (Orient)** and **Phase 2 (Find your question)** only. No
experiments, methods, or paper drafting.

**Differentiator:** the model never treats chat history as memory. Structured
project state in Postgres (Project Brain) is the source of truth. Every model
call is assembled from DB rows by a pure function.

**Stack:** Next.js 16 App Router (`src/app`), TypeScript strict, Tailwind v4 +
shadcn/ui, Supabase (auth + Postgres + RLS), Google Gemini (`@google/genai`)
from server routes only.

**Hard rules**
- API keys only in server code. Never `NEXT_PUBLIC_` for secrets.
- Cite only papers in the `papers` table. Never invent references.
- Coach and critique; do not ghostwrite.
- Research-progress changes (questions, novelty, takeaways, gaps, papers,
  decisions, milestones) are **proposed** patches; the user accepts/rejects.
  Exception: profile fields (`interest`, `background`, `experienceLevel`,
  `constraints`) are filled in directly by the coach's `update_profile` tool.
- Coach teaches in depth (intuition, mechanism, worked example,
  misconceptions, self-check) and recommends readings only via
  `recommend_readings` (real OpenAlex results).
- `lib/prompt/assemble.ts` stays a pure function with tests.
- All tables use RLS scoped to `auth.uid()`.
- Validate API input and tool output with zod.

## File tree

```
.
├── docs/PRODUCT.md              Product spec (phases, gates, tables)
├── supabase/migrations/0001_init.sql          full schema (fresh DBs)
├── supabase/migrations/0002_scholar_gate_mvp.sql upgrade for existing DBs
├── supabase/migrations/0003_reconcile_live_schema.sql align a drifted live DB
├── src/
│   ├── proxy.ts                 Next.js 16 proxy (Supabase cookie refresh)
│   ├── app/
│   │   ├── layout.tsx / page.tsx / globals.css
│   │   ├── projects/[id]/page.tsx
│   │   └── api/
│   │       ├── auth/route.ts
│   │       ├── me/route.ts
│   │       ├── chat/route.ts          SSE coach
│   │       ├── papers/route.ts        save paper
│   │       ├── papers/[id]/route.ts   PATCH stance
│   │       ├── papers/search/route.ts OpenAlex (?mode=)
│   │       ├── patches/[id]/route.ts  accept/reject
│   │       └── projects/
│   │           ├── route.ts           list + create
│   │           └── [id]/
│   │               ├── route.ts       workspace GET/PATCH/DELETE
│   │               ├── advance/route.ts phase gate
│   │               └── orient-check/route.ts comprehension check
│   └── components/                feature UI (not shadcn primitives)
├── components/ui/                 shadcn button, card, dialog, input, textarea, table
├── lib/
│   ├── db/                        types, zod schemas, repo interface
│   │   ├── memory-repo.ts         local fallback store
│   │   ├── supabase-repo.ts       live Postgres
│   │   └── server.ts              picks repo from env
│   ├── supabase/                  browser/server clients
│   ├── auth/                      session + local cookie auth
│   ├── prompt/assemble.ts         pure prompt builder
│   ├── phases/gates.ts            exit criteria
│   ├── phases/milestones.ts       current milestone helpers
│   ├── orient/check.ts            comprehension check questions + grader
│   ├── ai/                        tools, Gemini stream, localCoach
│   ├── papers/openalex.ts         OpenAlex /works client + abstract decoder
│   ├── patches/apply.ts
│   └── summaries/rolling.ts       every 20 messages
└── .env.example
```

## Database schema

Defined in `supabase/migrations/0001_init.sql` (fresh databases). Existing
databases run `supabase/migrations/0002_scholar_gate_mvp.sql` (idempotent).
A live DB built from a different schema (e.g. `profiles.full_name`,
`projects.title`) runs `0003_reconcile_live_schema.sql`: it adds the app's
columns, backfills from legacy names, relaxes legacy NOT NULLs, creates
`orient_checks`, and resets RLS + the new-user trigger. Idempotent. `auth.users` is owned by Supabase Auth; `profiles.id` references it.

| Table | Purpose |
| --- | --- |
| `profiles` | 1:1 with `auth.users` (email, display_name) |
| `projects` | `name` + `state jsonb` (Project Brain) |
| `papers` | Saved citable papers (`semantic_scholar` / `openalex` / `arxiv`) + `stance`, `doi`, `publication_year`, `open_access_url` |
| `orient_checks` | Comprehension checks (`topic`, `questions_json`, `student_answers_json`, `score` 0–100, `passed`) |
| `decisions` | Accepted student decisions |
| `messages` | Chat log (UI + rolling summary, not prompt memory) |
| `summaries` | Recap written every 20 messages |
| `proposed_patches` | Tool payloads: pending / accepted / rejected |

RLS: `auth.uid() = user_id` (profiles: `auth.uid() = id`). Trigger
`handle_new_user` inserts a profile on signup.

**Live vs local:** if `NEXT_PUBLIC_SUPABASE_URL` **and**
`NEXT_PUBLIC_SUPABASE_ANON_KEY` are set, `getRepo()` uses `supabase-repo`.
Otherwise it uses `memory-repo` (process memory, wiped on server restart).
If Supabase is configured but the live schema is missing columns the app
uses (checked once per server, rechecked every 60s), `getRepo()` also uses
`memory-repo` while auth stays on Supabase; `/api/me` reports
`persistence: "server"` and the home page shows a notice. Running
`0003_reconcile_live_schema.sql` switches it back automatically.
Local auth uses an httpOnly HMAC cookie (`lib/auth/local-session.ts`).

## Project Brain (`projects.state`)

Type: `ProjectState` in `lib/db/types.ts`.

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
  milestones: Record<MilestoneId, "not_started" | "in_progress" | "complete">,
  studentTakeaways: string[],          // student's own words only
  identifiedGaps: string[],
  conflictingEvidenceNotes: string[],
}
```

`ProjectBrain` is an alias of `ProjectState`. Milestones, in order:
`orient_foundations`, `orient_check` (Phase 1); `broad_ideation`,
`literature_discussion`, `gap_analysis`, `question_formulation`,
`conflict_refinement` (Phase 2). New fields default when parsing older rows.
`orient_check` is server-owned: only a passing `orient_checks` submission sets
it; `update_state` and student PATCHes reject it.

Students can PATCH Brain fields directly (`/api/projects/[id]`). The coach
cannot change `phase`; `update_state` strips it. Phase 2 is unlocked only by
`POST /api/projects/[id]/advance` after Orient gates pass (`lib/phases/gates.ts`).

**Orient exit:** specific interest, background ≥ 20 chars, ≥1 constraint, ≥2
candidate questions, passed comprehension check (score ≥ 75; `advance` also
verifies a passed `orient_checks` row).

**Comprehension check** (`lib/orient/ai-check.ts`): Gemini writes 3
subject-matter questions (explain a mechanism, apply it to a scenario,
compare/misconception) from the topic, experience level, and what the coach
taught, plus 1 project question. Each has a hidden rubric (stripped from API
responses) and a hint. Grading: the heuristic gate in `lib/orient/check.ts`
(≥25 words, not copied) runs first, then Gemini scores each answer 0–100
against its rubric with feedback; the mean must be ≥ 75. If Gemini is down,
both steps fall back to the deterministic template questions/heuristic.

**Find-question exit:** chosen question, novelty claim, ≥3 saved papers, ≥1
decision. MVP has no Phase 3 UI.

## How `assemble.ts` builds prompts

`assemblePrompt(input)` is pure. Callers (chat + rolling summary) load rows
from the repo, then pass:

- `projectName`, `state` (Brain JSON)
- `papers` (the only allowed citation list)
- `decisions`
- `latestSummary`
- `recentMessages` (from DB, labeled as context only)
- `userMessage`

**System string:** coach rules (no ghostwriting, no invented cites, patches
are proposals) + phase brief + Brain JSON + milestone checklist with the
current milestone's brief + exit criteria + takeaways / gaps / conflict notes
+ allowed papers (with stance, DOI, open-access URL) + decisions + latest
summary.

**User string:** recent DB messages + the new student message.

Chat does **not** send a growing Gemini transcript. Persistence is Brain +
papers + decisions + summaries.

## Coach tools

`lib/ai/run-coach.ts` runs a tool loop (max 3 rounds): tool results are sent
back to Gemini as `functionResponse` parts so it keeps writing. Later rounds
stay on the same model (Gemini 3 thought signatures).

Applied or executed by the server:

- `update_profile` — interest / background / experienceLevel / constraints,
  merged into `projects.state` immediately (`profile` SSE event)
- `recommend_readings` — 1–3 queries; `lib/ai/readings.ts` searches OpenAlex
  (foundational mode), returns the real hits to the model, and appends a
  "Readings to learn from" block to the stored reply

Proposed patches, validated in `lib/db/schema.ts` before insert:

- `update_state` — Brain field patch (no `phase`)
- `add_paper` — propose a real paper with source + external id
- `log_decision` — propose a decision row

`POST /api/patches/[id]` applies on accept (`lib/patches/apply.ts`).

## API surface

| Route | Live behavior |
| --- | --- |
| `POST /api/auth` | Supabase auth if configured, else local users |
| `GET /api/me` | session + `persistence: supabase \| local` |
| `GET/POST /api/projects` | list / create |
| `GET/PATCH/DELETE /api/projects/[id]` | workspace + Brain edits |
| `POST /api/projects/[id]/advance` | phase gate |
| `POST /api/chat` | SSE: text deltas + pending patches |
| `GET /api/papers/search` | OpenAlex `/works` (live HTTP); `mode=general\|foundational\|conflicting` |
| `POST /api/papers` | save paper to project |
| `PATCH /api/papers/[id]` | set paper stance |
| `GET/POST /api/projects/[id]/orient-check` | list checks / `start` / `submit` answers |
| `POST /api/patches/[id]` | accept / reject |

## Live vs stubbed

| Piece | Live | Fallback / stub |
| --- | --- | --- |
| UI workspace (3 panels) | Live | — |
| Auth + DB | Supabase when both public env vars set | In-memory repo + cookie auth |
| Coach (primary) | Groq via `lib/ai/groq.ts` when `GROQ_API_KEY` is set: `GROQ_MODEL` (optional) then `openai/gpt-oss-120b`, `qwen/qwen3.8-27b`; same tool loop (OpenAI-style `tool` messages). Also used for the comprehension check (JSON mode) and rolling summaries | Gemini chain below |
| Coach (fallback) | Gemini via `lib/ai/gemini.ts` when `GEMINI_API_KEY` is set: `GEMINI_MODEL` (default `gemini-3.8-flash`), then 3.7 / 3.6 / 3.5-flash / 3.5-flash-lite on 503/429/timeout (15s to first chunk; failing models skipped for 2 min) | `lib/ai/local-coach.ts` heuristics, with an on-screen notice |
| Paper search | OpenAlex `/works` (`lib/papers/openalex.ts`) | Optional `OPENALEX_API_KEY` sent as `api_key`; keyless requests still work |
| Semantic Scholar / arXiv fetch | **Not implemented** (source enum kept for older rows) | — |
| Rolling summary | Every 20 messages; Gemini `gemini-3.5-flash-lite` (`GEMINI_SUMMARY_MODEL`) when the API key is set | Deterministic Brain/papers/decisions recap if the key is missing |
| Zod / Gemini SDK | `zod` + `@google/genai` | — |

## Paper search (OpenAlex)

`searchOpenAlex(query, { mode, limit })` calls `https://api.openalex.org/works`
with `search`, `per_page`, `select`, and `api_key` (only when
`OPENALEX_API_KEY` is set). `abstract_inverted_index` is decoded to plain text
by `decodeAbstract`. Results are zod-validated; works without a title are dropped.

| Mode | Query | Default stance on save |
| --- | --- | --- |
| `general` | student query | `neutral` |
| `foundational` | top 25 by relevance, reranked by `cited_by_count` | `foundational` |
| `conflicting` | `"query" AND (limitations OR critique OR rethinking OR …)` (≤4-word topics quoted as a phrase, longer ones grouped) | `conflicting` |

The student can change the stance per hit before saving (`POST /api/papers`)
and later via `PATCH /api/papers/[id]`. Saved hits use `source: "openalex"` and
the short work id (`W…`) as `external_id`.

## Environment variables

See `.env.example`. Plug values into **`.env.local`** (already present in this
repo — do not commit it). Restart the dev server after edits.

Mode switches are **env presence**, not source edits:

- Supabase live DB: both `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Fast coach: `GROQ_API_KEY` (primary when set; `GROQ_MODEL` optional)
- Live coach: `GEMINI_API_KEY` (`GEMINI_MODEL` optional, default `gemini-3.8-flash`)
- Paper search quota: `OPENALEX_API_KEY` (optional; search is live either way)
