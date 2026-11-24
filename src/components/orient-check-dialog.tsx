"use client";

import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { OrientCheck } from "@/lib/db/types";
import {
  MIN_ANSWER_WORDS,
  ORIENT_CHECK_PASS_SCORE,
  countWords,
} from "@/lib/orient/check";
import { cn } from "@/lib/utils";

type QuestionResult = {
  questionId: string;
  passed: boolean;
  reason: string;
  score?: number;
};

type Stage =
  | { kind: "intro" }
  | { kind: "answering"; check: OrientCheck }
  | { kind: "result"; check: OrientCheck; results: QuestionResult[] };

export type OrientCheckDialogProps = {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a passing submission so the workspace reloads the Brain. */
  onPassed: () => void;
};

export function OrientCheckDialog({
  projectId,
  open,
  onOpenChange,
  onPassed,
}: OrientCheckDialogProps) {
  const [stage, setStage] = useState<Stage>({ kind: "intro" });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    if (busy) return;
    if (!next) {
      setStage({ kind: "intro" });
      setAnswers({});
      setError(null);
    }
    onOpenChange(next);
  }

  async function post(body: Record<string, unknown>) {
    const response = await fetch(`/api/projects/${projectId}/orient-check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await response.json()) as {
      check?: OrientCheck;
      perQuestion?: QuestionResult[];
      error?: string;
    };
    if (!response.ok || !json.check) {
      throw new Error(json.error ?? "Comprehension check failed.");
    }
    return json as { check: OrientCheck; perQuestion?: QuestionResult[] };
  }

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const { check } = await post({ action: "start" });
      // Each attempt gets fresh questions, so start with empty answers.
      setAnswers({});
      setStage({ kind: "answering", check });
    } catch (startError) {
      setError(
        startError instanceof Error ? startError.message : "Could not start.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (stage.kind !== "answering") return;
    setBusy(true);
    setError(null);
    try {
      const { check, perQuestion } = await post({
        action: "submit",
        checkId: stage.check.id,
        answers: stage.check.questions.map((question) => ({
          questionId: question.id,
          answer: answers[question.id] ?? "",
        })),
      });
      setStage({ kind: "result", check, results: perQuestion ?? [] });
      if (check.passed) {
        onPassed();
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Could not submit.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Orient comprehension check</DialogTitle>
          <DialogDescription>
            Show you understand the subject behind your topic. You need{" "}
            {ORIENT_CHECK_PASS_SCORE}% to enter Phase 2.
          </DialogDescription>
        </DialogHeader>

        {stage.kind === "intro" ? (
          <div className="space-y-3 text-sm">
            <p>
              You&apos;ll get four questions: three about the subject matter of
              your topic (core concepts, how they work, and how they compare),
              written for your experience level and what the coach has taught
              you, plus one about how you would study your own question.
            </p>
            <p>
              Answer each in at least {MIN_ANSWER_WORDS} words, in your own
              words. Each answer is graded on understanding, and you&apos;ll get
              feedback on what to review.
            </p>
            <p className="text-muted-foreground">
              You can retake it as many times as you need.
            </p>
          </div>
        ) : null}

        {stage.kind === "answering" ? (
          <form id="orient-check-form" className="space-y-5" onSubmit={submit}>
            {stage.check.questions.map((question, index) => {
              const value = answers[question.id] ?? "";
              const wordCount = countWords(value);
              const enough = wordCount >= MIN_ANSWER_WORDS;
              return (
                <div key={question.id} className="space-y-1.5">
                  <label
                    htmlFor={`oc-${question.id}`}
                    className="block text-sm font-medium"
                  >
                    {index + 1}. {question.prompt}
                  </label>
                  {question.hint ? (
                    <p className="text-xs text-muted-foreground">
                      Hint: {question.hint}
                    </p>
                  ) : null}
                  <Textarea
                    id={`oc-${question.id}`}
                    rows={4}
                    value={value}
                    disabled={busy}
                    onChange={(event) =>
                      setAnswers((current) => ({
                        ...current,
                        [question.id]: event.target.value,
                      }))
                    }
                  />
                  <p
                    className={cn(
                      "text-right text-xs",
                      enough ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {wordCount} / {MIN_ANSWER_WORDS} words
                  </p>
                </div>
              );
            })}
          </form>
        ) : null}

        {stage.kind === "result" ? (
          <div className="space-y-4 text-sm">
            <div
              className={cn(
                "rounded-md border px-3 py-2",
                stage.check.passed
                  ? "border-primary/30 bg-primary/5"
                  : "border-destructive/30 bg-destructive/5",
              )}
            >
              <p className="font-medium">
                {stage.check.passed ? "Passed" : "Not yet"} · score{" "}
                {stage.check.score}%
              </p>
              <p className="text-xs text-muted-foreground">
                {stage.check.passed
                  ? "Phase 2 is unlocked once your other exit criteria are met."
                  : `You need ${ORIENT_CHECK_PASS_SCORE}%. Revise the answers marked below and retake.`}
              </p>
            </div>
            <ul className="space-y-2">
              {stage.check.questions.map((question, index) => {
                const result = stage.results.find(
                  (row) => row.questionId === question.id,
                );
                return (
                  <li key={question.id} className="flex gap-2 text-xs leading-relaxed">
                    <span
                      className={cn(
                        "mt-0.5 size-3.5 shrink-0 rounded-sm border",
                        result?.passed
                          ? "border-primary bg-primary"
                          : "border-destructive",
                      )}
                      aria-hidden
                    />
                    <span>
                      <span className="font-medium">
                        Q{index + 1}
                        {typeof result?.score === "number"
                          ? ` · ${result.score}%`
                          : ""}
                        .
                      </span>{" "}
                      {result?.reason ?? "Not graded."}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <DialogFooter>
          {stage.kind === "intro" ? (
            <Button type="button" disabled={busy} onClick={() => void start()}>
              {busy ? "Writing your questions…" : "Start check"}
            </Button>
          ) : null}
          {stage.kind === "answering" ? (
            <Button type="submit" form="orient-check-form" disabled={busy}>
              {busy ? "Grading your answers…" : "Submit answers"}
            </Button>
          ) : null}
          {stage.kind === "result" ? (
            stage.check.passed ? (
              <Button type="button" onClick={() => handleOpenChange(false)}>
                Done
              </Button>
            ) : (
              <Button type="button" disabled={busy} onClick={() => void start()}>
                {busy ? "Preparing…" : "Retake"}
              </Button>
            )
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
