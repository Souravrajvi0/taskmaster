
import { z } from "zod";

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
  }),
  notFound: z.object({
    error: z.string(),
  }),
  internal: z.object({
    error: z.string(),
  }),
};

export const api = {
  tasks: {
    schedule: {
      method: "POST" as const,
      path: "/api/schedule",
      input: z.object({
        command: z.string().min(1, "Command is required"),
        scheduled_at: z.string().datetime({ message: "Invalid ISO 8601 date format" }),
      }),
      responses: {
        200: z.object({
          command: z.string(),
          scheduled_at: z.number(),
          task_id: z.string(),
        }),
        400: errorSchemas.validation,
      },
    },
    status: {
      method: "GET" as const,
      path: "/api/status",
      input: z.object({
        task_id: z.string().uuid("Task ID is required"),
      }),
      responses: {
        200: z.object({
          task_id: z.string(),
          command: z.string(),
          scheduled_at: z.string(),
          picked_at: z.string(),
          started_at: z.string(),
          completed_at: z.string(),
          failed_at: z.string(),
          worker_id: z.number().nullable(),
        }),
        404: errorSchemas.notFound,
      },
    },
    list: {
      method: "GET" as const,
      path: "/api/tasks",
      responses: {
        200: z.array(z.object({
          task_id: z.string(),
          command: z.string(),
          scheduled_at: z.string(),
          picked_at: z.string(),
          started_at: z.string(),
          completed_at: z.string(),
          failed_at: z.string(),
          worker_id: z.number().nullable(),
        })),
      },
    },
  },
  workers: {
    list: {
      method: "GET" as const,
      path: "/api/workers",
      responses: {
        200: z.array(z.object({
          id: z.number(),
          name: z.string(),
          status: z.string(),
          current_task_id: z.string().nullable(),
          tasks_completed: z.number(),
          last_active_at: z.string().nullable(),
        })),
      },
    },
  },
  system: {
    stats: {
      method: "GET" as const,
      path: "/api/stats",
      responses: {
        200: z.object({
          total_tasks: z.number(),
          pending_tasks: z.number(),
          running_tasks: z.number(),
          completed_tasks: z.number(),
          failed_tasks: z.number(),
          workers: z.array(z.object({
            id: z.number(),
            name: z.string(),
            status: z.string(),
            current_task_id: z.string().nullable(),
            tasks_completed: z.number(),
            last_active_at: z.string().nullable(),
          })),
        }),
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
