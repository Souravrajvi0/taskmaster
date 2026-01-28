import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import axios from 'axios';
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { GenericContainer } from 'testcontainers';
import { createServer as createScheduler } from '../pkg/scheduler/scheduler.js';
import { createServer as createCoordinator } from '../pkg/coordinator/coordinator.js';
import { createServer as createWorker } from '../pkg/worker/worker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROTO_PATH = join(__dirname, '../pkg/grpcapi/api.proto');

const postgresUser = 'postgres';
const postgresPassword = 'postgres';
const postgresDb = 'scheduler';

class TestCluster {
  constructor() {
    this.coordinatorAddress = '';
    this.scheduler = null;
    this.coordinator = null;
    this.workers = [];
    this.database = null;
    this.proto = null;
    this.coordinatorClient = null;
  }

  async launchCluster(schedulerPort, coordinatorPort, numWorkers) {
    // Launch database first
    await this.createDatabase();

    // Set environment variables with the actual mapped port
    const mappedPort = this.database.getMappedPort(5432);
    process.env.POSTGRES_USER = postgresUser;
    process.env.POSTGRES_PASSWORD = postgresPassword;
    process.env.POSTGRES_DB = postgresDb;
    process.env.POSTGRES_HOST = 'localhost';
    process.env.POSTGRES_PORT = mappedPort.toString();

    // Load proto
    const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true
    });
    this.proto = grpc.loadPackageDefinition(packageDefinition).grpcapi;

    const dbConnectionString = this.getDbConnectionString();

    // Start coordinator
    this.coordinatorAddress = `localhost${coordinatorPort}`;
    this.coordinator = createCoordinator(coordinatorPort, dbConnectionString);
    this.startServer(this.coordinator);

    // Start scheduler
    this.scheduler = createScheduler(schedulerPort, dbConnectionString);
    this.startServer(this.scheduler);

    // Start workers
    for (let i = 0; i < numWorkers; i++) {
      const worker = createWorker('', this.coordinatorAddress);
      this.workers.push(worker);
      this.startServer(worker);
    }

    // Wait for workers to register
    await this.waitForWorkers();

    // Create coordinator client
    this.coordinatorClient = new this.proto.CoordinatorService(
      this.coordinatorAddress,
      grpc.credentials.createInsecure()
    );
  }

  async stopCluster() {
    for (const worker of this.workers) {
      await worker.stop();
    }
    if (this.coordinator) {
      await this.coordinator.stop();
    }
    if (this.scheduler) {
      await this.scheduler.stop();
    }
    if (this.database) {
      await this.database.stop();
    }
  }

  startServer(srv) {
    srv.start().catch(err => {
      console.error('Failed to start server:', err);
    });
  }

  async waitForWorkers() {
    const maxWait = 20000; // 20 seconds
    const interval = 1000;
    let waited = 0;

    while (waited < maxWait) {
      if (this.coordinator.workerPoolKeys.length === this.workers.length) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
      waited += interval;
    }
    throw new Error('Timeout waiting for workers to register');
  }

  getDbConnectionString() {
    const mappedPort = this.database.getMappedPort(5432);
    return `postgres://${postgresUser}:${postgresPassword}@localhost:${mappedPort}/${postgresDb}`;
  }

  async createDatabase() {
    this.database = await new GenericContainer('scheduler-postgres')
      .withExposedPorts(5432)
      .withEnvironment({
        POSTGRES_PASSWORD: postgresPassword,
        POSTGRES_USER: postgresUser,
        POSTGRES_DB: postgresDb
      })
      .withStartupTimeout(120000)
      .start();
    
    // Wait for database to be fully ready (PostgreSQL initialization takes time)
    await new Promise(resolve => setTimeout(resolve, 10000));
  }
}

async function waitForCondition(condition, timeout, retryInterval) {
  const endTime = Date.now() + timeout;
  
  while (Date.now() < endTime) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, retryInterval));
  }
  
  throw new Error('Timeout exceeded');
}

describe('TaskMaster Integration Tests', () => {
  test('E2E Success', async () => {
    const cluster = new TestCluster();
    await cluster.launchCluster(':18081', ':18080', 2);

    // Schedule task
    const response = await axios.post('http://localhost:18081/schedule', {
      command: 'yoooo',
      scheduled_at: '2023-12-24T22:34:00+05:30'
    });

    const taskId = response.data.task_id;

    // Wait for task completion
    await waitForCondition(async () => {
      const statusResponse = await axios.get(`http://localhost:18081/status?task_id=${taskId}`);
      const data = statusResponse.data;
      return data.picked_at && data.started_at && data.completed_at;
    }, 20000, 1000);

    expect(taskId).toBeDefined();
    
    await cluster.stopCluster();
  }, 60000);

  test('Workers Not Available', async () => {
    const cluster = new TestCluster();
    await cluster.launchCluster(':28081', ':28080', 2);

    // Stop all workers
    for (const worker of cluster.workers) {
      await worker.stop();
    }

    // Wait for coordinator to detect missing workers
    await waitForCondition(async () => {
      return new Promise((resolve) => {
        cluster.coordinatorClient.SubmitTask({ data: 'test' }, (err, response) => {
          if (err && err.message.includes('no workers available')) {
            resolve(true);
          } else {
            resolve(false);
          }
        });
      });
    }, 20000, 5000);
    
    await cluster.stopCluster();
  }, 60000);

  test('Task Load Balancing Over Workers', async () => {
    const cluster = new TestCluster();
    await cluster.launchCluster(':38081', ':38080', 4);

    // Submit 8 tasks
    const promises = [];
    for (let i = 0; i < 8; i++) {
      const promise = new Promise((resolve, reject) => {
        cluster.coordinatorClient.SubmitTask({ data: 'test' }, (err, response) => {
          if (err) reject(err);
          else resolve(response);
        });
      });
      promises.push(promise);
    }
    await Promise.all(promises);

    // Verify each worker got 2 tasks
    await waitForCondition(async () => {
      for (const worker of cluster.workers) {
        if (worker.receivedTasks.size !== 2) {
          return false;
        }
      }
      return true;
    }, 5000, 500);
    
    await cluster.stopCluster();
  }, 60000);
});
