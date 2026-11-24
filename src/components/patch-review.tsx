"use client";

import type { ReactNode } from "react";
import { BookPlus, Brain, Check, Gavel, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MILESTONE_LABELS, type MilestoneId, type ProposedPatch } from "@/lib/db/types";

const TOOL_META: Record<
  ProposedPatch["tool"],
  { label: string; target: string; icon: typeof Brain }
> = {
  update_state: { label: "Update Project Brain", target: "Brain", icon: Brain },
  add_paper: { label: "Save a paper", target: "Saved papers", icon: BookPlus },
  log_decision: { label: "Log a decision", target: "Decisions", icon: Gavel },
};

const FIELD_LABELS: Record<string, string> = {
  interest: "Interest",
  background: "Background",
  experienceLevel: "Experience",
  constraints: "Constraints",
  candidateQuestions: "Candidate questions",
  chosenQuestion: "Chosen question",
  noveltyClaim: "Novelty / gap claim",
  openQuestions: "Open questions",
  milestones: "Milestones",
  studentTakeaways: "Your takeaways",
  identifiedGaps: "Identified gaps",
  conflictingEvidenceNotes: "Conflicting-evidence notes",
};

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
      <p className="rounded-lg border border-dashed border-slate-800 px-3 py-2.5 text-xs text-slate-400">
        Nothing to review. When the coach suggests a change to your Brain,
        papers, or decisions, it waits here until you accept or reject it.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {patches.map((patch) => {
        const meta = TOOL_META[patch.tool];
        const Icon = meta.icon;
        const busy = busyId === patch.id;
        return (
          <li
            key={patch.id}
            className="overflow-hidden rounded-xl border border-indigo-500/40 bg-gradient-to-b from-indigo-500/15 to-slate-900 shadow-lg shadow-indigo-950/40 ring-1 ring-inset ring-white/5"
          >
            <div className="flex items-center gap-2 border-b border-indigo-500/20 px-3 py-2">
              <span className="flex size-6 items-center justify-center rounded-md bg-indigo-500/20 text-indigo-300">
                <Icon className="size-3.5" aria-hidden />
              </span>
              <p className="flex-1 text-xs font-semibold text-indigo-100">
                {meta.label}
              </p>
              <span className="text-[10px] uppercase tracking-wide text-slate-400">
                → {meta.target}
              </span>
            </div>
            <div className="space-y-2 px-3 py-2.5 text-xs text-slate-200">
              <PatchBody patch={patch} />
              <details className="text-[11px] text-slate-500">
                <summary className="cursor-pointer select-none hover:text-slate-300">
                  Raw payload
                </summary>
                <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded-md bg-slate-950/70 p-2 leading-relaxed">
                  {JSON.stringify(patch.payload, null, 2)}
                </pre>
              </details>
            </div>
            <div className="grid grid-cols-2 gap-2 border-t border-slate-800 bg-slate-950/40 p-2">
              <Button
                type="button"
                size="sm"
                disabled={busy}
                className="bg-sky-400 font-semibold text-slate-950 shadow-sm shadow-sky-400/30 hover:bg-sky-300 active:translate-y-px"
                onClick={() => onResolve(patch.id, "accepted")}
              >
                <Check aria-hidden />
                Accept
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                className="border-slate-700 bg-slate-900 text-slate-200 hover:border-red-500/60 hover:bg-red-500/10 hover:text-red-200 active:translate-y-px"
                onClick={() => onResolve(patch.id, "rejected")}
              >
                <X aria-hidden />
                Reject
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function PatchBody({ patch }: { patch: ProposedPatch }) {
  const payload = patch.payload;
  if (patch.tool === "add_paper") {
    const authors = Array.isArray(payload.authors)
      ? (payload.authors as string[])
      : [];
    return (
      <div className="space-y-1">
        <p className="font-medium leading-snug text-slate-100">
          {String(payload.title ?? "Untitled")}
        </p>
        <p className="text-[11px] text-slate-400">
          {[
            authors.slice(0, 3).join(", ") + (authors.length > 3 ? " et al." : ""),
            payload.year ?? payload.publicationYear,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {payload.stance ? (
          <Pill>stance: {String(payload.stance)}</Pill>
        ) : null}
      </div>
    );
  }
  if (patch.tool === "log_decision") {
    return (
      <div className="space-y-1">
        <p className="font-medium text-slate-100">{String(payload.summary ?? "")}</p>
        {payload.rationale ? (
          <p className="text-[11px] text-slate-400">
            Why: {String(payload.rationale)}
          </p>
        ) : null}
      </div>
    );
  }
  return (
    <dl className="space-y-1.5">
      {Object.entries(payload).map(([key, value]) => (
        <div key={key}>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-indigo-300">
            {FIELD_LABELS[key] ?? key}
          </dt>
          <dd className="mt-0.5">{renderValue(key, value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function renderValue(key: string, value: unknown): ReactNode {
  if (value === null || value === undefined || value === "") {
    return <span className="italic text-slate-500">cleared</span>;
  }
  if (key === "milestones" && typeof value === "object") {
    return (
      <ul className="space-y-0.5">
        {Object.entries(value as Record<string, string>).map(([id, status]) => (
          <li key={id}>
            {MILESTONE_LABELS[id as MilestoneId] ?? id}:{" "}
            <span className="text-sky-300">{status.replace("_", " ")}</span>
          </li>
        ))}
      </ul>
    );
  }
  if (Array.isArray(value)) {
    return (
      <ul className="list-disc space-y-0.5 pl-4">
        {value.map((item, index) => (
          <li key={index}>
            {typeof item === "object" && item && "text" in item
              ? String((item as { text: unknown }).text)
              : String(item)}
          </li>
        ))}
      </ul>
    );
  }
  return <span className="whitespace-pre-wrap">{String(value)}</span>;
}

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
      {children}
    </span>
  );
}
