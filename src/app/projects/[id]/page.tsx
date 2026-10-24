"use client";

import { use } from "react";

import { WorkspaceShell } from "@/src/components/workspace-shell";

export default function ProjectWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <WorkspaceShell projectId={id} />;
}
