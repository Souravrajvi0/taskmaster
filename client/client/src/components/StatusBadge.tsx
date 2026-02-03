import { cn } from "@/lib/utils";
import { TaskState } from "./Timeline";

interface StatusBadgeProps {
  status: TaskState;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const styles = {
    scheduled: "bg-blue-100 text-blue-700 border-blue-200",
    picked: "bg-yellow-100 text-yellow-700 border-yellow-200",
    running: "bg-orange-100 text-orange-700 border-orange-200 animate-pulse",
    completed: "bg-green-100 text-green-700 border-green-200",
    failed: "bg-red-100 text-red-700 border-red-200",
    unknown: "bg-gray-100 text-gray-700 border-gray-200",
  };

  const labels = {
    scheduled: "Scheduled",
    picked: "Assigned",
    running: "In Progress",
    completed: "Success",
    failed: "Failed",
    unknown: "Unknown",
  };

  return (
    <span className={cn(
      "px-3 py-1 rounded-full text-xs font-semibold border uppercase tracking-wider",
      styles[status],
      className
    )}>
      {labels[status]}
    </span>
  );
}
