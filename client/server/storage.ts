
import { db } from "./db";
import {
  tasks,
  workers,
  type Task,
  type InsertTask,
  type Worker,
  type InsertWorker,
} from "@shared/schema";
import { eq, isNull, isNotNull, and, lte } from "drizzle-orm";

export interface IStorage {
  // Tasks
  createTask(task: InsertTask): Promise<Task>;
  getTask(id: string): Promise<Task | undefined>;
  updateTask(id: string, updates: Partial<Task>): Promise<Task>;
  getAllTasks(): Promise<Task[]>;
  getPendingTasks(): Promise<Task[]>;
  getRunningTasks(): Promise<Task[]>;
  getCompletedTasks(): Promise<Task[]>;
  getFailedTasks(): Promise<Task[]>;
  
  // Workers
  createWorker(worker: InsertWorker): Promise<Worker>;
  getWorker(id: number): Promise<Worker | undefined>;
  updateWorker(id: number, updates: Partial<Worker>): Promise<Worker>;
  getAllWorkers(): Promise<Worker[]>;
  getIdleWorkers(): Promise<Worker[]>;
}

export class DatabaseStorage implements IStorage {
  // === Task Methods ===
  async createTask(insertTask: InsertTask): Promise<Task> {
    const [task] = await db
      .insert(tasks)
      .values(insertTask)
      .returning();
    return task;
  }

  async getTask(id: string): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    return task;
  }

  async updateTask(id: string, updates: Partial<Task>): Promise<Task> {
    const [task] = await db
      .update(tasks)
      .set(updates)
      .where(eq(tasks.id, id))
      .returning();
    return task;
  }

  async getAllTasks(): Promise<Task[]> {
    return await db.select().from(tasks).orderBy(tasks.scheduledAt);
  }

  async getPendingTasks(): Promise<Task[]> {
    return await db.select().from(tasks).where(
      and(isNull(tasks.pickedAt), isNull(tasks.completedAt), isNull(tasks.failedAt))
    );
  }

  async getRunningTasks(): Promise<Task[]> {
    return await db.select().from(tasks).where(
      and(
        isNull(tasks.completedAt),
        isNull(tasks.failedAt)
      )
    );
  }

  async getCompletedTasks(): Promise<Task[]> {
    return await db.select().from(tasks).where(
      isNotNull(tasks.completedAt)
    );
  }

  async getFailedTasks(): Promise<Task[]> {
    return await db.select().from(tasks).where(
      isNotNull(tasks.failedAt)
    );
  }

  // === Worker Methods ===
  async createWorker(insertWorker: InsertWorker): Promise<Worker> {
    const [worker] = await db
      .insert(workers)
      .values({
        ...insertWorker,
        status: "idle",
        tasksCompleted: 0,
      })
      .returning();
    return worker;
  }

  async getWorker(id: number): Promise<Worker | undefined> {
    const [worker] = await db.select().from(workers).where(eq(workers.id, id));
    return worker;
  }

  async updateWorker(id: number, updates: Partial<Worker>): Promise<Worker> {
    const [worker] = await db
      .update(workers)
      .set(updates)
      .where(eq(workers.id, id))
      .returning();
    return worker;
  }

  async getAllWorkers(): Promise<Worker[]> {
    return await db.select().from(workers).orderBy(workers.id);
  }

  async getIdleWorkers(): Promise<Worker[]> {
    return await db.select().from(workers).where(eq(workers.status, "idle"));
  }
}

export const storage = new DatabaseStorage();
