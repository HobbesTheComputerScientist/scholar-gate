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
import {
  EXPERIENCE_LEVEL_LABELS,
  getStageProgress,
  type ResearchProject,
} from "@/lib/api-placeholder";
import { cn } from "@/lib/utils";

function formatCreatedAt(iso: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(iso));
}

function handleDelete(id: string) {
  // TODO: Implement backend delete API call
  console.log("Action triggered on item:", id);
}

export type ItemListProps = {
  items: ResearchProject[];
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
      {items.map((project) => {
        const { completedCount, total, percent } = getStageProgress(project);

        return (
          <li key={project.id} className="min-h-0">
            <Card className="flex h-full flex-col transition-shadow hover:shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-base leading-snug">
                  {project.name}
                </CardTitle>
                <CardDescription className="line-clamp-2">
                  {project.topicArea}
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-auto space-y-3 pb-3">
                <p className="text-xs text-muted-foreground">
                  {EXPERIENCE_LEVEL_LABELS[project.experienceLevel]}
                </p>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Milestone progress</span>
                    <span className="font-medium">
                      {completedCount}/{total}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Stage {project.currentStageId} · Started{" "}
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
                  onClick={() => {
                    handleDelete(project.id);
                    onDeleteProject?.(project.id);
                  }}
                >
                  Delete
                </Button>
              </CardFooter>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
