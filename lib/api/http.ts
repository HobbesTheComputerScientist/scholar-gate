import { ZodError } from "zod";

import { AuthRequiredError } from "@/lib/auth/session";

export function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export function handleApiError(error: unknown) {
  if (error instanceof AuthRequiredError) {
    return jsonError(error.message, 401);
  }
  if (error instanceof ZodError) {
    return jsonError(error.issues[0]?.message ?? "Invalid input.", 400);
  }
  if (error instanceof Error) {
    return jsonError(error.message, 400);
  }
  return jsonError("Unexpected error.", 500);
}
