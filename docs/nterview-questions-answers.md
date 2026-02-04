# 50 Backend Interview Questions & Answers (1-Year Experience, 7-10 LPA)

> **Target**: Backend roles at startups/mid-sized companies (non-FAANG)  
> **Experience Level**: 1 year  
> **Salary Range**: 7-10 LPA

---

## Project Overview Questions (5)

### 1. Tell me about your TaskMaster project in 2 minutes.

**Answer**: TaskMaster is a distributed task scheduler I built using Node.js, gRPC, and PostgreSQL. It has three main services: a Scheduler (Express HTTP API) that accepts task requests, a Coordinator (gRPC service) that manages worker pools and distributes tasks using round-robin, and Workers that execute tasks. I can scale workers from 1 to 50+ dynamically using Docker Compose. The system handles 500+ tasks per second and features real-time monitoring via Server-Sent Events. I built it to learn distributed systems concepts like load balancing, fault tolerance, and microservices architecture.

---

### 2. Why did you build this project?

**Answer**: I wanted to understand how distributed systems work in practice. I'd read about concepts like load balancing and fault tolerance, but I wanted hands-on experience. I chose a task scheduler because it's a real-world problem (similar to CI/CD systems like Jenkins or data pipelines like Airflow) and it let me explore multiple technologies: gRPC for inter-service communication, PostgreSQL for state management, and Docker for orchestration.

---

### 3. What was the most challenging part of building this?

**Answer**: The most challenging part was handling worker failures gracefully. Initially, if a worker crashed mid-task, the task would be stuck forever. I implemented heartbeat-based health checks where workers send heartbeats every 5 seconds, and the coordinator removes workers after 3 missed heartbeats (15 seconds). However, tasks that started but didn't complete are still stuck. For production, I'd add a task timeout mechanism to mark tasks as failed if they run longer than expected.

---

### 4. How long did it take you to build this?

**Answer**: About 3-4 weeks. I spent the first week learning gRPC and Protocol Buffers since I hadn't used them before. The second week was building the core services (Scheduler, Coordinator, Worker). The third week was adding features like dynamic scaling, SSE for real-time updates, and Docker Compose orchestration. The final week was testing, documentation, and building the React frontend.

---

### 5. What would you improve if you had more time?

**Answer**: Three main things:
1. **Task retries with exponential backoff** - Currently, failed tasks aren't retried automatically
2. **Redis pub/sub** - Replace database polling with instant notifications for lower latency
3. **Observability** - Add Prometheus metrics, distributed tracing with Jaeger, and centralized logging

---

## Technology Choice Questions (10)

### 6. Why did you choose Node.js over Python or Go?

**Answer**: I chose Node.js because:
- I'm most comfortable with JavaScript
- Event-driven architecture fits well for I/O-heavy operations (database queries, gRPC calls)
- Large ecosystem (npm packages for gRPC, PostgreSQL, Express)
- Easy to prototype quickly

**Trade-off**: Go would be faster and more efficient for CPU-intensive tasks, but for this I/O-bound scheduler, Node.js performance is sufficient.

---

### 7. Why gRPC instead of REST/HTTP for internal communication?

**Answer**: 
- **Performance**: Binary protocol (Protocol Buffers) is faster than JSON
- **Type Safety**: `.proto` files enforce contracts at compile time
- **Streaming**: Supports bi-directional streaming for future features
- **Language Agnostic**: Easy to add workers in other languages

