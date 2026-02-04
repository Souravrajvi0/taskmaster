# Technical Decision Justifications - TaskMaster Project

> **Purpose**: Detailed justifications for all major technical decisions with trade-offs, alternatives considered, and production improvements

---

## 1. Choosing Node.js as the Runtime

### Decision
Use Node.js 20 for all backend services (Scheduler, Coordinator, Worker)

### Context
I needed to choose a runtime that could handle I/O-heavy operations (database queries, gRPC calls, HTTP requests) efficiently while being productive for development.

### Alternatives Considered

| Option | Pros | Cons | Why Not Chosen |
|--------|------|------|----------------|
| **Go** | Faster, better concurrency, compiled | Steeper learning curve, verbose error handling | Wanted to focus on distributed systems concepts, not learning a new language |
| **Python** | Easy to write, great libraries | Slower, GIL limits concurrency | Performance concerns for high-throughput scheduler |
| **Java** | Enterprise-ready, mature ecosystem | Verbose, heavyweight | Too much boilerplate for a demo project |

### Why Node.js Won

1. **Event-Driven Architecture**: Perfect for I/O-bound operations
   - Non-blocking I/O for database queries
   - Async/await makes concurrent operations clean
   - Event loop handles thousands of connections efficiently

2. **Developer Productivity**: 
   - I'm already proficient in JavaScript
   - Fast prototyping with npm ecosystem
   - Same language for frontend (React) and backend

3. **Ecosystem**:
   - Excellent gRPC support (`@grpc/grpc-js`)
   - Mature PostgreSQL driver (`pg`)
   - Express for HTTP APIs

4. **Performance**: 
   - For I/O-bound tasks, Node.js is comparable to Go
   - Single-threaded event loop is sufficient (not CPU-intensive)

### Trade-offs Accepted

- **CPU-Intensive Tasks**: Node.js would struggle with heavy computation (not relevant for this scheduler)
- **Memory Usage**: Higher than Go (acceptable for demo project)
- **Type Safety**: JavaScript is dynamically typed (mitigated with JSDoc comments)

### Production Improvements

- Add TypeScript for type safety
- Use worker threads for CPU-intensive operations if needed
- Consider Go for workers if processing involves heavy computation

---

## 2. Using gRPC for Inter-Service Communication

### Decision
Use gRPC with Protocol Buffers for Coordinator ↔ Worker communication

### Context
I needed a communication protocol for microservices that was fast, type-safe, and supported streaming for future features.

### Alternatives Considered

| Option | Pros | Cons | Why Not Chosen |
|--------|------|------|----------------|
| **REST/HTTP** | Simple, human-readable, widely supported | Slower (JSON serialization), no type safety | Performance and type safety were priorities |
| **GraphQL** | Flexible queries, single endpoint | Overkill for simple RPC, adds complexity | Not needed for point-to-point communication |
| **Message Queue (RabbitMQ)** | Decoupled, persistent, retry logic | Additional infrastructure, more complex | Wanted direct communication for demo |

### Why gRPC Won

1. **Performance**:
   - Binary protocol (Protocol Buffers) is 3-10x faster than JSON
   - Smaller payload size (important for high-throughput)
   - HTTP/2 multiplexing (multiple requests on one connection)

2. **Type Safety**:
   - `.proto` files enforce contracts at compile time
   - Code generation prevents runtime errors
   - Clear interface definitions

3. **Streaming Support**:
   - Supports bi-directional streaming (future: workers push logs to coordinator)
   - Server streaming for task updates
   - Client streaming for batch operations

4. **Language Agnostic**:
   - Easy to add workers in Go, Python, or Java later
   - Protocol Buffers work across languages

### Trade-offs Accepted

- **Debugging Difficulty**: Can't use curl/Postman (need grpcurl or Bloom RPC)
- **Learning Curve**: Had to learn Protocol Buffers syntax
- **Complexity**: More setup than simple REST

### Production Improvements

- Add TLS for encrypted communication
- Implement gRPC interceptors for logging, metrics, authentication
- Use gRPC health checks for better monitoring

---

## 3. Choosing PostgreSQL as the Database

### Decision
Use PostgreSQL 16 for persistent task storage

### Context
I needed a database that could handle concurrent task assignment, complex queries, and guarantee data consistency.

### Alternatives Considered

