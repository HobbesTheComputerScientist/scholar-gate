"use client";

import { Button } from "@/components/ui/button";
import type { ProposedPatch } from "@/lib/db/types";

export function PatchReview({
  patches,
  busyId,
  onResolve,
}: {
  patches: ProposedPatch[];
  busyId: string | null;
  onResolve: (id: string, action: "accepted" | "rejected") => void;
}) {
  if (patches.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No pending coach patches. Brain edits you type yourself save directly.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {patches.map((patch) => (
        <li key={patch.id} className="rounded-md border bg-muted/30 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {patch.tool}
          </p>
          <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed">
            {JSON.stringify(patch.payload, null, 2)}
          </pre>
          <div className="mt-2 flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={busyId === patch.id}
              onClick={() => onResolve(patch.id, "accepted")}
            >
              Accept
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busyId === patch.id}
              onClick={() => onResolve(patch.id, "rejected")}
            >
              Reject
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
