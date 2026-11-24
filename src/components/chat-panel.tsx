"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ChatMessage, ProposedPatch } from "@/lib/db/types";

export function ChatPanel({
  messages,
  sending,
  onSend,
}: {
  messages: ChatMessage[];
  sending: boolean;
  onSend: (message: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll only the message list. scrollIntoView would also scroll the page.
  useEffect(() => {
    const list = scrollRef.current;
    if (list) {
      list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
    }
  }, [messages, sending]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending) {
      return;
    }
    setDraft("");
    await onSend(text);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1"
      >
        {messages.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-700 bg-slate-950/40 px-4 py-3 text-sm text-muted-foreground">
            Tell the coach what you are curious about. It will ask questions and
            suggest updates to your Project Brain for you to review.
          </p>
        ) : null}
        {messages.map((message) => (
          <article
            key={message.id}
            className={
              message.role === "user"
                ? "ml-8 rounded-xl rounded-br-sm border border-sky-400/25 bg-sky-400/10 px-3 py-2 text-sm"
                : "mr-8 rounded-xl rounded-bl-sm border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm"
            }
          >
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {message.role === "user" ? "You" : "Coach"}
            </p>
            <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
          </article>
        ))}
        {sending ? (
          <p className="text-xs text-muted-foreground">Coach is thinking…</p>
        ) : null}
      </div>
      <form className="mt-3 space-y-2 border-t border-slate-800 pt-3" onSubmit={handleSubmit}>
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Write in your own words…"
          disabled={sending}
          rows={3}
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={sending || draft.trim().length === 0}>
            Send
          </Button>
        </div>
      </form>
    </div>
  );
}

export async function streamChat(
  projectId: string,
  message: string,
  onEvent: (event: {
    type: string;
    delta?: string;
    patch?: ProposedPatch;
    message?: string;
  }) => void,
) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, message }),
  });
  if (!response.ok || !response.body) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(body.error ?? "Chat request failed.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";
    for (const chunk of chunks) {
      const line = chunk
        .split("\n")
        .find((entry) => entry.startsWith("data: "));
      if (!line) {
        continue;
      }
      onEvent(JSON.parse(line.slice(6)) as Parameters<typeof onEvent>[0]);
    }
  }
}
