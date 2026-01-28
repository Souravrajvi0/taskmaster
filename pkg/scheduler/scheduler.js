import express from 'express';
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { connectToDatabase, getDBConnectionString } from '../common/common.js';

const execAsync = promisify(exec);

const app = express();
app.use(express.json());

// Normalize dates to ISO strings for client consumption
function formatTimestamp(ts) {
  return ts ? ts.toISOString() : '';
}

// Simple ring buffer for recent log events
class LogBuffer {
  constructor(limit = 200) {
    this.limit = limit;
    this.items = [];
  }
  push(item) {
    this.items.push(item);
    if (this.items.length > this.limit) this.items.shift();
  }
  toArray() {
    return [...this.items];
  }
}

export class SchedulerServer {
  constructor(port, dbConnectionString) {
    this.serverPort = port;
    this.dbConnectionString = dbConnectionString;
    this.dbPool = null;
    this.httpServer = null;
    this.composeFile = process.env.DOCKER_COMPOSE_FILE || 'docker-compose-node.yml';

    // SSE log streaming state
    this.sseClients = new Set();
    this.logBuffer = new LogBuffer(250);
    this.taskSnapshot = new Map(); // task_id -> { scheduled_at, picked_at, started_at, completed_at, failed_at, worker_id }
    this.pollIntervalId = null;

    // gRPC client for coordinator (to fetch workers)
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    this.PROTO_PATH = join(__dirname, '../grpcapi/api.proto');
    const packageDefinition = protoLoader.loadSync(this.PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    this.proto = grpc.loadPackageDefinition(packageDefinition).grpcapi;
    this.coordinatorAddress = process.env.COORDINATOR_ADDRESS || 'coordinator:8080';
    this.coordinatorClient = new this.proto.CoordinatorService(
      this.coordinatorAddress,
      grpc.credentials.createInsecure()
    );
  }

  async start() {
    try {
      this.dbPool = await connectToDatabase(this.dbConnectionString);
      
      // Define routes
      app.post('/schedule', this.handleScheduleTask.bind(this));
      app.get('/status', this.handleGetTaskStatus.bind(this));
      // Aliases with /api prefix for the React client
      app.post('/api/schedule', this.handleScheduleTask.bind(this));
      app.get('/api/status', this.handleGetTaskStatus.bind(this));
      app.get('/api/tasks', this.handleListTasks.bind(this));
      app.get('/api/stats', this.handleStats.bind(this));
      app.get('/api/workers', this.handleWorkers.bind(this));
      app.post('/api/schedule/batch', this.handleBatchSchedule.bind(this));
      app.post('/api/workers/scale', this.handleScaleWorkers.bind(this));
      app.post('/api/workers/kill', this.handleKillWorker.bind(this));

      // Start HTTP server
      this.httpServer = app.listen(this.serverPort.replace(':', ''), () => {
        console.log(`Starting scheduler server on ${this.serverPort}`);
      });

      // Begin emitting derived log events from DB transitions
      this.startLogPolling();

      // Setup graceful shutdown
      return this.awaitShutdown();
    } catch (error) {
      console.error('Error starting scheduler:', error);
      throw error;
    }
  }

  async handleBatchSchedule(req, res) {
    try {
      const { command = 'demo-job', count = 10, delay_seconds = 0 } = req.body || {};
      const c = Math.max(1, Math.min(1000, parseInt(count, 10)));
      const delay = Math.max(0, parseInt(delay_seconds, 10));
      const now = Date.now();
      const scheduledAt = new Date(now + delay * 1000);

      const ids = [];
      for (let i = 0; i < c; i++) {
        const result = await this.dbPool.query(
          'INSERT INTO tasks (command, scheduled_at) VALUES ($1, $2) RETURNING id',
          [command, scheduledAt]
        );
        ids.push(result.rows[0].id);
      }

      // Emit a log line for batch creation
      this.broadcastLog({ level: 'info', msg: `Enqueued ${c} tasks (${command}) for ${scheduledAt.toISOString()}` });

      res.json({ count: c, scheduled_at: Math.floor(scheduledAt.getTime() / 1000), task_ids: ids });
    } catch (error) {
      console.error('Error scheduling batch:', error);
      res.status(500).json({ error: `Failed to schedule batch. Error: ${error.message}` });
    }
  }

  async handleScheduleTask(req, res) {
    try {
      const { command, scheduled_at } = req.body;

      if (!command || !scheduled_at) {
        return res.status(400).json({ error: 'command and scheduled_at are required' });
      }

      console.log('Received schedule request:', req.body);

      // Parse the scheduled_at time (ISO 8601 format)
      const scheduledTime = new Date(scheduled_at);
      if (isNaN(scheduledTime.getTime())) {
        return res.status(400).json({ error: 'Invalid date format. Use ISO 8601 format.' });
      }

      const taskId = await this.insertTaskIntoDB(command, scheduledTime);

      const response = {
        command: command,
        scheduled_at: Math.floor(scheduledTime.getTime() / 1000),
        task_id: taskId
      };

      res.json(response);
    } catch (error) {
      console.error('Error scheduling task:', error);
      res.status(500).json({ error: `Failed to submit task. Error: ${error.message}` });
    }
  }

  async handleGetTaskStatus(req, res) {
    try {
      const taskId = req.query.task_id;

      if (!taskId) {
        return res.status(400).json({ error: 'Task ID is required' });
      }

      const result = await this.dbPool.query(
        'SELECT * FROM tasks WHERE id = $1',
        [taskId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const task = result.rows[0];

      const response = {
        task_id: task.id,
        command: task.command,
        scheduled_at: formatTimestamp(task.scheduled_at),
        picked_at: formatTimestamp(task.picked_at),
        started_at: formatTimestamp(task.started_at),
        completed_at: formatTimestamp(task.completed_at),
        failed_at: formatTimestamp(task.failed_at),
        worker_id: task.worker_id ?? null
      };

      res.json(response);
    } catch (error) {
      console.error('Error getting task status:', error);
      res.status(500).json({ error: `Failed to get task status. Error: ${error.message}` });
    }
  }

  async handleListTasks(_req, res) {
    try {
      const result = await this.dbPool.query('SELECT * FROM tasks ORDER BY scheduled_at');
      const tasks = result.rows.map((task) => ({
        task_id: task.id,
        command: task.command,
        scheduled_at: formatTimestamp(task.scheduled_at),
        picked_at: formatTimestamp(task.picked_at),
        started_at: formatTimestamp(task.started_at),
        completed_at: formatTimestamp(task.completed_at),
        failed_at: formatTimestamp(task.failed_at),
        worker_id: task.worker_id ?? null,
      }));
      res.json(tasks);
    } catch (error) {
      console.error('Error listing tasks:', error);
      res.status(500).json({ error: `Failed to list tasks. Error: ${error.message}` });
    }
  }

  async handleStats(_req, res) {
    try {
      const result = await this.dbPool.query('SELECT * FROM tasks');
      const tasks = result.rows;

      const pending = tasks.filter((t) => !t.picked_at && !t.completed_at && !t.failed_at);
      const running = tasks.filter((t) => t.started_at && !t.completed_at && !t.failed_at);
      const completed = tasks.filter((t) => t.completed_at);
      const failed = tasks.filter((t) => t.failed_at);

      const workers = await this.fetchWorkersSafe();

      res.json({
        total_tasks: tasks.length,
        pending_tasks: pending.length,
        running_tasks: running.length,
        completed_tasks: completed.length,
        failed_tasks: failed.length,
        workers,
      });
    } catch (error) {
      console.error('Error building stats:', error);
      res.status(500).json({ error: `Failed to get stats. Error: ${error.message}` });
    }
  }

  async handleWorkers(_req, res) {
    try {
      const workers = await this.fetchWorkersSafe();
      res.json(workers);
    } catch (error) {
      console.error('Error listing workers:', error);
      res.status(500).json({ error: `Failed to get workers. Error: ${error.message}` });
    }
  }

  async handleScaleWorkers(req, res) {
    try {
      const { count } = req.body || {};
      const desired = Number.parseInt(count, 10);

      if (!Number.isFinite(desired) || desired < 1 || desired > 50) {
        return res.status(400).json({ error: 'count must be between 1 and 50' });
      }

      const cmd = `docker-compose -f ${this.composeFile} up --scale worker=${desired} -d`;
      await execAsync(cmd, { timeout: 30000 });

      this.broadcastLog({ level: 'info', msg: `Scale request accepted: worker=${desired}` });
      res.json({ ok: true, count: desired, command: cmd });
    } catch (error) {
      console.error('Error scaling workers:', error);
      res.status(500).json({ error: `Failed to scale workers: ${error.message}` });
    }
  }

  async handleKillWorker(req, res) {
    try {
      const { name } = req.body || {};
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: 'name is required' });
      }

      // simple sanitization: allow alphanumerics, dash, underscore only
      if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
        return res.status(400).json({ error: 'invalid worker name' });
      }

      const cmd = `docker stop ${name}`;
      await execAsync(cmd, { timeout: 20000 });

      this.broadcastLog({ level: 'info', msg: `Kill request executed for ${name}` });
      res.json({ ok: true, name, command: cmd });
    } catch (error) {
      console.error('Error killing worker:', error);
      res.status(500).json({ error: `Failed to kill worker: ${error.message}` });
    }
  }

  // ===== Logs (JSON + SSE) =====
  handleLogsJSON(_req, res) {
    res.json(this.logBuffer.toArray());
  }

  handleLogsSSE(_req, res) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    // Send recent backlog
    for (const item of this.logBuffer.toArray()) {
      res.write(`data: ${JSON.stringify(item)}\n\n`);
    }

    const client = res;
    this.sseClients.add(client);

    // Heartbeat
    const keepAlive = setInterval(() => {
      if (!client.writableEnded) client.write(': keep-alive\n\n');
    }, 15000);

    req.on('close', () => {
      clearInterval(keepAlive);
      this.sseClients.delete(client);
    });
  }

  broadcastLog(event) {
    const payload = {
      ts: new Date().toISOString(),
      ...event,
    };
    this.logBuffer.push(payload);
    const data = `data: ${JSON.stringify(payload)}\n\n`;
    for (const client of this.sseClients) {
      if (!client.writableEnded) client.write(data);
    }
  }

  startLogPolling() {
    // Poll DB for tasks and derive transitions as log lines
    const poll = async () => {
      try {
        const result = await this.dbPool.query('SELECT * FROM tasks ORDER BY scheduled_at');
        for (const t of result.rows) {
          const prev = this.taskSnapshot.get(t.id);
          if (!prev) {
            this.taskSnapshot.set(t.id, {
              scheduled_at: t.scheduled_at,
              picked_at: t.picked_at,
              started_at: t.started_at,
              completed_at: t.completed_at,
              failed_at: t.failed_at,
              worker_id: t.worker_id ?? null,
            });
            this.broadcastLog({ level: 'info', msg: `Task ${t.id.substring(0,8)} scheduled (${t.command})` });
            continue;
          }

          // Detect transitions
          if (!prev.picked_at && t.picked_at) {
            this.broadcastLog({ level: 'info', msg: `Task ${t.id.substring(0,8)} assigned to worker ${t.worker_id ?? '?'} ` });
          }
          if (!prev.started_at && t.started_at) {
            this.broadcastLog({ level: 'info', msg: `Task ${t.id.substring(0,8)} started` });
          }
          if (!prev.completed_at && t.completed_at) {
            this.broadcastLog({ level: 'success', msg: `Task ${t.id.substring(0,8)} completed` });
          }
          if (!prev.failed_at && t.failed_at) {
            this.broadcastLog({ level: 'error', msg: `Task ${t.id.substring(0,8)} failed` });
          }

          // Update snapshot
          prev.picked_at = t.picked_at;
          prev.started_at = t.started_at;
          prev.completed_at = t.completed_at;
          prev.failed_at = t.failed_at;
          prev.worker_id = t.worker_id ?? null;
        }
      } catch (e) {
        // Log silently to avoid spamming
        console.error('Log polling error:', e.message);
      }
    };

    // Expose routes now that we have polling
    app.get('/api/logs', this.handleLogsJSON.bind(this));
    app.get('/api/logs/stream', this.handleLogsSSE.bind(this));

    if (this.pollIntervalId) clearInterval(this.pollIntervalId);
    this.pollIntervalId = setInterval(poll, 1000);
    // prime immediately
    poll();
  }

  fetchWorkersSafe() {
    return new Promise((resolve) => {
      try {
        this.coordinatorClient.ListWorkers({}, (err, resp) => {
          if (err || !resp) {
            // If coordinator unavailable, return empty list
            return resolve([]);
          }
          const mapped = (resp.workers || []).map((w) => ({
            id: w.id,
            name: `Worker-${w.id}`,
            status: w.status || 'online',
            current_task_id: w.current_task_id || null,
            tasks_completed: w.tasks_completed || 0,
            last_active_at: w.last_active_at || '',
          }));
          resolve(mapped);
        });
      } catch (_) {
        resolve([]);
      }
    });
  }

  async insertTaskIntoDB(command, scheduledAt) {
    const result = await this.dbPool.query(
      'INSERT INTO tasks (command, scheduled_at) VALUES ($1, $2) RETURNING id',
      [command, scheduledAt]
    );
    return result.rows[0].id;
  }

  awaitShutdown() {
    return new Promise((resolve) => {
      process.on('SIGINT', async () => {
        await this.stop();
        resolve();
      });
      process.on('SIGTERM', async () => {
        await this.stop();
        resolve();
      });
    });
  }

  async stop() {
    console.log('Shutting down scheduler server...');
    
    if (this.httpServer) {
      this.httpServer.close();
    }
    
    if (this.dbPool) {
      await this.dbPool.end();
    }
    
    console.log('Scheduler server stopped');
    return;
  }
}

export function createServer(port, dbConnectionString) {
  return new SchedulerServer(port, dbConnectionString);
}
