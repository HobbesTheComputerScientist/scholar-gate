@AGENTS.md

# Research Coach

Web app that coaches undergrads through **starting** an AI/ML research paper.
MVP is **Phase 1 (Orient)** and **Phase 2 (Find your question)** only. No
experiments, methods, or paper drafting.

**Differentiator:** the model never treats chat history as memory. Structured
project state in Postgres (Project Brain) is the source of truth. Every model
call is assembled from DB rows by a pure function.

**Stack:** Next.js 16 App Router (`src/app`), TypeScript strict, Tailwind v4 +
shadcn/ui, Supabase (auth + Postgres + RLS), Anthropic from server routes only.

**Hard rules**
- API keys only in server code. Never `NEXT_PUBLIC_` for secrets.
- Cite only papers in the `papers` table. Never invent references.
- Coach and critique; do not ghostwrite.
- Model state changes are **proposed** patches; the user accepts/rejects.
- `lib/prompt/assemble.ts` stays a pure function with tests.
- All tables use RLS scoped to `auth.uid()`.
- Validate API input and tool output with zod.

## File tree

```
.
├── docs/PRODUCT.md              Product spec (phases, gates, tables)
├── supabase/migrations/0001_init.sql
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
│   │       ├── papers/search/route.ts Semantic Scholar
│   │       ├── patches/[id]/route.ts  accept/reject
│   │       └── projects/
│   │           ├── route.ts           list + create
│   │           └── [id]/
│   │               ├── route.ts       workspace GET/PATCH/DELETE
│   │               └── advance/route.ts phase gate
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
│   ├── ai/                        tools, Anthropic stream, localCoach
│   ├── papers/semantic-scholar.ts
│   ├── patches/apply.ts
│   └── summaries/rolling.ts       every 20 messages
└── .env.example
```

## Database schema

Defined in `supabase/migrations/0001_init.sql`. Apply in the Supabase SQL editor
or CLI. `auth.users` is owned by Supabase Auth; `profiles.id` references it.

| Table | Purpose |
| --- | --- |
| `profiles` | 1:1 with `auth.users` (email, display_name) |
| `projects` | `name` + `state jsonb` (Project Brain) |
| `papers` | Saved citable papers (`semantic_scholar` / `openalex` / `arxiv`) |
| `decisions` | Accepted student decisions |
| `messages` | Chat log (UI + rolling summary, not prompt memory) |
| `summaries` | Recap written every 20 messages |
| `proposed_patches` | Tool payloads: pending / accepted / rejected |

RLS: `auth.uid() = user_id` (profiles: `auth.uid() = id`). Trigger
`handle_new_user` inserts a profile on signup.

**Live vs local:** if `NEXT_PUBLIC_SUPABASE_URL` **and**
`NEXT_PUBLIC_SUPABASE_ANON_KEY` are set, `getRepo()` uses `supabase-repo`.
Otherwise it uses `memory-repo` (process memory, wiped on server restart).
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
}
```

Students can PATCH Brain fields directly (`/api/projects/[id]`). The coach
cannot change `phase`; `update_state` strips it. Phase 2 is unlocked only by
`POST /api/projects/[id]/advance` after Orient gates pass (`lib/phases/gates.ts`).

**Orient exit:** specific interest, background ≥ 20 chars, ≥1 constraint, ≥2
candidate questions.

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
are proposals) + phase brief + Brain JSON + checkbox exit criteria + allowed
papers + decisions + latest summary.

**User string:** recent DB messages + the new student message.

Chat does **not** send a growing Anthropic transcript. Persistence is Brain +
papers + decisions + summaries.

## Coach tools

Validated in `lib/db/schema.ts` before insert:

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
| `GET /api/papers/search` | Semantic Scholar (live HTTP) |
| `POST /api/papers` | save paper to project |
| `POST /api/patches/[id]` | accept / reject |

## Live vs stubbed

| Piece | Live | Fallback / stub |
| --- | --- | --- |
| UI workspace (3 panels) | Live | — |
| Auth + DB | Supabase when both public env vars set | In-memory repo + cookie auth |
| Coach | Anthropic Messages stream when `ANTHROPIC_API_KEY` is set | `lib/ai/local-coach.ts` heuristics |
| Paper search | Semantic Scholar Graph API | Optional `SEMANTIC_SCHOLAR_API_KEY` for quota; no key still calls S2 |
| OpenAlex / arXiv fetch | **Not implemented** (source enum only) | — |
| Gemini | **Not referenced** | Do not set `GEMINI_API_KEY`; it is unused |
| Rolling summary | Writes a `summaries` row every 20 messages | Uses assembled context, not a second model call unless Anthropic is used for chat |
| Zod / Anthropic SDK | Imported | Add `zod` and `@anthropic-ai/sdk` to `package.json` if missing, then `npm install` |

## Environment variables

See `.env.example`. Plug values into **`.env.local`** (already present in this
repo — do not commit it). Restart the dev server after edits.

Mode switches are **env presence**, not source edits:

- Supabase live DB: both `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Live coach: `ANTHROPIC_API_KEY`