**Trade-off**: More complex than REST, requires `.proto` file maintenance, harder to debug (can't use curl).

---

### 8. Why PostgreSQL instead of MongoDB or MySQL?

**Answer**: 
- **ACID Transactions**: Critical for task state consistency
- **`FOR UPDATE SKIP LOCKED`**: Built-in support for queue patterns (prevents race conditions)
- **Complex Queries**: Need SQL for filtering tasks by time, status, worker
- **Persistence**: Tasks survive restarts

**Trade-off**: Slower than Redis for simple operations, but I need durability.

---

### 9. Why PostgreSQL instead of Redis?

**Answer**: Redis is in-memory, so data is lost on restart unless persistence is configured. PostgreSQL guarantees durability. Also, I need complex SQL queries like:
```sql
SELECT * FROM tasks 
WHERE scheduled_at < NOW() + INTERVAL '30 seconds' 
AND picked_at IS NULL
```
Redis doesn't support this natively.

**When I'd use Redis**: For caching, pub/sub notifications, or session storage.

---

### 10. Why polling instead of message queues (RabbitMQ/Kafka)?

**Answer**: 
- **Simplicity**: No additional infrastructure to manage
- **Database as source of truth**: No risk of message loss
- **Easy debugging**: Can inspect task state directly in database

**Trade-off**: Higher latency (10-second polling vs instant push). For production, I'd add Redis pub/sub while keeping the database as the source of truth.

---

### 11. Why Docker Compose instead of Kubernetes?

**Answer**: Docker Compose is simpler for development and demos. Kubernetes would be overkill for a local project. For production, I'd definitely use Kubernetes for:
- Auto-scaling based on CPU/memory
- Self-healing (automatic pod restarts)
- Rolling updates with zero downtime
- Better resource management

---

### 12. Why Express instead of Fastify or Koa?

**Answer**: Express is the most popular and has the largest ecosystem. I'm familiar with it from previous projects. Fastify would be faster (3x throughput), but for this project, the bottleneck is database queries, not the HTTP server.

---

### 13. Why Server-Sent Events (SSE) instead of WebSockets?

**Answer**: 
- **Simpler**: SSE is one-way (server → client), which is all I need for logs
- **HTTP-based**: Works through firewalls and proxies
- **Auto-reconnect**: Browsers handle reconnection automatically

**When I'd use WebSockets**: If I needed bi-directional communication (e.g., client sending commands to server in real-time).

---

### 14. Why round-robin load balancing instead of least-connections?

**Answer**: 
- **Simplicity**: No need to track worker load
- **Fairness**: Evenly distributes tasks
- **Stateless**: Works even if coordinator restarts

**Trade-off**: Doesn't account for worker performance differences. For production, I'd use least-connections or weighted round-robin.

---

### 15. Why did you use Protocol Buffers instead of JSON for gRPC?

**Answer**: Protocol Buffers are the standard for gRPC. Benefits:
- **Smaller payload**: Binary encoding is more compact than JSON
- **Faster serialization**: 3-10x faster than JSON
- **Schema validation**: `.proto` files enforce structure

**Trade-off**: Not human-readable (can't inspect with curl), requires code generation.

---

## Architecture & Design Questions (10)

### 16. Walk me through the request flow when a user creates a task.

**Answer**: 
1. User clicks "Create Tasks" → UI sends POST `/api/schedule/batch`
2. Scheduler validates input and inserts tasks into PostgreSQL
3. Scheduler broadcasts "scheduled" event via SSE to UI
4. Coordinator polls database every 10 seconds, finds pending tasks
5. Coordinator selects next worker using round-robin
6. Coordinator sends gRPC `SubmitTask` to worker
7. Worker adds task to internal queue and returns success
8. Coordinator updates `picked_at` timestamp in database
9. Worker processes task (5 seconds), updates status to STARTED, then COMPLETE
10. Scheduler detects completion via polling, broadcasts SSE event to UI

---

### 17. How does the Coordinator know which workers are available?

**Answer**: Workers send heartbeats every 5 seconds via gRPC `SendHeartbeat(workerId, address)`. The Coordinator maintains a worker registry (Map) and resets `heartbeatMisses` to 0 on each heartbeat. A background job runs every 15 seconds and removes workers with more than 3 missed heartbeats.

---

### 18. What happens if a worker crashes mid-task?

**Answer**: 
1. Worker stops sending heartbeats
2. After 15 seconds (3 missed heartbeats), Coordinator removes worker from pool
3. Task remains in database with `started_at` set but `completed_at` NULL
4. **Current limitation**: Task is stuck forever
5. **Production fix**: Add task timeout - if `started_at` is older than 5 minutes and no completion, mark as failed and retry

---

### 19. How do you prevent two coordinators from assigning the same task?

**Answer**: I use PostgreSQL's `FOR UPDATE SKIP LOCKED`:
```sql
SELECT id, command FROM tasks 
WHERE scheduled_at < NOW() + INTERVAL '30 seconds' 
AND picked_at IS NULL 
FOR UPDATE SKIP LOCKED
```
This locks the rows during the transaction. `SKIP LOCKED` means if another coordinator already locked a row, skip it instead of waiting. This prevents duplicate assignment.

---

### 20. How does the round-robin algorithm work?

**Answer**:
```javascript
getNextWorker() {
  if (workerPoolKeys.length === 0) return null;
  const worker = workerPool.get(
    workerPoolKeys[roundRobinIndex % workerPoolKeys.length]
  );
  roundRobinIndex++;
  return worker;
}
```
I maintain an array of worker IDs and a counter. Each time I assign a task, I increment the counter and use modulo to wrap around.

---

### 21. How many tasks can a single worker process concurrently?

**Answer**: Each Worker instance has an internal pool of 5 concurrent workers (async functions). So one Worker can process 5 tasks simultaneously. If I scale to 10 Workers, the system can handle 50 concurrent tasks.

---

### 22. How do you handle database connection pooling?

**Answer**: I use the `pg` library with a connection pool:
```javascript
const pool = new Pool({
  connectionString: dbConnectionString,
  max: 20,                    // Max 20 connections
  idleTimeoutMillis: 30000,   // Close idle connections after 30s
  connectionTimeoutMillis: 2000
});
```
This reuses connections instead of creating new ones for each query.

---

### 23. What's the 30-second lookahead window in the Coordinator?

**Answer**: The Coordinator queries for tasks scheduled within the next 30 seconds:
```sql
WHERE scheduled_at < (NOW() + INTERVAL '30 seconds')
```
This batches multiple tasks in one transaction instead of processing one at a time. It improves throughput and reduces database load.

---

### 24. How does the UI get real-time updates?

**Answer**: The Scheduler polls the database every 1 second and detects state transitions (e.g., `picked_at` changed from NULL to a timestamp). When detected, it broadcasts an event via Server-Sent Events (SSE) to all connected clients. The React UI listens to this SSE stream and updates the task table in real-time.

---

### 25. How do you scale workers dynamically?

**Answer**: The Scheduler exposes POST `/api/workers/scale` which executes:
```bash
docker-compose -f docker-compose-node.yml up --scale worker=N -d
```
Docker Compose starts new worker containers. Each new worker starts its gRPC server, connects to the Coordinator, and sends a heartbeat to register itself. The Coordinator adds it to the worker pool automatically.

---

## Database & SQL Questions (8)

### 26. Explain your database schema.

**Answer**:
```sql
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  command TEXT NOT NULL,
  scheduled_at TIMESTAMP NOT NULL,
  picked_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  failed_at TIMESTAMP,
  worker_id INTEGER
);
CREATE INDEX idx_tasks_scheduled_at ON tasks (scheduled_at);
CREATE INDEX idx_tasks_worker_id ON tasks (worker_id);
```
- `id`: Auto-generated UUID
- `scheduled_at`: When task should run
- `picked_at`: When coordinator assigned it
- `started_at`: When worker began execution
- `completed_at`: When task finished successfully
- `failed_at`: When task failed
- `worker_id`: Which worker processed it

---

### 27. Why did you use UUIDs instead of auto-increment IDs?

**Answer**: 
- **Distributed-friendly**: Multiple services can generate IDs without coordination
- **No collision risk**: Even if I add multiple schedulers, IDs won't conflict
- **Security**: Harder to guess next ID (vs sequential 1, 2, 3...)

**Trade-off**: UUIDs are 16 bytes vs 4 bytes for INT, but for this scale it's negligible.

---

### 28. What indexes did you create and why?

**Answer**:
1. `idx_tasks_scheduled_at`: Speeds up the Coordinator's polling query (`WHERE scheduled_at < NOW() + 30s`)
2. `idx_tasks_worker_id`: Speeds up queries for tasks by worker (e.g., "show all tasks for worker 5")

Without these, queries would do full table scans.

---

### 29. How do you handle database connection failures?

**Answer**: I have retry logic:
```javascript
async function connectToDatabase(connectionString) {
  let retryCount = 0;
  const maxRetries = 5;
  while (retryCount < maxRetries) {
    try {
      const client = await pool.connect();
      console.log('Connected to database');
      client.release();
      return pool;
    } catch (err) {
      console.log('Failed to connect. Retrying in 5 seconds...');
      await sleep(5000);
      retryCount++;
    }
  }
  throw new Error('Max retries reached');
}
```
This is important for Docker Compose where the database might not be ready when services start.

---

### 30. What's `FOR UPDATE SKIP LOCKED` and why is it important?

**Answer**: 
- `FOR UPDATE`: Locks the selected rows so other transactions can't modify them
- `SKIP LOCKED`: If a row is already locked, skip it instead of waiting

**Why it's important**: Prevents race conditions when multiple coordinators poll simultaneously. Without it, two coordinators could assign the same task to different workers.

---

### 31. How would you handle millions of completed tasks?

**Answer**: 
1. **Archival**: Move completed tasks older than 30 days to a separate `tasks_archive` table
2. **Partitioning**: Partition the `tasks` table by `scheduled_at` (e.g., monthly partitions)
3. **Retention policy**: Delete archived tasks older than 1 year

This keeps the main table small for fast queries.

---

### 32. What's the difference between `picked_at`, `started_at`, and `completed_at`?

**Answer**:
- `picked_at`: Coordinator assigned task to worker (task in transit)
- `started_at`: Worker began processing (task running)
- `completed_at`: Worker finished successfully (task done)

This lets me track: queue time (`picked_at - scheduled_at`), execution time (`completed_at - started_at`), and total time.

---

### 33. How do you ensure task state consistency?

**Answer**: I use database transactions:
```javascript
await client.query('BEGIN');
// 1. Lock tasks
const tasks = await client.query('SELECT ... FOR UPDATE SKIP LOCKED');
// 2. Assign to workers
// 3. Update picked_at
await client.query('UPDATE tasks SET picked_at = NOW() WHERE id = $1');
await client.query('COMMIT');
```
If any step fails, `ROLLBACK` ensures the database stays consistent.

---

## Concurrency & Performance Questions (7)

### 34. How many tasks per second can your system handle?

**Answer**: With 100 workers (each processing 5 concurrent tasks), theoretical max is 500 tasks/second (assuming 5-second task duration). In practice, it's lower due to:
- Database query latency (~10ms)
- gRPC call overhead (~5ms)
- Network latency

Real-world: ~300-400 tasks/second.

---

### 35. What's the bottleneck in your system?

**Answer**: 
1. **Database**: Single PostgreSQL instance. All services query it. Solution: Read replicas for queries, master for writes.
2. **Coordinator**: Single instance (SPOF). Solution: Leader election with Raft/etcd.
3. **Polling latency**: 10-second delay. Solution: Redis pub/sub for instant notifications.

---

### 36. How do you prevent race conditions in task assignment?

**Answer**: `FOR UPDATE SKIP LOCKED` in the database query. This locks rows during the transaction, preventing two coordinators from assigning the same task.

---

### 37. How would you optimize database queries?

**Answer**:
1. **Indexes**: Already have `idx_tasks_scheduled_at` and `idx_tasks_worker_id`
2. **Batch inserts**: Instead of 10 INSERT statements, use one:
   ```sql
   INSERT INTO tasks (command, scheduled_at) VALUES 
   ('task1', NOW()), ('task2', NOW()), ...
   ```
3. **Connection pooling**: Reuse connections (already implemented)
4. **Query optimization**: Use `EXPLAIN ANALYZE` to check query plans

---

### 38. How does the worker pool pattern work?

**Answer**: Each Worker instance starts 5 async functions that continuously poll an internal task queue:
```javascript
async worker() {
  while (!isShuttingDown) {
    if (taskQueue.length > 0) {
      const task = taskQueue.shift();
      await processTask(task);
    } else {
      await sleep(100); // Poll every 100ms
    }
  }
}
```
This allows concurrent task processing without blocking.

---

### 39. What happens if the database goes down?

**Answer**: 
- All services lose their source of truth
- Coordinator can't poll for tasks
- Scheduler can't accept new tasks
- Workers can finish in-flight tasks but can't update status

**Recovery**: Restart services after database is back. Tasks in "STARTED" state would be stuck (need manual intervention or timeout mechanism).

**Production fix**: PostgreSQL replication with automatic failover (Patroni).

---

### 40. How would you handle task priorities?

**Answer**: Add a `priority` column (INT) to the tasks table:
```sql
ALTER TABLE tasks ADD COLUMN priority INT DEFAULT 0;
CREATE INDEX idx_tasks_priority ON tasks (priority);
```
Modify the polling query:
```sql
ORDER BY priority DESC, scheduled_at ASC
```
High-priority tasks get assigned first.

---

## gRPC & Microservices Questions (5)

### 41. What gRPC services did you implement?

**Answer**: Two services:
1. **CoordinatorService** (port 8080):
   - `SendHeartbeat`: Workers register and send heartbeats
   - `UpdateTaskStatus`: Workers report task progress
   - `ListWorkers`: Scheduler queries active workers
   
2. **WorkerService** (dynamic ports):
   - `SubmitTask`: Coordinator assigns tasks to workers

---

### 42. How do workers communicate with the Coordinator?

**Answer**: Workers are gRPC clients to the Coordinator. They call:
- `SendHeartbeat` every 5 seconds
- `UpdateTaskStatus` when task starts/completes

The Coordinator is also a gRPC client to workers, calling `SubmitTask` to assign tasks.

---

### 43. What's in your `.proto` file?

**Answer**:
```protobuf
service CoordinatorService {
  rpc SendHeartbeat (HeartbeatRequest) returns (HeartbeatResponse);
  rpc UpdateTaskStatus (UpdateTaskStatusRequest) returns (UpdateTaskStatusResponse);
}

service WorkerService {
  rpc SubmitTask (TaskRequest) returns (TaskResponse);
}

enum TaskStatus {
  QUEUED = 0;
  STARTED = 1;
  COMPLETE = 2;
  FAILED = 3;
}
```

---

### 44. How do you handle gRPC errors?

**Answer**: I wrap gRPC calls in try-catch:
```javascript
try {
  await coordinatorClient.UpdateTaskStatus(request);
} catch (err) {
  console.error('gRPC call failed:', err.message);
  // For production: retry with exponential backoff
}
```
Currently, errors are just logged. For production, I'd add retries.

---

### 45. Why did you make workers gRPC servers instead of just clients?

**Answer**: The Coordinator needs to push tasks to workers (not pull). If workers were only clients, they'd have to poll the Coordinator for tasks, which adds latency. With workers as servers, the Coordinator can push tasks instantly via `SubmitTask` RPC.

---

## Docker & Deployment Questions (5)

### 46. How does your Docker Compose setup work?

**Answer**:
```yaml
services:
  postgres:
    image: postgres:16
    ports: ["5432:5432"]
  
  coordinator:
    build: .
    dockerfile: coordinator-node.dockerfile
    ports: ["8080:8080"]
    depends_on: [postgres]
  
  scheduler:
    build: .
    dockerfile: scheduler-node.dockerfile
    ports: ["8081:8081"]
    depends_on: [postgres, coordinator]
  
  worker:
    build: .
    dockerfile: worker-node.dockerfile
    depends_on: [coordinator]
```
I can scale workers with `docker-compose up --scale worker=10`.

---

### 47. How do workers discover the Coordinator?

**Answer**: Through Docker Compose networking. Services can reference each other by service name. Workers connect to `coordinator:8080` (hostname = service name).

---

### 48. What's in your worker Dockerfile?

**Answer**:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["node", "cmd/worker/main.js"]
```
It installs dependencies and runs the worker entry point.

---

### 49. How would you deploy this to production?

**Answer**: 
1. **Kubernetes**: Replace Docker Compose with K8s Deployments
2. **Managed Database**: Use AWS RDS or Google Cloud SQL instead of self-hosted PostgreSQL
3. **Container Registry**: Push images to Docker Hub or AWS ECR
4. **CI/CD**: GitHub Actions to build, test, and deploy on every commit
5. **Monitoring**: Prometheus + Grafana for metrics, ELK stack for logs

---

### 50. How do you handle environment variables?

**Answer**: I use environment variables for configuration:
```javascript
const dbHost = process.env.POSTGRES_HOST || 'localhost';
const dbPort = process.env.POSTGRES_PORT || '5432';
const coordinatorAddress = process.env.COORDINATOR_ADDRESS || 'coordinator:8080';
```
In Docker Compose, I set them in the `environment` section. For production, I'd use Kubernetes Secrets or AWS Parameter Store.

---

## Closing Tips

**Before the interview**:
- Memorize the 30-second elevator pitch
- Be ready to draw the architecture on a whiteboard
- Know the key metrics (5s heartbeat, 10s polling, 30s lookahead)

**During the interview**:
- Start with high-level architecture, then drill down
- Acknowledge limitations ("This is a demo, for production I'd add...")
- Discuss trade-offs for every decision ("I chose X over Y because...")

**Good luck! 🚀**
