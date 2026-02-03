
import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

// Track round-robin worker assignment
let nextWorkerIndex = 0;

// Helper to format dates
const formatDate = (date: Date | null) => {
  if (!date) return "";
  return date.toISOString().replace('T', ' ').substring(0, 19);
};

// Initialize workers on startup
async function initializeWorkers() {
  const existingWorkers = await storage.getAllWorkers();
  if (existingWorkers.length === 0) {
    // Create 3 workers as per the spec (scalable to more)
    for (let i = 1; i <= 3; i++) {
      await storage.createWorker({
        id: i,
        name: `Worker-${i}`,
      });
    }
    console.log("Initialized 3 workers");
  }
}

// Seed some example tasks
async function seedTasks() {
  const existingTasks = await storage.getAllTasks();
  if (existingTasks.length === 0) {
    const now = new Date();
    
    // Create some sample tasks in various states
    await storage.createTask({
      command: "generate-monthly-report",
      scheduledAt: new Date(now.getTime() - 60000), // 1 min ago (should be picked up)
    });
    
    await storage.createTask({
      command: "backup-user-data",
      scheduledAt: new Date(now.getTime() + 30000), // 30s in future
    });
    
    await storage.createTask({
      command: "send-notification-batch",
      scheduledAt: new Date(now.getTime() + 60000), // 1 min in future
    });
    
    console.log("Seeded 3 example tasks");
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Initialize workers and seed data
  await initializeWorkers();
  await seedTasks();

  // === Task Routes ===

  // Schedule Task
  app.post(api.tasks.schedule.path, async (req, res) => {
    try {
      const input = api.tasks.schedule.input.parse(req.body);
      
      const task = await storage.createTask({
        command: input.command,
        scheduledAt: new Date(input.scheduled_at),
      });

      res.status(200).json({
        command: task.command,
        scheduled_at: Math.floor(task.scheduledAt.getTime() / 1000),
        task_id: task.id,
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
        });
      }
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // Get Task Status
  app.get(api.tasks.status.path, async (req, res) => {
    try {
      const taskId = req.query.task_id as string;
      if (!taskId) {
        return res.status(400).json({ error: "Task ID is required" });
      }

      const task = await storage.getTask(taskId);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      res.json({
        task_id: task.id,
        command: task.command,
        scheduled_at: formatDate(task.scheduledAt),
        picked_at: formatDate(task.pickedAt),
        started_at: formatDate(task.startedAt),
        completed_at: formatDate(task.completedAt),
        failed_at: formatDate(task.failedAt),
        worker_id: task.workerId,
      });
    } catch (err) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // List All Tasks
  app.get(api.tasks.list.path, async (_req, res) => {
    try {
      const allTasks = await storage.getAllTasks();
      
      res.json(allTasks.map(task => ({
        task_id: task.id,
        command: task.command,
        scheduled_at: formatDate(task.scheduledAt),
        picked_at: formatDate(task.pickedAt),
        started_at: formatDate(task.startedAt),
        completed_at: formatDate(task.completedAt),
        failed_at: formatDate(task.failedAt),
        worker_id: task.workerId,
      })));
    } catch (err) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // === Worker Routes ===

  // List All Workers
  app.get(api.workers.list.path, async (_req, res) => {
    try {
      const allWorkers = await storage.getAllWorkers();
      
      res.json(allWorkers.map(worker => ({
        id: worker.id,
        name: worker.name,
        status: worker.status,
        current_task_id: worker.currentTaskId,
        tasks_completed: worker.tasksCompleted,
        last_active_at: formatDate(worker.lastActiveAt),
      })));
    } catch (err) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // === System Stats ===
  app.get(api.system.stats.path, async (_req, res) => {
    try {
      const allTasks = await storage.getAllTasks();
      const allWorkers = await storage.getAllWorkers();

      const pending = allTasks.filter(t => !t.pickedAt && !t.completedAt && !t.failedAt);
      const running = allTasks.filter(t => t.startedAt && !t.completedAt && !t.failedAt);
      const completed = allTasks.filter(t => t.completedAt);
      const failed = allTasks.filter(t => t.failedAt);

      res.json({
        total_tasks: allTasks.length,
        pending_tasks: pending.length,
        running_tasks: running.length,
        completed_tasks: completed.length,
        failed_tasks: failed.length,
        workers: allWorkers.map(worker => ({
          id: worker.id,
          name: worker.name,
          status: worker.status,
          current_task_id: worker.currentTaskId,
          tasks_completed: worker.tasksCompleted,
          last_active_at: formatDate(worker.lastActiveAt),
        })),
      });
    } catch (err) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // === Backend Simulation (Coordinator distributes to Workers) ===
  setInterval(async () => {
    try {
      const allTasks = await storage.getAllTasks();
      const allWorkers = await storage.getAllWorkers();
      const now = new Date();

      for (const task of allTasks) {
        // 1. Coordinator picks up scheduled tasks and assigns to idle worker (round-robin)
        if (!task.pickedAt && task.scheduledAt <= now) {
          // Find an idle worker using round-robin
          const idleWorkers = allWorkers.filter(w => w.status === "idle");
          
          if (idleWorkers.length > 0) {
            const workerIndex = nextWorkerIndex % idleWorkers.length;
            const worker = idleWorkers[workerIndex];
            nextWorkerIndex++;

            await storage.updateTask(task.id, { 
              pickedAt: now,
              workerId: worker.id,
            });
            
            await storage.updateWorker(worker.id, {
              status: "busy",
              currentTaskId: task.id,
              lastActiveAt: now,
            });
            
            console.log(`Coordinator: Task ${task.id.substring(0, 8)} assigned to ${worker.name}`);
          }
          continue;
        }

        // 2. Worker starts execution shortly after assignment
        if (task.pickedAt && !task.startedAt && task.workerId) {
          if (now.getTime() - task.pickedAt.getTime() > 1000) {
            await storage.updateTask(task.id, { startedAt: now });
            console.log(`${task.workerId ? `Worker-${task.workerId}` : 'Worker'}: Started task ${task.id.substring(0, 8)}`);
          }
          continue;
        }

        // 3. Worker completes task after 5s execution time
        if (task.startedAt && !task.completedAt && !task.failedAt && task.workerId) {
          if (now.getTime() - task.startedAt.getTime() > 5000) {
            await storage.updateTask(task.id, { completedAt: now });
            
            // Update worker back to idle
            const worker = await storage.getWorker(task.workerId);
            if (worker) {
              await storage.updateWorker(worker.id, {
                status: "idle",
                currentTaskId: null,
                tasksCompleted: worker.tasksCompleted + 1,
                lastActiveAt: now,
              });
            }
            
            console.log(`Worker-${task.workerId}: Completed task ${task.id.substring(0, 8)}`);
          }
          continue;
        }
      }
    } catch (err) {
      console.error("Simulation error:", err);
    }
  }, 1000);

  return httpServer;
}
