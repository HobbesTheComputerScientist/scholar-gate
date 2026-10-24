"use client";

import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Paper } from "@/lib/db/types";
import type { ScholarHit } from "@/lib/papers/semantic-scholar";

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
  const [hits, setHits] = useState<ScholarHit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearching(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/papers/search?query=${encodeURIComponent(query)}`,
      );
      const body = (await response.json()) as {
        results?: ScholarHit[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(body.error ?? "Search failed.");
      }
      setHits(body.results ?? []);
    } catch (searchError) {
      setError(
        searchError instanceof Error ? searchError.message : "Search failed.",
      );
    } finally {
      setSearching(false);
    }
  }

  async function saveHit(hit: ScholarHit) {
    setSavingId(hit.externalId);
    setError(null);
    try {
      const response = await fetch("/api/papers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, ...hit }),
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
      <form className="flex gap-2" onSubmit={handleSearch}>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search Semantic Scholar"
          minLength={2}
          required
        />
        <Button type="submit" size="sm" disabled={searching}>
          {searching ? "…" : "Search"}
        </Button>
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
              </p>
              <Button
                type="button"
                size="sm"
                className="mt-2"
                disabled={savingId === hit.externalId}
                onClick={() => void saveHit(hit)}
              >
                Save to project
              </Button>
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
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
