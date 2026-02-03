import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";

// Types derived from schema/routes
type ScheduleTaskInput = z.infer<typeof api.tasks.schedule.input>;
type TaskStatusResponse = z.infer<typeof api.tasks.status.responses[200]>;

// Local storage key
const STORAGE_KEY = "taskmaster_local_tasks";

interface LocalTask {
  id: string;
  command: string;
  createdAt: number;
}

// === API HOOKS ===

// POST /api/schedule
export function useScheduleTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { addLocalTask } = useLocalTasks();

  return useMutation({
    mutationFn: async (data: ScheduleTaskInput) => {
      const res = await fetch(api.tasks.schedule.path, {
        method: api.tasks.schedule.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to schedule task");
      }

      return api.tasks.schedule.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      // Save to local storage for the dashboard
      addLocalTask({
        id: data.task_id,
        command: data.command,
        createdAt: Date.now(),
      });
      
      toast({
        title: "Task Scheduled",
        description: `Task ID: ${data.task_id} has been queued.`,
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Scheduling Failed",
        description: error.message,
      });
    },
  });
}

// GET /api/status?task_id=:id
export function useTaskStatus(taskId: string | null) {
  return useQuery({
    queryKey: [api.tasks.status.path, taskId],
    queryFn: async () => {
      if (!taskId) return null;
      
      // Construct URL with query param
      const url = `${api.tasks.status.path}?task_id=${taskId}`;
      
      const res = await fetch(url, { credentials: "include" });
      
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch task status");
      
      return api.tasks.status.responses[200].parse(await res.json());
    },
    enabled: !!taskId,
    // Poll every 3 seconds while active
    refetchInterval: (query) => {
      const data = query.state.data as TaskStatusResponse | undefined;
      if (!data) return 3000;
      
      // Stop polling if completed or failed
      if (data.completed_at !== "null" && data.completed_at) return false;
      if (data.failed_at !== "null" && data.failed_at) return false;
      
      return 3000;
    },
  });
}

// === LOCAL STORAGE HOOK ===

export function useLocalTasks() {
  const [tasks, setTasks] = useState<LocalTask[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setTasks(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse local tasks", e);
      }
    }
  }, []);

  const addLocalTask = (task: LocalTask) => {
    const newTasks = [task, ...tasks];
    setTasks(newTasks);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newTasks));
  };

  const clearTasks = () => {
    setTasks([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  return { tasks, addLocalTask, clearTasks };
}

// === HELPERS ===

export function getTaskState(status: TaskStatusResponse | undefined | null) {
  if (!status) return "unknown";
  if (status.failed_at && status.failed_at !== "null") return "failed";
  if (status.completed_at && status.completed_at !== "null") return "completed";
  if (status.started_at && status.started_at !== "null") return "running";
  if (status.picked_at && status.picked_at !== "null") return "picked";
  return "scheduled";
}
