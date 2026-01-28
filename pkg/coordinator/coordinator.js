import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { connectToDatabase } from '../common/common.js';
import { DEFAULT_HEARTBEAT } from '../common/common.js';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROTO_PATH = join(__dirname, '../grpcapi/api.proto');
const SHUTDOWN_TIMEOUT = 5000;
const DEFAULT_MAX_MISSES = 3; // Allow 3 missed heartbeats (15 seconds tolerance)
const SCAN_INTERVAL = 10000; // 10 seconds

class WorkerInfo {
  constructor(id, address, grpcConnection, workerServiceClient) {
    this.id = id;
    this.heartbeatMisses = 0;
    this.address = address;
    this.grpcConnection = grpcConnection;
    this.workerServiceClient = workerServiceClient;
    this.lastActiveAt = new Date();
    this.tasksCompleted = 0;
    this.currentTaskId = null;
  }
}

export class CoordinatorServer {
  constructor(port, dbConnectionString) {
    this.serverPort = port;
    this.workerPool = new Map();
    this.workerPoolKeys = [];
    this.maxHeartbeatMisses = DEFAULT_MAX_MISSES;
    this.heartbeatInterval = DEFAULT_HEARTBEAT;
    this.roundRobinIndex = 0;
    this.dbConnectionString = dbConnectionString;
    this.dbPool = null;
    this.grpcServer = null;
    this.scanIntervalId = null;
    this.heartbeatIntervalId = null;
    this.isShuttingDown = false;

    // Load proto
    const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true
    });
    this.proto = grpc.loadPackageDefinition(packageDefinition).grpcapi;
  }

  async start() {
    try {
      this.manageWorkerPool();

      await this.startGRPCServer();

      this.dbPool = await connectToDatabase(this.dbConnectionString);

      this.scanDatabase();

      return this.awaitShutdown();
    } catch (error) {
      console.error('Error starting coordinator:', error);
      throw error;
    }
  }

  async startGRPCServer() {
    this.grpcServer = new grpc.Server();
    
    this.grpcServer.addService(this.proto.CoordinatorService.service, {
      SubmitTask: this.submitTask.bind(this),
      SendHeartbeat: this.sendHeartbeat.bind(this),
      UpdateTaskStatus: this.updateTaskStatus.bind(this),
      ListWorkers: this.listWorkers.bind(this)
    });

    return new Promise((resolve, reject) => {
      this.grpcServer.bindAsync(
        `0.0.0.0${this.serverPort}`,
        grpc.ServerCredentials.createInsecure(),
        (err, port) => {
          if (err) {
            reject(err);
            return;
          }
          this.grpcServer.start();
          console.log(`Starting gRPC server on ${this.serverPort}`);
          resolve();
        }
      );
    });
  }

  async submitTask(call, callback) {
    try {
      const data = call.request.data;
      const taskId = uuidv4();
      
      const task = {
        task_id: taskId,
        data: data
      };

      await this.submitTaskToWorker(task);

      callback(null, {
        message: 'Task submitted successfully',
        task_id: taskId
      });
    } catch (error) {
      callback(error);
    }
  }

  async updateTaskStatus(call, callback) {
    try {
      const { task_id, status, started_at, completed_at, failed_at, worker_id } = call.request;
      
      let timestamp;
      let column;

      switch (status) {
        case 'STARTED':
        case 1:
          timestamp = new Date(parseInt(started_at) * 1000);
          column = 'started_at';
          break;
        case 'COMPLETE':
        case 2:
          timestamp = new Date(parseInt(completed_at) * 1000);
          column = 'completed_at';
          break;
        case 'FAILED':
        case 3:
          timestamp = new Date(parseInt(failed_at) * 1000);
          column = 'failed_at';
          break;
        default:
          return callback(new Error('Invalid Status in UpdateStatusRequest'));
      }

      const query = `UPDATE tasks SET ${column} = $1${worker_id ? ', worker_id = $3' : ''} WHERE id = $2`;
      const params = worker_id ? [timestamp, task_id, worker_id] : [timestamp, task_id];
      await this.dbPool.query(query, params);

      // Bookkeeping: only the reporting worker is credited
      if (worker_id) {
        const w = this.workerPool.get(worker_id);
        if (w) {
          if (status === 'COMPLETE' || status === 2) {
            w.tasksCompleted = (w.tasksCompleted || 0) + 1;
          }
          if (status === 'FAILED' || status === 3 || status === 'COMPLETE' || status === 2) {
            w.currentTaskId = null;
          }
          w.lastActiveAt = new Date();
        }
      }

      callback(null, { success: true });
    } catch (error) {
      console.error(`Could not update task status: ${error.message}`);
      callback(error);
    }
  }

  getNextWorker() {
    if (this.workerPoolKeys.length === 0) {
      return null;
    }

    const worker = this.workerPool.get(
      this.workerPoolKeys[this.roundRobinIndex % this.workerPoolKeys.length]
    );
    this.roundRobinIndex++;
    return worker;
  }

  async submitTaskToWorker(task) {
    const worker = this.getNextWorker();
    if (!worker) {
      throw new Error('no workers available');
    }

    return new Promise((resolve, reject) => {
      worker.workerServiceClient.SubmitTask(task, (err, response) => {
        if (err) {
          reject(err);
        } else {
          worker.currentTaskId = task.task_id;
          resolve({ response, workerId: worker.id ?? this.workerPoolKeys[this.roundRobinIndex - 1] });
        }
      });
    });
  }

  async sendHeartbeat(call, callback) {
    try {
      const workerId = call.request.workerId;
      const address = call.request.address;

      if (this.workerPool.has(workerId)) {
        const worker = this.workerPool.get(workerId);
        worker.heartbeatMisses = 0;
        worker.lastActiveAt = new Date();
      } else {
        console.log('Registering worker:', workerId);
        
        const conn = new grpc.Client(
          address,
          grpc.credentials.createInsecure()
        );
        
        const workerClient = new this.proto.WorkerService(
          address,
          grpc.credentials.createInsecure()
        );

        this.workerPool.set(workerId, new WorkerInfo(workerId, address, conn, workerClient));
        this.workerPoolKeys = Array.from(this.workerPool.keys());
        
        console.log('Registered worker:', workerId);
      }

      callback(null, { acknowledged: true });
    } catch (error) {
      callback(error);
    }
  }

  listWorkers(_call, callback) {
    try {
      const workers = this.workerPoolKeys.map((id) => {
        const w = this.workerPool.get(id);
        return {
          id,
          address: w.address,
          status: 'online',
          last_active_at: w.lastActiveAt ? w.lastActiveAt.toISOString() : '',
          current_task_id: w.currentTaskId || '',
          tasks_completed: w.tasksCompleted || 0,
        };
      });
      callback(null, { workers });
    } catch (err) {
      callback(err);
    }
  }

  scanDatabase() {
    this.scanIntervalId = setInterval(async () => {
      await this.executeAllScheduledTasks();
    }, SCAN_INTERVAL);
  }

  async executeAllScheduledTasks() {
    const client = await this.dbPool.connect();
    
    try {
      await client.query('BEGIN');

      const result = await client.query(`
        SELECT id, command 
        FROM tasks 
        WHERE scheduled_at < (NOW() + INTERVAL '30 seconds') 
          AND picked_at IS NULL 
        ORDER BY scheduled_at 
        FOR UPDATE SKIP LOCKED
      `);

      const tasks = result.rows;

      for (const task of tasks) {
        try {
          const { workerId } = await this.submitTaskToWorker({
            task_id: task.id,
            data: task.command
          });

          await client.query(
            'UPDATE tasks SET picked_at = NOW(), worker_id = $2 WHERE id = $1',
            [task.id, workerId || null]
          );
        } catch (error) {
          console.error(`Failed to submit task ${task.id}: ${error.message}`);
          continue;
        }
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error executing scheduled tasks:', error);
    } finally {
      client.release();
    }
  }

  manageWorkerPool() {
    this.heartbeatIntervalId = setInterval(() => {
      this.removeInactiveWorkers();
    }, this.maxHeartbeatMisses * this.heartbeatInterval);
  }

  removeInactiveWorkers() {
    for (const [workerId, worker] of this.workerPool.entries()) {
      if (worker.heartbeatMisses > this.maxHeartbeatMisses) {
        console.log(`Removing inactive worker: ${workerId}`);
        worker.grpcConnection.close();
        this.workerPool.delete(workerId);
        this.workerPoolKeys = Array.from(this.workerPool.keys());
      } else {
        worker.heartbeatMisses++;
      }
    }
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
    console.log('Shutting down coordinator server...');
    this.isShuttingDown = true;

    if (this.scanIntervalId) {
      clearInterval(this.scanIntervalId);
    }

    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
    }

    for (const [workerId, worker] of this.workerPool.entries()) {
      if (worker.grpcConnection) {
        worker.grpcConnection.close();
      }
    }

    if (this.grpcServer) {
      this.grpcServer.forceShutdown();
    }

    if (this.dbPool) {
      await this.dbPool.end();
    }

    console.log('Coordinator server stopped');
    return;
  }
}

export function createServer(port, dbConnectionString) {
  return new CoordinatorServer(port, dbConnectionString);
}
