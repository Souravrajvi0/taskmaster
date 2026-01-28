import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { DEFAULT_HEARTBEAT } from '../common/common.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROTO_PATH = join(__dirname, '../grpcapi/api.proto');
const TASK_PROCESS_TIME = 5000; // 5 seconds
const WORKER_POOL_SIZE = 5;

export class WorkerServer {
  constructor(port, coordinatorAddress) {
    this.id = Math.floor(Math.random() * 0xFFFFFFFF);
    this.serverPort = port;
    this.coordinatorAddress = coordinatorAddress;
    this.heartbeatInterval = DEFAULT_HEARTBEAT;
    this.taskQueue = [];
    this.receivedTasks = new Map();
    this.grpcServer = null;
    this.coordinatorConnection = null;
    this.coordinatorServiceClient = null;
    this.heartbeatIntervalId = null;
    this.isShuttingDown = false;
    this.actualPort = null;
    this.workerPromises = [];

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
      this.startWorkerPool(WORKER_POOL_SIZE);

      // Start gRPC server first so we know the bound port for heartbeats
      await this.startGRPCServer();

      await this.connectToCoordinator();

      this.periodicHeartbeat();

      return this.awaitShutdown();
    } catch (error) {
      console.error('Error starting worker:', error);
      throw error;
    }
  }

  async connectToCoordinator() {
    console.log('Connecting to coordinator...');
    
    // Coordinator address should always include host:port
    this.coordinatorServiceClient = new this.proto.CoordinatorService(
      this.coordinatorAddress,
      grpc.credentials.createInsecure()
    );

    // Wait for connection to be ready
    return new Promise((resolve, reject) => {
      const deadline = new Date();
      deadline.setSeconds(deadline.getSeconds() + 10);
      
      this.coordinatorServiceClient.waitForReady(deadline, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Connected to coordinator!');
          resolve();
        }
      });
    });
  }

  periodicHeartbeat() {
    this.heartbeatIntervalId = setInterval(() => {
      this.sendHeartbeat();
    }, this.heartbeatInterval);
  }

  async sendHeartbeat() {
    if (this.isShuttingDown) return;

    try {
      let workerAddress = process.env.WORKER_ADDRESS || 'localhost';
      if (!workerAddress.includes(':')) {
        // Append the actual bound port ("<host>:<port>")
        workerAddress = `${workerAddress}:${this.actualPort}`;
      }

      const request = {
        workerId: this.id,
        address: workerAddress
      };

      this.coordinatorServiceClient.SendHeartbeat(request, (err, response) => {
        if (err) {
          console.error('Failed to send heartbeat:', err.message);
        }
      });
    } catch (error) {
      console.error('Heartbeat error:', error);
    }
  }

  async startGRPCServer() {
    this.grpcServer = new grpc.Server();
    
    this.grpcServer.addService(this.proto.WorkerService.service, {
      SubmitTask: this.handleSubmitTask.bind(this)
    });

    return new Promise((resolve, reject) => {
      const bindAddress = this.serverPort ? `0.0.0.0${this.serverPort}` : '0.0.0.0:0';
      
      this.grpcServer.bindAsync(
        bindAddress,
        grpc.ServerCredentials.createInsecure(),
        (err, port) => {
          if (err) {
            reject(err);
            return;
          }
          this.grpcServer.start();
          // Store the numeric port; include colon only when formatting addresses
          this.actualPort = port;
          console.log(`Starting worker server on port ${port}`);
          resolve();
        }
      );
    });
  }

  handleSubmitTask(call, callback) {
    try {
      const task = call.request;
      console.log('Received task:', task);

      this.receivedTasks.set(task.task_id, task);
      this.taskQueue.push(task);

      callback(null, {
        message: 'Task was submitted',
        success: true,
        task_id: task.task_id
      });
    } catch (error) {
      callback(error);
    }
  }

  startWorkerPool(numWorkers) {
    for (let i = 0; i < numWorkers; i++) {
      const workerPromise = this.worker();
      this.workerPromises.push(workerPromise);
    }
  }

  async worker() {
    while (!this.isShuttingDown) {
      if (this.taskQueue.length > 0) {
        const task = this.taskQueue.shift();
        
        await this.updateTaskStatus(task, 1); // STARTED
        await this.processTask(task);
        await this.updateTaskStatus(task, 2); // COMPLETE
      } else {
        // Wait a bit before checking again
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }

  async updateTaskStatus(task, status) {
    if (this.isShuttingDown) return;

    const request = {
      task_id: task.task_id,
      status: status,
      started_at: Math.floor(Date.now() / 1000).toString(),
      completed_at: Math.floor(Date.now() / 1000).toString(),
      failed_at: '0',
      worker_id: this.id
    };

    // Await the RPC so transient failures are surfaced to the worker loop
    await new Promise((resolve, reject) => {
      this.coordinatorServiceClient.UpdateTaskStatus(request, (err) => {
        if (err) {
          console.error('Failed to update task status:', err.message);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async processTask(task) {
    console.log('Processing task:', task);
    await new Promise(resolve => setTimeout(resolve, TASK_PROCESS_TIME));
    console.log('Completed task:', task);
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
    console.log('Shutting down worker server...');
    this.isShuttingDown = true;

    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
    }

    // Wait for worker goroutines to finish
    await Promise.all(this.workerPromises);

    if (this.grpcServer) {
      this.grpcServer.forceShutdown();
    }

    if (this.coordinatorServiceClient) {
      this.coordinatorServiceClient.close();
    }

    console.log('Worker server stopped');
    return;
  }
}

export function createServer(port, coordinatorAddress) {
  return new WorkerServer(port, coordinatorAddress);
}
