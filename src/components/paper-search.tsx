"use client";

import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PAPER_STANCES, type Paper, type PaperStance } from "@/lib/db/types";
import {
  DEFAULT_STANCE_FOR_MODE,
  type PaperHit,
  type PaperSearchMode,
} from "@/lib/papers/openalex";

const MODE_LABELS: Record<PaperSearchMode, string> = {
  general: "General",
  foundational: "Foundational",
  conflicting: "Counter-evidence",
};

const MODE_HINTS: Record<PaperSearchMode, string> = {
  general: "Best matches for your query.",
  foundational: "Most-cited work on the topic: where the field starts.",
  conflicting: "Critiques, failure cases, and replications that push back.",
};

const selectClass =
  "h-8 rounded-md border border-input bg-transparent px-2 text-xs";

export function PaperSearch({
  projectId,
  papers,
  onSaved,
}: {
  projectId: string;
  papers: Paper[];
  onSaved: (paper: Paper) => void;
}) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<PaperSearchMode>("general");
  const [hits, setHits] = useState<PaperHit[]>([]);
  const [stances, setStances] = useState<Record<string, PaperStance>>({});
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearching(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/papers/search?${new URLSearchParams({ query, mode }).toString()}`,
      );
      const body = (await response.json()) as {
        results?: PaperHit[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(body.error ?? "Search failed.");
      }
      const results = body.results ?? [];
      setHits(results);
      // Default each hit's stance from the search mode; the student can change it.
      setStances(
        Object.fromEntries(
          results.map((hit) => [hit.externalId, DEFAULT_STANCE_FOR_MODE[mode]]),
        ),
      );
    } catch (searchError) {
      setError(
        searchError instanceof Error ? searchError.message : "Search failed.",
      );
    } finally {
      setSearching(false);
    }
  }

  async function saveHit(hit: PaperHit) {
    const stance = stances[hit.externalId] ?? DEFAULT_STANCE_FOR_MODE[mode];
    setSavingId(hit.externalId);
    setError(null);
    try {
      const response = await fetch("/api/papers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, ...hit, stance }),
      });
      const body = (await response.json()) as { paper?: Paper; error?: string };
      if (!response.ok || !body.paper) {
        throw new Error(body.error ?? "Could not save paper.");
      }
      onSaved(body.paper);
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Could not save paper.",
      );
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-3">
      <form className="space-y-2" onSubmit={handleSearch}>
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search OpenAlex"
            minLength={2}
            required
          />
          <Button type="submit" size="sm" disabled={searching}>
            {searching ? "…" : "Search"}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <select
            aria-label="Search mode"
            className={selectClass}
            value={mode}
            onChange={(event) => setMode(event.target.value as PaperSearchMode)}
          >
            {(Object.keys(MODE_LABELS) as PaperSearchMode[]).map((value) => (
              <option key={value} value={value}>
                {MODE_LABELS[value]}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-muted-foreground">{MODE_HINTS[mode]}</p>
        </div>
      </form>
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {hits.length > 0 ? (
        <ul className="space-y-2">
          {hits.map((hit) => (
            <li key={hit.externalId} className="rounded-md border p-2 text-xs">
              <p className="font-medium">{hit.title}</p>
              <p className="text-muted-foreground">
                {hit.authors.slice(0, 3).join(", ")}
                {hit.year ? ` · ${hit.year}` : ""}
                {hit.citationCount !== null
                  ? ` · ${hit.citationCount} citations`
                  : ""}
              </p>
              {hit.abstract ? (
                <p className="mt-1 line-clamp-3 text-muted-foreground">
                  {hit.abstract}
                </p>
              ) : null}
              <div className="mt-2 flex items-center gap-2">
                <select
                  aria-label="Stance"
                  className={selectClass}
                  value={stances[hit.externalId] ?? DEFAULT_STANCE_FOR_MODE[mode]}
                  onChange={(event) =>
                    setStances((current) => ({
                      ...current,
                      [hit.externalId]: event.target.value as PaperStance,
                    }))
                  }
                >
                  {PAPER_STANCES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  size="sm"
                  disabled={savingId === hit.externalId}
                  onClick={() => void saveHit(hit)}
                >
                  Save to project
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      <div>
        <p className="mb-1 text-xs font-medium">Saved papers ({papers.length})</p>
        {papers.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            The coach may only cite papers listed here.
          </p>
        ) : (
          <ul className="space-y-1">
            {papers.map((paper) => (
              <li key={paper.id} className="text-xs">
                {paper.title}
                {paper.year ? ` (${paper.year})` : ""}
                <span className="text-muted-foreground"> · {paper.stance}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
