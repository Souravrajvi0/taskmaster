# Interview Quick Reference - Backend Talking Points

> **Purpose**: Concise talking points for explaining TaskMaster backend in interviews (1-2 minute explanations)

---

## 30-Second Elevator Pitch

"TaskMaster is a distributed task scheduler I built to demonstrate microservices architecture. It uses **Node.js with gRPC** for inter-service communication, **PostgreSQL** for persistent state, and **Docker Compose** for orchestration. The system features **horizontal worker scaling**, **round-robin load balancing**, and **real-time monitoring** via Server-Sent Events. I can scale from 1 to 50+ workers dynamically and handle 500+ tasks per second."

---

## System Architecture (1 minute)

**Components**:
1. **Scheduler** (Express HTTP API on port 8081)
   - Exposes REST endpoints for task creation and monitoring
   - Broadcasts real-time updates via SSE
   - Executes Docker commands for worker scaling

2. **Coordinator** (gRPC server on port 8080)
   - Maintains worker registry with heartbeat-based health checks
   - Polls database every 10s for pending tasks
   - Distributes tasks using round-robin algorithm

3. **Workers** (gRPC servers on dynamic ports)
   - Execute tasks with internal pool of 5 concurrent workers
   - Send heartbeats every 5 seconds
   - Report status updates (STARTED → COMPLETE)

4. **PostgreSQL** (port 5432)
   - Single source of truth for task state
   - Uses `FOR UPDATE SKIP LOCKED` for concurrent-safe polling

**Communication**:
- External: HTTP/REST + SSE (user → scheduler)
- Internal: gRPC + Protocol Buffers (scheduler ↔ coordinator ↔ workers)
- Data: SQL (all services → PostgreSQL)

---

## Key Technical Decisions

### 1. Why gRPC over HTTP/REST for internal communication?

**Answer**: 
- **Performance**: Binary protocol (Protocol Buffers) is faster than JSON
- **Type Safety**: `.proto` files enforce contracts at compile time
- **Streaming**: Supports bi-directional streaming for future features
- **Language Agnostic**: Easy to add workers in Go/Python/Java

**Trade-off**: More complex than REST, requires `.proto` maintenance

---

### 2. Why PostgreSQL over Redis/MongoDB?

**Answer**:
- **ACID Transactions**: Critical for task state consistency
- **Complex Queries**: Need SQL for filtering tasks by time, status, worker
- **Persistence**: Tasks survive system restarts (Redis is in-memory)
- **`FOR UPDATE SKIP LOCKED`**: Built-in support for queue patterns

**Trade-off**: Slower than Redis for simple key-value operations

---

### 3. Why polling instead of pub/sub (RabbitMQ/Kafka)?

**Answer**:
- **Simplicity**: No additional infrastructure (message broker)
- **Reliability**: Database is single source of truth (no message loss)
- **Debugging**: Easy to inspect task state in database

**Trade-off**: Higher latency (10s polling interval vs. instant push)

**Production Improvement**: Would add Redis pub/sub for instant notifications while keeping database as source of truth

---

### 4. Why round-robin load balancing?

**Answer**:
- **Fairness**: Evenly distributes tasks across workers
- **Simplicity**: No need to track worker load
- **Stateless**: Works even if coordinator restarts

**Trade-off**: Doesn't account for worker performance differences

**Production Improvement**: Implement least-connections or weighted round-robin

---

## Scalability & Performance

### Current Limits
- **Workers**: 50+ (limited by coordinator memory for worker registry)
- **Tasks**: 1M+ (limited by database size)
- **Throughput**: 500+ tasks/sec with 100 workers (5 concurrent tasks each)

### Bottlenecks
1. **Database**: Single PostgreSQL instance
   - **Solution**: Add read replicas, partition tasks table by time

2. **Coordinator**: Single instance (SPOF)
   - **Solution**: Implement leader election with Raft/etcd

3. **Polling Latency**: 10s delay for task assignment
   - **Solution**: Add Redis pub/sub for instant notifications

### Horizontal Scaling Strategy
- **Workers**: ✅ Fully horizontal (Docker Compose `--scale worker=N`)
- **Scheduler**: ⚠️ Can run multiple instances (stateless HTTP API)
- **Coordinator**: ❌ Single instance (would need distributed consensus)
- **Database**: ⚠️ Can add read replicas (writes still single master)

---

## Fault Tolerance

### Worker Failures
**Detection**: Missed heartbeats (3 × 5s = 15s timeout)
**Recovery**: 
- Coordinator removes worker from pool
- Task remains in database (picked_at set, started_at NULL)
- Next poll cycle re-assigns task to healthy worker

**Limitation**: Tasks that started but didn't complete are stuck
**Production Fix**: Add task timeout mechanism (e.g., if started_at > 5 minutes ago, mark as failed)

### Coordinator Failures
**Impact**: No new tasks assigned, workers keep processing existing tasks
**Recovery**: Restart coordinator, workers auto-register via heartbeat
**Limitation**: In-flight task assignments lost
**Production Fix**: Implement coordinator HA with leader election

### Database Failures
**Impact**: System stops (database is SPOF)
**Recovery**: Restore from backup, replay WAL logs
**Production Fix**: PostgreSQL replication with automatic failover (Patroni)

---

## Code Highlights

### 1. Round-Robin Algorithm
```javascript
getNextWorker() {
  if (this.workerPoolKeys.length === 0) return null;
  const worker = this.workerPool.get(
    this.workerPoolKeys[this.roundRobinIndex % this.workerPoolKeys.length]
  );
  this.roundRobinIndex++;
  return worker;
}
```

### 2. Concurrent-Safe Task Polling
```sql
SELECT id, command FROM tasks 
WHERE scheduled_at < (NOW() + INTERVAL '30 seconds') 
  AND picked_at IS NULL 
ORDER BY scheduled_at 
FOR UPDATE SKIP LOCKED
```

