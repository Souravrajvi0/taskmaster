
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type TaskStatus = "scheduled" | "assigned" | "running" | "completed" | "failed";

interface StatusBadgeProps {
  status: TaskStatus;
  className?: string;
}

export function getTaskStatus(task: {
  picked_at: string;
  started_at: string;
  completed_at: string;
  failed_at: string;
}): TaskStatus {
  if (task.completed_at) return "completed";
  if (task.failed_at) return "failed";
  if (task.started_at) return "running";
  if (task.picked_at) return "assigned";
  return "scheduled";
}

const statusConfig: Record<TaskStatus, { label: string; className: string }> = {
  scheduled: {
    label: "Scheduled",
    className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  },
  assigned: {
    label: "Assigned",
    className: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
  },
  running: {
    label: "Running",
    className: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20 animate-pulse-slow",
  },
  completed: {
    label: "Completed",
    className: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  },
  failed: {
    label: "Failed",
    className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  
  return (
    <Badge 
      variant="outline" 
      className={cn(config.className, className)}
      data-testid={`badge-status-${status}`}
    >
      {config.label}
    </Badge>
  );
}

export function WorkerStatusBadge({ status }: { status: string }) {
  const isIdle = status === "idle";
  
  return (
    <Badge 
      variant="outline" 
      className={cn(
        isIdle 
          ? "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20"
          : "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20 animate-pulse-slow"
      )}
      data-testid={`badge-worker-${status}`}
    >
      {isIdle ? "Idle" : "Busy"}
    </Badge>
  );
}
