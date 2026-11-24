# Research Coach

An AI coach that helps undergraduates **start** a research project in any
field: learn the subject, read real papers, and land on a research question
they can defend. It teaches and critiques; it never writes the paper.

## What it does

- **Phase 1: Orient.** The coach teaches the topic in depth (intuition,
  mechanism, worked example, misconceptions, self-check), recommends real
  papers from OpenAlex, and fills in the student's profile as they talk.
  A comprehension check with AI-written subject questions and graded
  feedback gates Phase 2.
- **Phase 2: Find your question.** Search papers (general, foundational,
  counter-evidence), tag each one's stance, find gaps, and commit to one
  question with a novelty claim.
- **Project Brain.** Structured project state is the source of truth, not
  chat history. Every model call is rebuilt from it. Research-progress
  changes from the coach arrive as cards the student accepts or rejects.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind v4 + shadcn/ui · Supabase
(auth, Postgres, RLS) · Groq and Gemini for the coach · OpenAlex for papers ·
zod · Vitest.

## Run it locally

```bash
npm install
cp .env.example .env.local   # then fill in the keys you have
npm run dev                  # http://localhost:3000
```

Every key is optional:

| Set | You get |
| --- | --- |
| nothing | local accounts, in-memory data, a built-in heuristic coach |
| `GROQ_API_KEY` and/or `GEMINI_API_KEY` | the real AI coach (Groq first, Gemini fallback) |
| `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase sign-in and Postgres storage |

### Supabase

New database: run `supabase/migrations/0001_init.sql` in the SQL editor.
Existing database from an older schema: run
`supabase/migrations/0003_reconcile_live_schema.sql` (idempotent;
`supabase/diagnose_schema.sql` shows what is missing). Until the schema
matches, the app keeps project data in server memory and says so on screen.

## Scripts

```bash
npm run dev     # dev server
npm test        # unit tests (Vitest)
npm run lint    # ESLint
npm run build   # production build
```

## Docs

- `docs/PRODUCT.md`: product spec (phases, gates, data model)
- `CLAUDE.md`: architecture and conventions for contributors and AI agents