| Option | Pros | Cons | Why Not Chosen |
|--------|------|------|----------------|
| **Redis** | Fast, simple, pub/sub support | In-memory (data loss on restart), limited query capabilities | Need durability and complex queries |
| **MongoDB** | Flexible schema, horizontal scaling | No ACID transactions (at document level), no `FOR UPDATE SKIP LOCKED` | Need strong consistency |
| **MySQL** | Popular, well-documented | Less advanced features than PostgreSQL | PostgreSQL has better JSON support, `SKIP LOCKED` |
| **SQLite** | Embedded, no server needed | Single-writer, not suitable for distributed systems | Need concurrent writes from multiple services |

### Why PostgreSQL Won

1. **ACID Transactions**:
   - Critical for task state consistency
   - `BEGIN`, `COMMIT`, `ROLLBACK` ensure atomicity
   - Prevents partial updates

2. **`FOR UPDATE SKIP LOCKED`**:
   - Built-in support for queue patterns
   - Prevents race conditions in task assignment
   - No need for external locking mechanism

3. **Complex Queries**:
   - SQL for filtering tasks by time, status, worker
   - Window functions for analytics (e.g., tasks per hour)
   - JSON support for flexible task payloads

4. **Persistence**:
   - Tasks survive system restarts
   - Write-Ahead Logging (WAL) for crash recovery
   - Point-in-time recovery

5. **Indexing**:
   - B-tree indexes for `scheduled_at` queries
   - Partial indexes for pending tasks only
   - GIN indexes for JSON fields

### Trade-offs Accepted

- **Speed**: Slower than Redis for simple key-value operations
- **Horizontal Scaling**: Single instance (can add read replicas, but writes go to master)
- **Operational Overhead**: Need to manage backups, vacuuming, connection pooling

### Production Improvements

- Add read replicas for query load distribution
- Implement connection pooling with PgBouncer
- Set up automated backups with point-in-time recovery
- Use Patroni for high availability and automatic failover

---

## 4. Database Polling vs. Message Queue (Pub/Sub)

### Decision
Use database polling (Coordinator polls every 10 seconds) instead of message queues

### Context
I needed to decide how the Coordinator discovers new tasks: polling the database vs. subscribing to a message queue.

### Alternatives Considered

| Option | Pros | Cons | Why Not Chosen |
|--------|------|------|----------------|
| **RabbitMQ** | Instant notifications, built-in retry, persistent | Additional infrastructure, message loss risk, complexity | Wanted simplicity for demo |
| **Kafka** | High throughput, durable, replay capability | Overkill for this scale, complex setup | Too heavy for demo project |
| **Redis Pub/Sub** | Fast, simple, built-in to Redis | No persistence (messages lost if no subscriber), no replay | Need guaranteed delivery |
| **PostgreSQL LISTEN/NOTIFY** | Built-in, no extra infrastructure | Limited payload size, no persistence | Polling is simpler |

### Why Polling Won

1. **Simplicity**:
   - No additional infrastructure to manage
   - One less service to deploy and monitor
   - Easier to debug (just query the database)

2. **Database as Source of Truth**:
   - No risk of message loss (tasks are in database)
   - No synchronization issues between queue and database
   - Can inspect task state directly

3. **Consistency**:
   - Database transactions ensure consistency
   - No eventual consistency issues
   - Easy to handle failures (just re-query)

4. **Sufficient for Demo**:
   - 10-second latency is acceptable for demo
   - Real-world schedulers (cron, Airflow) also use polling

### Trade-offs Accepted

- **Latency**: 10-second delay vs. instant push (acceptable for demo)
- **Database Load**: Polling adds query load (mitigated with 30-second lookahead)
- **Scalability**: Polling doesn't scale as well as pub/sub (fine for 1000s of tasks)

### Production Improvements

- Add Redis pub/sub for instant notifications
- Keep database as source of truth (pub/sub is just a hint)
- Use database polling as fallback if pub/sub fails
- Implement exponential backoff for polling

**Hybrid Approach**:
```
1. Scheduler inserts task into database
2. Scheduler publishes "new_task" event to Redis
3. Coordinator receives event, immediately queries database
4. Fallback: Coordinator still polls every 10s in case event is missed
```

---

## 5. Round-Robin Load Balancing

### Decision
Use round-robin algorithm to distribute tasks across workers

