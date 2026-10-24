import { requireUser } from "@/lib/auth/session";
import { handleApiError, jsonError } from "@/lib/api/http";
import { runCoach } from "@/lib/ai/run-coach";
import { chatInputSchema, validateToolOutput } from "@/lib/db/schema";
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

          if (assistant.trim()) {
            await repo.insertMessage({
              userId: user.id,
              projectId,
              role: "assistant",
              content: assistant,
            });
          }

          await maybeWriteRollingSummary(repo, user.id, project);
          send({ type: "done" });
        } catch (error) {
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
