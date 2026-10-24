import { requireUser } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/http";
import { paperSearchInputSchema } from "@/lib/db/schema";
import { searchSemanticScholar } from "@/lib/papers/semantic-scholar";

export async function GET(request: Request) {
  try {
    await requireUser();
    const url = new URL(request.url);
    const input = paperSearchInputSchema.parse({
      query: url.searchParams.get("query") ?? "",
      limit: url.searchParams.get("limit")
        ? Number(url.searchParams.get("limit"))
        : undefined,
    });
    const results = await searchSemanticScholar(input.query, input.limit ?? 8);
    return Response.json({ results });
  } catch (error) {
    return handleApiError(error);
  }
}