### Context
I needed a load balancing strategy that was simple, fair, and didn't require tracking worker state.

### Alternatives Considered

| Option | Pros | Cons | Why Not Chosen |
|--------|------|------|----------------|
| **Least Connections** | Better for varying task durations | Need to track active tasks per worker | Added complexity |
| **Weighted Round-Robin** | Accounts for worker capacity differences | Need to configure weights | All workers are identical |
| **Random** | Simple, stateless | Uneven distribution with small worker counts | Round-robin is more predictable |
| **Consistent Hashing** | Good for caching, sticky sessions | Overkill for stateless tasks | Not needed |

### Why Round-Robin Won

1. **Simplicity**:
   - Easy to implement (just a counter and modulo)
   - No state tracking required
   - 10 lines of code

2. **Fairness**:
   - Evenly distributes tasks across workers
   - No worker is overloaded or idle
   - Predictable behavior

3. **Stateless**:
   - Works even if Coordinator restarts (counter resets, but distribution is still fair)
   - No need to persist load balancing state

4. **Sufficient for Uniform Tasks**:
   - All tasks take ~5 seconds (simulated)
   - Workers are identical (same hardware, same code)

### Implementation
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

### Trade-offs Accepted

- **Varying Task Durations**: If tasks take 1s vs 60s, round-robin doesn't account for this
- **Worker Performance**: Doesn't consider worker CPU/memory usage
- **Task Affinity**: No support for routing tasks to specific workers

### Production Improvements

- Implement least-connections for varying task durations
- Add weighted round-robin for heterogeneous workers (e.g., some workers have more CPU)
- Track worker metrics (CPU, memory) and route to least-loaded worker
- Support task affinity (e.g., route all "image-processing" tasks to GPU workers)

---

## 6. Heartbeat-Based Worker Health Checks

### Decision
Workers send heartbeats every 5 seconds; Coordinator removes workers after 3 missed heartbeats (15 seconds)

### Context
I needed a way to detect worker failures without relying on TCP connection state (which can be unreliable).

### Alternatives Considered

| Option | Pros | Cons | Why Not Chosen |
|--------|------|------|----------------|
| **TCP Keep-Alive** | Built-in, no custom logic | Slow to detect failures (minutes), not reliable | Too slow |
| **gRPC Health Checks** | Standard protocol, built-in | Requires workers to implement health service | Wanted custom logic |
| **No Health Checks** | Simplest | Can't detect failures, tasks stuck forever | Unacceptable |

### Why Heartbeats Won

1. **Fast Failure Detection**:
   - 15-second timeout is reasonable (not too aggressive, not too slow)
   - Faster than TCP keep-alive (which can take minutes)

2. **Application-Level**:
   - Detects application crashes, not just network failures
   - Worker can report custom health info (CPU, memory, queue size)

3. **Simple Protocol**:
   - Just a gRPC call every 5 seconds
   - No complex health check logic

4. **Configurable**:
   - Can adjust heartbeat interval and miss threshold
   - Can add backoff for transient network issues

### Implementation
```javascript
// Worker: Send heartbeat every 5s
setInterval(() => {
  coordinatorClient.SendHeartbeat({ workerId, address });
}, 5000);

// Coordinator: Check every 15s, remove workers with >3 misses
setInterval(() => {
  for (const [workerId, worker] of workerPool.entries()) {
    if (worker.heartbeatMisses > 3) {
      console.log(`Removing inactive worker: ${workerId}`);
      workerPool.delete(workerId);
    } else {
      worker.heartbeatMisses++;
    }
  }
}, 15000);
```

### Trade-offs Accepted

- **Network Overhead**: Heartbeats every 5s add network traffic (minimal: ~100 bytes/heartbeat)
- **False Positives**: Network hiccups can cause healthy workers to be removed (mitigated with 3-miss threshold)
- **Stuck Tasks**: Tasks that started but didn't complete are stuck (need timeout mechanism)

### Production Improvements

- Add exponential backoff for heartbeat retries
- Implement task-level heartbeats (workers report progress every minute)
- Add task timeout: mark as failed if `started_at` > 5 minutes and no completion
- Use gRPC health check protocol for standardization

---

## 7. Server-Sent Events (SSE) for Real-Time Updates

### Decision
Use Server-Sent Events (SSE) to stream task updates to the React UI

### Context
I needed a way to push real-time updates from the backend to the frontend without polling.

