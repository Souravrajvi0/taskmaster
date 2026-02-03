
import { pgTable, text, timestamp, uuid, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  command: text("command").notNull(),
  scheduledAt: timestamp("scheduled_at").notNull(),
  pickedAt: timestamp("picked_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  failedAt: timestamp("failed_at"),
  workerId: integer("worker_id"), // Which worker is handling this task
});

export const workers = pgTable("workers", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  status: text("status").notNull().default("idle"), // idle, busy
  currentTaskId: uuid("current_task_id"),
  tasksCompleted: integer("tasks_completed").notNull().default(0),
  lastActiveAt: timestamp("last_active_at"),
});

export const insertTaskSchema = createInsertSchema(tasks).pick({
  command: true,
  scheduledAt: true,
});

export const insertWorkerSchema = createInsertSchema(workers).pick({
  id: true,
  name: true,
});

export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Worker = typeof workers.$inferSelect;
export type InsertWorker = z.infer<typeof insertWorkerSchema>;

// Request Types
export type ScheduleTaskRequest = {
  command: string;
  scheduled_at: string;
};

export type TaskStatusResponse = {
  task_id: string;
  command: string;
  scheduled_at: string;
  picked_at: string;
  started_at: string;
  completed_at: string;
  failed_at: string;
  worker_id: number | null;
};

export type WorkerStatusResponse = {
  id: number;
  name: string;
  status: string;
  current_task_id: string | null;
  tasks_completed: number;
  last_active_at: string | null;
};

export type SystemStatsResponse = {
  total_tasks: number;
  pending_tasks: number;
  running_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  workers: WorkerStatusResponse[];
};
