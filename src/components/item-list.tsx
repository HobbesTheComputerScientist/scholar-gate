"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EXPERIENCE_LEVEL_LABELS, PHASE_LABELS, type Project } from "@/lib/db/types";
import { cn } from "@/lib/utils";

function formatCreatedAt(iso: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(iso));
}

export type ItemListProps = {
  items: Project[];
  className?: string;
  onOpenProject: (projectId: string) => void;
  onDeleteProject?: (projectId: string) => void;
};

export function ItemList({
  items,
  className,
  onOpenProject,
  onDeleteProject,
}: ItemListProps) {
  return (
    <ul
      className={cn(
        "grid list-none gap-4 p-0 m-0 sm:grid-cols-2 lg:grid-cols-3",
        className,
      )}
    >
      {items.map((project) => (
        <li key={project.id} className="min-h-0">
          <Card className="flex h-full flex-col transition-shadow hover:shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-base leading-snug">
                {project.name}
              </CardTitle>
              <CardDescription className="line-clamp-2">
                {project.state.interest || "No topic yet"}
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-auto space-y-2 pb-3">
              <p className="text-xs text-muted-foreground">
                {EXPERIENCE_LEVEL_LABELS[project.state.experienceLevel]}
              </p>
              <p className="text-xs text-muted-foreground">
                {PHASE_LABELS[project.state.phase]} · Started{" "}
                {formatCreatedAt(project.createdAt)}
              </p>
            </CardContent>
            <CardFooter className="flex gap-2 border-t bg-muted/30 pt-4">
              <Button
                type="button"
                variant="default"
                size="sm"
                className="flex-1"
                onClick={() => onOpenProject(project.id)}
              >
                Open workspace
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => onDeleteProject?.(project.id)}
              >
                Delete
              </Button>
            </CardFooter>
          </Card>
        </li>
      ))}
    </ul>
  );
}