### Alternatives Considered

| Option | Pros | Cons | Why Not Chosen |
|--------|------|------|----------------|
| **WebSockets** | Bi-directional, lower latency | More complex, need to handle reconnection | Only need one-way (server → client) |
| **HTTP Polling** | Simple, works everywhere | Inefficient, high latency | Wanted real-time updates |
| **Long Polling** | Better than polling, works everywhere | Complex to implement, still inefficient | SSE is simpler |

### Why SSE Won

1. **Simplicity**:
   - Built on HTTP (no special protocol)
   - Works through firewalls and proxies
   - Native browser support (`EventSource` API)

2. **One-Way Communication**:
   - Server → client is all I need (logs, task updates)
   - No need for bi-directional communication

3. **Auto-Reconnect**:
   - Browsers automatically reconnect if connection drops
   - No custom reconnection logic needed

4. **Efficient**:
   - Single long-lived connection (vs. polling every second)
   - Server pushes updates only when state changes

### Implementation
```javascript
// Backend: Broadcast to all SSE clients
broadcastLog(event) {
  const payload = { ts: new Date().toISOString(), ...event };
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const client of sseClients) {
    if (!client.writableEnded) client.write(data);
  }
}

// Frontend: Listen to SSE stream
const eventSource = new EventSource('/api/logs/stream');
eventSource.onmessage = (event) => {
  const log = JSON.parse(event.data);
  setLogs(prev => [...prev, log]);
};
```

### Trade-offs Accepted

- **One-Way Only**: Can't send commands from client to server (use HTTP POST for that)
- **Browser Limit**: Max 6 SSE connections per domain (not an issue for single-page app)
- **No Binary Data**: Text-only (fine for JSON logs)

### Production Improvements

