import { requireUser } from "@/lib/auth/session";
import { handleApiError, jsonError } from "@/lib/api/http";
import { formatReadings } from "@/lib/ai/readings";
import type { PaperHit } from "@/lib/papers/openalex";
import { runCoach } from "@/lib/ai/run-coach";
import {
  chatInputSchema,
  updateProfilePayloadSchema,
  validateToolOutput,
} from "@/lib/db/schema";
import { getRepo } from "@/lib/db/server";
import { maybeWriteRollingSummary } from "@/lib/summaries/rolling";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const { projectId, message } = chatInputSchema.parse(await request.json());
    const repo = await getRepo();
    const project = await repo.getProject(user.id, projectId);
    if (!project) {
      return jsonError("Project not found.", 404);
    }

    await repo.insertMessage({
      userId: user.id,
      projectId,
      role: "user",
      content: message,
    });

    const [papers, decisions, recent, latest] = await Promise.all([
      repo.listPapers(user.id, projectId),
      repo.listDecisions(user.id, projectId),
      repo.listRecentMessages(user.id, projectId, 12),
      repo.latestSummary(user.id, projectId),
    ]);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (payload: unknown) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(payload)}\n\n`),
          );
        };

        let assistant = "";
        let currentProject = project;
        const readingQueries: string[] = [];
        const readingHits: PaperHit[] = [];
        try {
          for await (const event of runCoach({
            projectName: project.name,
            state: project.state,
            papers,
            decisions,
            latestSummary: latest?.content ?? null,
            recentMessages: recent,
            userMessage: message,
          })) {
            if (event.type === "text") {
              assistant += event.delta;
              send({ type: "text", delta: event.delta });
            } else if (event.type === "notice") {
              send({ type: "notice", message: event.message });
            } else if (event.type === "readings") {
              readingQueries.push(...event.queries);
              for (const hit of event.hits) {
                if (!readingHits.some((row) => row.externalId === hit.externalId)) {
                  readingHits.push(hit);
                }
              }
            } else if (event.type === "profile") {
              // Profile fields are filled in directly at the student's request.
              const profile = updateProfilePayloadSchema.parse(event.payload);
              currentProject = await repo.updateProjectState(
                user.id,
                projectId,
                { ...currentProject.state, ...profile },
              );
              send({ type: "profile", fields: Object.keys(profile) });
            } else {
              try {
                const validated = validateToolOutput(event.tool, event.payload);
                const patch = await repo.insertPatch({
                  userId: user.id,
                  projectId,
                  tool: validated.tool,
                  payload: validated.payload as Record<string, unknown>,
                });
                send({ type: "patch", patch });
              } catch {
                send({
                  type: "notice",
                  message: "Dropped an invalid model tool payload.",
                });
              }
            }
          }

          if (readingQueries.length > 0) {
            const unique = [...new Set(readingQueries)];
            const block = formatReadings(unique, readingHits.slice(0, 8));
            assistant += block;
            send({ type: "text", delta: block });
          }

          if (assistant.trim()) {
            await repo.insertMessage({
              userId: user.id,
              projectId,
              role: "assistant",
              content: assistant,
            });
          }

          await maybeWriteRollingSummary(repo, user.id, currentProject);
          send({ type: "done" });
        } catch (error) {
          // Save whatever the coach managed to write so it is not lost.
          if (assistant.trim()) {
            await repo
              .insertMessage({
                userId: user.id,
                projectId,
                role: "assistant",
                content: assistant,
              })
              .catch(() => undefined);
          }
          send({
            type: "error",
            message:
              error instanceof Error ? error.message : "Coach failed.",
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
