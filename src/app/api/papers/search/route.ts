import { requireUser } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/http";
import { paperSearchInputSchema } from "@/lib/db/schema";
import { searchOpenAlex } from "@/lib/papers/openalex";

export async function GET(request: Request) {
  try {
    await requireUser();
    const url = new URL(request.url);
    const input = paperSearchInputSchema.parse({
      query: url.searchParams.get("query") ?? "",
      limit: url.searchParams.get("limit")
        ? Number(url.searchParams.get("limit"))
        : undefined,
      mode: url.searchParams.get("mode") ?? undefined,
    });
    const results = await searchOpenAlex(input.query, {
      mode: input.mode,
      limit: input.limit ?? 8,
    });
    return Response.json({ results, mode: input.mode });
  } catch (error) {
    return handleApiError(error);
  }
}
