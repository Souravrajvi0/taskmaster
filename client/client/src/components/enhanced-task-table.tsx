import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow, differenceInSeconds } from "date-fns";

interface Task {
  task_id: string;
  command: string;
  scheduled_at: string;
  picked_at: string;
  started_at: string;
  completed_at: string;
  failed_at: string;
  worker_id: number | null;
}

function getStatus(task: Task) {
  if (task.failed_at) return "failed";
  if (task.completed_at) return "completed";
  if (task.started_at) return "running";
  if (task.picked_at) return "assigned";
  if (task.scheduled_at) return "pending";
  return "unknown";
}

function getDuration(task: Task) {
  const start = task.started_at
    ? new Date(task.started_at)
    : task.picked_at
      ? new Date(task.picked_at)
      : null;

  if (!start) return null;

  const end = task.completed_at
    ? new Date(task.completed_at)
    : task.failed_at
      ? new Date(task.failed_at)
      : new Date();

  return differenceInSeconds(end, start);
}

function getProgress(task: Task) {
  const status = getStatus(task);
  const map: Record<string, number> = {
    pending: 10,
    assigned: 30,
    running: 70,
    completed: 100,
    failed: 50,
  };
  return map[status] || 0;
}

function getStatusColor(status: string) {
  const map: Record<string, string> = {
    pending: "secondary",
    assigned: "outline",
    running: "default",
    completed: "default",
    failed: "destructive",
  };
  return map[status] || "secondary";
}

export function EnhancedTaskTable({ tasks }: { tasks: Task[] | undefined }) {
  if (!tasks || tasks.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Tasks (Live)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No tasks yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          Tasks (Live) — {tasks.length} total
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96">
          <div className="space-y-2 pr-4">
            {tasks.map((task) => {
              const status = getStatus(task);
              const duration = getDuration(task);
              const progress = getProgress(task);

              return (
                <div
                  key={task.task_id}
                  className="p-3 border rounded-md space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <code className="font-mono text-xs truncate flex-1">
                      {task.task_id.substring(0, 12)}...
                    </code>
                    <Badge variant={getStatusColor(status) as any}>
                      {status}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground min-w-16">
                      Worker:
                    </span>
                    {task.worker_id ? (
                      <Badge variant="outline">W{task.worker_id}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Progress value={progress} className="h-2" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{task.command}</span>
                      {duration !== null && (
                        <span className="font-mono">{duration}s</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
