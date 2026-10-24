import Anthropic from "@anthropic-ai/sdk";

import { coachTools } from "@/lib/ai/tools";
import { localCoach } from "@/lib/ai/local-coach";
import { validateToolOutput } from "@/lib/db/schema";
import type { PatchTool } from "@/lib/db/types";
import type { AssembleInput } from "@/lib/prompt/assemble";
import { assemblePrompt } from "@/lib/prompt/assemble";

export type CoachEvent =
  | { type: "text"; delta: string }
  | {
      type: "patch";
      tool: PatchTool;
      payload: Record<string, unknown>;
    };

export async function* runCoach(
  input: AssembleInput,
): AsyncGenerator<CoachEvent> {
  const assembled = assemblePrompt(input);
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    const result = localCoach(input);
    yield { type: "text", delta: result.text };
    for (const patch of result.patches) {
      try {
        const validated = validateToolOutput(patch.tool, patch.payload);
        yield {
          type: "patch",
          tool: validated.tool,
          payload: validated.payload as Record<string, unknown>,
        };
      } catch {
        // Drop invalid local patches.
      }
    }
    return;
  }

  const client = new Anthropic({ apiKey });
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";
  const stream = client.messages.stream({
    model,
    max_tokens: 1600,
    system: assembled.system,
    tools: coachTools,
    messages: [{ role: "user", content: assembled.user }],
  });

  const toolBuffers = new Map<number, { name: string; json: string }>();

  for await (const event of stream) {
    if (
      event.type === "content_block_start" &&
      event.content_block.type === "tool_use"
    ) {
      toolBuffers.set(event.index, {
        name: event.content_block.name,
        json: "",
      });
    } else if (event.type === "content_block_delta") {
      if (event.delta.type === "text_delta") {
        yield { type: "text", delta: event.delta.text };
      }
      if (event.delta.type === "input_json_delta") {
        const buffer = toolBuffers.get(event.index);
        if (buffer) {
          buffer.json += event.delta.partial_json;
        }
      }
    } else if (event.type === "content_block_stop") {
      const buffer = toolBuffers.get(event.index);
      if (!buffer) {
        continue;
      }
      try {
        const payload = JSON.parse(buffer.json || "{}") as unknown;
        const validated = validateToolOutput(buffer.name, payload);
        yield {
          type: "patch",
          tool: validated.tool,
          payload: validated.payload as Record<string, unknown>,
        };
      } catch {
        // Invalid tool JSON is ignored; the student never sees a bad write.
      }
    }
  }
}