- Add authentication (JWT token in query string or headers)
- Implement backpressure (slow clients shouldn't block fast clients)
- Use Redis pub/sub to broadcast across multiple Scheduler instances
- Add event replay (send last N events to new clients)

---

## 8. Docker Compose for Orchestration

### Decision
Use Docker Compose for local development and demos

### Context
I needed a way to run all services (PostgreSQL, Coordinator, Scheduler, Workers) together easily.

### Alternatives Considered

| Option | Pros | Cons | Why Not Chosen |
|--------|------|------|----------------|
| **Kubernetes** | Production-ready, auto-scaling, self-healing | Complex, overkill for local dev | Too heavy for demo |
| **Docker Swarm** | Simpler than K8s, built into Docker | Less popular, limited ecosystem | Docker Compose is simpler |
| **Manual (npm scripts)** | No Docker overhead, faster iteration | Hard to manage dependencies, not portable | Wanted containerization |

### Why Docker Compose Won

1. **Simplicity**:
   - Single `docker-compose.yml` file
   - One command to start everything: `docker-compose up`
   - Easy to scale: `docker-compose up --scale worker=10`

2. **Portability**:
   - Works on any machine with Docker
   - No "works on my machine" issues
   - Easy to share with others

3. **Service Discovery**:
   - Services can reference each other by name (e.g., `coordinator:8080`)
   - Automatic DNS resolution

4. **Dependency Management**:
   - `depends_on` ensures services start in order
   - PostgreSQL starts before Coordinator

### Implementation
```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: scheduler
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports: ["5432:5432"]
  
  coordinator:
    build: .
    dockerfile: coordinator-node.dockerfile
    ports: ["8080:8080"]
    depends_on: [postgres]
    environment:
      POSTGRES_HOST: postgres
  
  worker:
    build: .
    dockerfile: worker-node.dockerfile
    depends_on: [coordinator]
    environment:
      COORDINATOR_ADDRESS: coordinator:8080
```

### Trade-offs Accepted

- **Not Production-Ready**: Docker Compose is for dev/test, not production
- **No Auto-Scaling**: Can't scale based on CPU/memory (Kubernetes can)
- **No Self-Healing**: If a container crashes, it doesn't restart automatically (unless configured)

### Production Improvements

- Migrate to Kubernetes for production
- Use Helm charts for configuration management
- Implement horizontal pod autoscaling (HPA)
- Add liveness and readiness probes
- Use managed database (AWS RDS) instead of containerized PostgreSQL

---

## 9. Internal Worker Pool (5 Concurrent Workers per Instance)

### Decision
Each Worker instance has an internal pool of 5 async workers that process tasks concurrently

### Context
I needed workers to process multiple tasks simultaneously without blocking.

### Alternatives Considered

| Option | Pros | Cons | Why Not Chosen |
|--------|------|------|----------------|
| **One Task at a Time** | Simple, no concurrency issues | Inefficient, low throughput | Wanted higher throughput |
| **Unlimited Concurrency** | Max throughput | Can overwhelm worker, OOM errors | Need to limit resource usage |
| **Worker Threads** | True parallelism for CPU tasks | More complex, not needed for I/O | Tasks are I/O-bound |

### Why Worker Pool (5) Won

1. **Concurrency Without Blocking**:
   - Process 5 tasks simultaneously
   - Event loop handles I/O efficiently

2. **Resource Control**:
   - Limit concurrent tasks to prevent OOM
   - 5 is a reasonable default (can be configured)

3. **Simple Implementation**:
   - Just 5 async functions polling a shared queue
   - No complex thread management

### Implementation
```javascript
startWorkerPool(numWorkers = 5) {
  for (let i = 0; i < numWorkers; i++) {
    this.workerPromises.push(this.worker());
  }
}

async worker() {
  while (!isShuttingDown) {
    if (taskQueue.length > 0) {
      const task = taskQueue.shift();
      await updateTaskStatus(task, 'STARTED');
      await processTask(task); // 5 seconds
      await updateTaskStatus(task, 'COMPLETE');
    } else {
      await sleep(100); // Poll queue every 100ms
    }
  }
}
```

### Trade-offs Accepted

- **Fixed Pool Size**: Doesn't adapt to load (could use dynamic sizing)
- **Queue Polling**: Workers poll queue every 100ms (could use event emitter)

### Production Improvements

- Make pool size configurable via environment variable
- Implement dynamic pool sizing based on queue depth
- Use event emitter instead of polling (push vs. pull)
- Add worker metrics (tasks/sec, queue depth, processing time)

---

## 10. UUID for Task IDs

### Decision
Use UUID v4 for task IDs instead of auto-increment integers

### Context
I needed unique task identifiers that could be generated by multiple services without coordination.

### Alternatives Considered

| Option | Pros | Cons | Why Not Chosen |
|--------|------|------|----------------|
| **Auto-Increment INT** | Small (4 bytes), sequential, easy to debug | Requires database coordination, predictable | Not distributed-friendly |
| **Snowflake ID** | Time-ordered, unique, 64-bit | Need to manage worker IDs, more complex | Overkill for demo |
| **ULID** | Time-ordered, URL-safe, sortable | Less standard than UUID | UUID is more widely supported |

### Why UUID Won

1. **Distributed-Friendly**:
   - Multiple services can generate IDs without coordination
   - No single point of failure (no ID generator service)

2. **Collision-Free**:
   - Probability of collision is negligible (2^122 possible UUIDs)
   - Safe even with millions of tasks

3. **Security**:
   - Harder to guess next ID (vs. sequential 1, 2, 3...)
   - Prevents enumeration attacks

4. **PostgreSQL Support**:
   - Native UUID type with `uuid_generate_v4()`
   - Efficient storage and indexing

### Implementation
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ...
);
```

### Trade-offs Accepted

- **Size**: 16 bytes vs. 4 bytes for INT (negligible for this scale)
- **Not Sequential**: Can't sort by ID to get creation order (use `scheduled_at` instead)
- **Harder to Debug**: UUIDs are long and hard to remember (vs. "task 123")

### Production Improvements

- Use ULID for time-ordered IDs (sortable by creation time)
- Add `created_at` timestamp for debugging
- Use short IDs for user-facing displays (first 8 characters of UUID)

---

## Summary: Key Principles

Across all decisions, I followed these principles:

1. **Simplicity Over Perfection**: Chose simpler solutions for demo (polling vs. pub/sub, Docker Compose vs. K8s)
2. **Database as Source of Truth**: Avoided distributed state; database is the single source of truth
3. **Type Safety**: Used Protocol Buffers for gRPC to catch errors at compile time
4. **Observability**: Designed for debugging (SSE logs, database queries, Docker logs)
5. **Production-Aware**: Acknowledged limitations and documented production improvements

**For Interviews**: Always discuss trade-offs and production improvements. Shows maturity and real-world thinking.