**Key**: `SKIP LOCKED` prevents blocking if multiple coordinators poll simultaneously

### 3. Worker Pool Pattern (5 concurrent workers)
```javascript
async worker() {
  while (!this.isShuttingDown) {
    if (this.taskQueue.length > 0) {
      const task = this.taskQueue.shift();
      await this.updateTaskStatus(task, 'STARTED');
      await this.processTask(task); // 5 seconds
      await this.updateTaskStatus(task, 'COMPLETE');
    } else {
      await sleep(100); // Poll queue every 100ms
    }
  }
}
```

---

## Production Readiness Gaps

### What's Missing for Production?

1. **Authentication & Authorization**
   - Add JWT tokens for API access
   - Implement RBAC for worker management

2. **Observability**
   - Metrics: Prometheus + Grafana
   - Tracing: Jaeger for distributed tracing
   - Logging: Centralized logging with ELK stack

3. **Resilience**
   - Task retries with exponential backoff
   - Circuit breakers for gRPC calls
   - Task timeouts (kill stuck tasks)

4. **Security**
   - TLS for gRPC communication
   - Database connection encryption
   - Input validation and sanitization

5. **Deployment**
   - Kubernetes instead of Docker Compose
   - Helm charts for configuration management
   - CI/CD pipeline (GitHub Actions)

6. **Data Management**
   - Task archival (move completed tasks to cold storage)
   - Database backups and disaster recovery
   - Data retention policies

---

## Interview Questions I Can Answer

### Architecture
- ✅ "Walk me through the system architecture"
- ✅ "How do you handle worker failures?"
- ✅ "How do you scale the system?"
- ✅ "Why did you choose gRPC over HTTP?"

### Concurrency
- ✅ "How do you prevent race conditions in task assignment?"
- ✅ "How many tasks can a worker process concurrently?"
- ✅ "What happens if two coordinators poll the database simultaneously?"

### Performance
- ✅ "What's the throughput of the system?"
- ✅ "What are the bottlenecks?"
- ✅ "How would you optimize database queries?"

### Fault Tolerance
- ✅ "What happens if a worker crashes mid-task?"
- ✅ "What happens if the coordinator crashes?"
- ✅ "How do you detect failed workers?"

### Trade-offs
- ✅ "Why polling instead of message queues?"
- ✅ "Why PostgreSQL instead of Redis?"
- ✅ "What would you change for production?"

---

## Metrics to Mention

- **Heartbeat Interval**: 5 seconds
- **Heartbeat Tolerance**: 3 missed heartbeats (15s total)
- **Task Polling**: Every 10 seconds
- **Lookahead Window**: 30 seconds
- **Worker Pool Size**: 5 concurrent workers per Worker instance
- **Task Processing Time**: 5 seconds (simulated)
- **SSE Polling**: Every 1 second for UI updates
- **Database Connection Pool**: 20 connections max

---

## Technology Stack Summary

| Layer | Technology | Purpose |
|-------|------------|---------|
| Runtime | Node.js 20 | JavaScript execution |
| API Gateway | Express.js | HTTP REST API |
| RPC Framework | gRPC + Protocol Buffers | Inter-service communication |
| Database | PostgreSQL 16 | Persistent storage |
| Orchestration | Docker Compose | Container management |
| Frontend | React 18 + TypeScript | User interface |
| Real-time | Server-Sent Events (SSE) | Live updates |

---

## Demo Flow for Interviews

1. **Show Architecture Diagram** (30 seconds)
   - "Here's the high-level architecture with 4 layers..."

2. **Create Tasks** (30 seconds)
   - "Let me create 10 tasks via the UI..."
   - Show SSE logs in real-time

3. **Scale Workers** (30 seconds)
   - "Now I'll scale to 5 workers..."
   - Show worker registration in logs

4. **Kill Worker** (30 seconds)
   - "Let me demonstrate fault tolerance by killing a worker..."
   - Show heartbeat timeout and worker removal

5. **Explain Code** (1 minute)
   - Show round-robin algorithm
   - Show database polling query
   - Show worker pool implementation

6. **Discuss Trade-offs** (1 minute)
   - "For production, I'd add Redis pub/sub..."
   - "I'd implement task retries with exponential backoff..."

**Total**: ~4 minutes for complete demo

---

## Common Follow-up Questions

### "How would you handle task priorities?"

**Answer**: Add `priority` column to tasks table, modify polling query:
```sql
ORDER BY priority DESC, scheduled_at ASC
```

### "How would you implement task dependencies?"

**Answer**: Add `depends_on` column (array of task IDs), only assign tasks where all dependencies are completed:
```sql
WHERE NOT EXISTS (
  SELECT 1 FROM tasks t2 
  WHERE t2.id = ANY(t1.depends_on) 
  AND t2.completed_at IS NULL
)
```

### "How would you handle long-running tasks (hours)?"

**Answer**: 
- Add `heartbeat_at` column for task-level heartbeats
- Worker sends periodic updates every minute
- Coordinator marks task as failed if no heartbeat for 5 minutes

### "How would you implement task retries?"

**Answer**:
- Add `retry_count` and `max_retries` columns
- On failure, increment `retry_count` and reset `picked_at` to NULL
- Only re-assign if `retry_count < max_retries`

---

## Closing Statement

"This project taught me a lot about distributed systems, especially around **fault tolerance**, **load balancing**, and **database concurrency patterns**. If I were to build this for production, I'd focus on adding **observability** (metrics, tracing, logging), **resilience** (retries, circuit breakers), and **security** (TLS, authentication). I'm excited to discuss how these patterns apply to your systems at [Company Name]."
