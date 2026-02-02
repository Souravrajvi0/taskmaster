# TaskMaster Codebase Walkthrough

## Overview

**TaskMaster** is a production-ready **distributed task scheduling system** built with Node.js, demonstrating core distributed systems concepts through an interactive web interface. It features horizontal scaling, fault tolerance, real-time monitoring, and persistent state management.

### Key Highlights
- 🎯 **Interview-Ready Demo Tool** - Visually demonstrate distributed systems concepts
- 🚀 **Horizontal Scaling** - Add/remove workers dynamically via UI buttons
- ⚡ **Real-Time Monitoring** - Live task updates via Server-Sent Events (SSE)
- 💪 **Fault Tolerant** - Tasks continue processing if workers fail
- 🎨 **Interactive UI** - Built with React + TypeScript + Tailwind CSS
- 🔄 **Round-Robin Distribution** - Fair task allocation across workers

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    React UI (localhost:5173)                     │
│  Dashboard • Bulk Task Creation • Worker Controls • Live Logs   │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP + SSE
                    ┌────────▼─────────┐
                    │  Scheduler       │
                    │  Express (8081)  │
                    │  • HTTP API      │
                    │  • SSE Logs      │
                    │  • Task Polling  │
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              │ gRPC         │ gRPC         │ SQL
    ┌─────────▼────────┐    │    ┌────────▼────────┐
    │  Coordinator     │    │    │  PostgreSQL     │
    │  gRPC (8080)     │────┘    │  (5432)         │
    │  • Worker Pool   │         │  • tasks table  │
    │  • Task Dispatch │         └─────────────────┘
    │  • Heartbeats    │
    └─────────┬────────┘
              │ gRPC
    ┌─────────▼──────────────────────┐
    │  Workers (N instances)         │
    │  • Task Execution              │
    │  • Status Updates              │
    │  • Heartbeat to Coordinator    │
    └────────────────────────────────┘
```

### Component Responsibilities

| Component | Port | Technology | Purpose |
|-----------|------|------------|---------|
| **Frontend** | 5173 | React + Vite | Interactive UI, real-time monitoring |
| **Scheduler** | 8081 | Express | HTTP API, SSE logs, task polling |
| **Coordinator** | 8080 | gRPC | Worker registry, task dispatch, load balancing |
| **Workers** | Dynamic | gRPC | Task execution, heartbeat, status reporting |
| **PostgreSQL** | 5432 | SQL | Persistent task storage |

---

## Technology Stack

### Backend
- **Node.js 20** - Runtime environment
- **Express** - HTTP API server for scheduler
- **gRPC** (@grpc/grpc-js) - Inter-service communication
- **PostgreSQL 16** - Task persistence and state management
- **Protocol Buffers** - Service definitions
- **Docker Compose** - Container orchestration

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite 7.3** - Build tool + dev server + HMR
- **TanStack Query** - Data fetching + caching
- **Wouter** - Client-side routing
- **Radix UI** - Accessible components
- **Tailwind CSS 3.4** - Styling
- **Server-Sent Events** - Real-time logs

### Testing
- **Jest** - Test framework
- **Testcontainers** - Docker integration tests

---

## Project Structure

```
TaskMaster-master/
├── cmd/                          # Entry points for services
│   ├── coordinator/main.js       # Coordinator service entry
│   ├── scheduler/main.js         # Scheduler service entry
│   └── worker/main.js            # Worker service entry
│
├── pkg/                          # Core business logic
│   ├── coordinator/
│   │   └── coordinator.js        # Worker pool, task dispatch, heartbeats
│   ├── scheduler/
│   │   └── scheduler.js          # HTTP API, SSE logs, task polling
│   ├── worker/
│   │   └── worker.js             # Task execution, status updates
│   ├── common/
│   │   └── common.js             # Shared utilities (DB connection, constants)
│   ├── db/
│   │   └── setup.sql             # PostgreSQL schema
│   └── grpcapi/
│       └── api.proto             # gRPC service definitions
│
├── client/                       # Frontend application
│   ├── client/src/               # React source code
│   │   ├── App.tsx               # Main app component
│   │   ├── pages/                # Page components
│   │   │   ├── dashboard.tsx     # Main dashboard
│   │   │   ├── schedule.tsx      # Task scheduling page
│   │   │   └── task-detail.tsx   # Task detail view
│   │   └── components/           # Reusable UI components
│   │       ├── bulk-task-panel.tsx
│   │       ├── worker-control-panel.tsx
│   │       ├── enhanced-task-table.tsx
│   │       └── activity-log.tsx
│   ├── server/                   # Backend API routes
│   │   └── routes.ts             # Express routes
│   └── package.json              # Frontend dependencies
│
├── docker-compose-node.yml       # Docker orchestration
├── coordinator-node.dockerfile   # Coordinator container
├── scheduler-node.dockerfile     # Scheduler container
├── worker-node.dockerfile        # Worker container
├── postgres-dockerfile           # PostgreSQL container
├── package.json                  # Backend dependencies
└── README.md                     # Comprehensive documentation
```

---

## Core Components Deep Dive

### 1. Scheduler Service

**Location**: [`pkg/scheduler/scheduler.js`](file:///c:/Users/DELL/Desktop/index/PROJECTS/TASKMASTER/TaskMaster-master/pkg/scheduler/scheduler.js)

**Responsibilities**:
- Expose HTTP API on port 8081
- Accept and validate task submissions
- Persist tasks to PostgreSQL
- Provide task status queries
- Generate unique task IDs (UUID v4)
- Stream real-time logs via SSE
- Control worker scaling and lifecycle

**Key Classes**:
- `SchedulerServer` - Main server class
- `LogBuffer` - Ring buffer for recent log events (200 items)

**HTTP Routes**:

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/schedule` | Create single task |
| POST | `/api/schedule/batch` | Create 1-1000 tasks at once |
| GET | `/api/status?task_id=<id>` | Get task status |
| GET | `/api/tasks` | List all tasks |
| GET | `/api/stats` | System statistics |
| GET | `/api/workers` | List workers |
| POST | `/api/workers/scale` | Scale workers (1-50) |
| POST | `/api/workers/kill` | Kill specific worker |
| GET | `/api/logs` | Recent logs (JSON) |
| GET | `/api/logs/stream` | Real-time logs (SSE) |

**Key Features**:
- **Log Polling**: Every 1 second, polls database for task state transitions
- **SSE Broadcasting**: Emits events (scheduled, assigned, started, completed, failed)
- **Worker Scaling**: Shells to Docker Compose to scale workers
- **Graceful Shutdown**: Handles SIGINT/SIGTERM

---

### 2. Coordinator Service

**Location**: [`pkg/coordinator/coordinator.js`](file:///c:/Users/DELL/Desktop/index/PROJECTS/TASKMASTER/TaskMaster-master/pkg/coordinator/coordinator.js)

**Responsibilities**:
- Maintain worker registry (thread-safe with async patterns)
- Accept worker heartbeats (every 5s)
- Remove inactive workers (after 3 missed heartbeats)
- Scan database for due tasks (every 10s)
- Distribute tasks via round-robin
- Update task status in database

**Key Classes**:
- `CoordinatorServer` - Main coordinator class
- `WorkerInfo` - Worker metadata (id, address, heartbeat misses, tasks completed)

**gRPC Services**:
```protobuf
service CoordinatorService {
  rpc SubmitTask (ClientTaskRequest) returns (ClientTaskResponse);
  rpc SendHeartbeat (HeartbeatRequest) returns (HeartbeatResponse);
  rpc UpdateTaskStatus (UpdateTaskStatusRequest) returns (UpdateTaskStatusResponse);
  rpc ListWorkers (ListWorkersRequest) returns (ListWorkersResponse);
}
```

**Worker Pool Management**:
- Uses `Map<workerId, WorkerInfo>` for worker registry
- Maintains `workerPoolKeys` array for round-robin indexing
- Tracks heartbeat misses and removes workers exceeding threshold
- Maintains gRPC connections to each worker

**Task Distribution Algorithm**:
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

**Database Polling** (every 10 seconds):
```sql
SELECT id, command 
FROM tasks 
WHERE scheduled_at < (NOW() + INTERVAL '30 seconds') 
  AND picked_at IS NULL 
ORDER BY scheduled_at 
FOR UPDATE SKIP LOCKED;
```

**Key Features**:
- **Lookahead Window**: 30 seconds to batch tasks
- **SKIP LOCKED**: Prevents contention in multi-coordinator scenarios
- **Transaction Safety**: BEGIN/COMMIT/ROLLBACK handling
- **Heartbeat Monitoring**: setInterval checks every 5s
- **Automatic Cleanup**: Removes workers with >3 missed heartbeats

---

### 3. Worker Service

**Location**: [`pkg/worker/worker.js`](file:///c:/Users/DELL/Desktop/index/PROJECTS/TASKMASTER/TaskMaster-master/pkg/worker/worker.js)

**Responsibilities**:
- Register with coordinator on startup
- Send heartbeats every 5 seconds
- Receive tasks via gRPC
- Manage internal task queue (array-based)
- Process tasks with worker pool (5 concurrent workers)
- Report status updates (STARTED, COMPLETE, FAILED)

**gRPC Service**:
```protobuf
service WorkerService {
  rpc SubmitTask (TaskRequest) returns (TaskResponse);
}
```

**Worker Pool Architecture**:
- **In-memory task queue**: Array-based FIFO queue
- **Worker pool size**: 5 concurrent async workers
- **Task processing time**: 5 seconds (simulated)

**Worker Loop**:
```javascript
async worker() {
  while (!this.isShuttingDown) {
    if (this.taskQueue.length > 0) {
      const task = this.taskQueue.shift();
      await this.updateTaskStatus(task, 1); // STARTED
      await this.processTask(task);
      await this.updateTaskStatus(task, 2); // COMPLETE
    } else {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}
```

**Startup Sequence**:
1. Start gRPC server (binds to random port)
2. Connect to coordinator
3. Start heartbeat interval
4. Start worker pool (5 concurrent async functions)

---

### 4. Database Schema

**Location**: [`pkg/db/setup.sql`](file:///c:/Users/DELL/Desktop/index/PROJECTS/TASKMASTER/TaskMaster-master/pkg/db/setup.sql)

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

**Task States**:
1. **Scheduled**: `scheduled_at` set, `picked_at` NULL
2. **Assigned**: `picked_at` set, `started_at` NULL
3. **Running**: `started_at` set, `completed_at` NULL, `failed_at` NULL
4. **Completed**: `completed_at` set
5. **Failed**: `failed_at` set

---

## Data Flow

### Task Creation Flow

1. **User clicks "Create Tasks"** → POST `/api/schedule/batch`
2. **Scheduler inserts tasks** into PostgreSQL
3. **Scheduler broadcasts "scheduled" event** via SSE
4. **Coordinator polls DB** (every 10s), finds pending tasks
5. **Coordinator assigns to workers** (round-robin)
6. **Coordinator updates** `picked_at` and `worker_id`

### Task Execution Flow

1. **Worker receives task** via gRPC `SubmitTask`
2. **Worker updates status to "STARTED"** in DB
3. **Worker executes task** (5-second simulation)
4. **Worker updates status to "COMPLETED"**
5. **Scheduler detects completion**, broadcasts via SSE
6. **React UI updates** task table and worker stats

### Worker Scaling Flow

1. **User clicks "5 Workers" button** → POST `/api/workers/scale`
2. **Scheduler runs** `docker-compose up --scale worker=5`
3. **New workers start**, send heartbeats to coordinator
4. **Coordinator adds workers** to pool
5. **React UI shows** updated worker count

---

## Frontend Architecture

### Technology Stack
- **React 18** with TypeScript
- **Wouter** for routing
- **TanStack Query** for data fetching and caching
- **Radix UI** for accessible components
- **Tailwind CSS** for styling
- **Framer Motion** for animations

### Key Pages

1. **Dashboard** ([`dashboard.tsx`](file:///c:/Users/DELL/Desktop/index/PROJECTS/TASKMASTER/TaskMaster-master/client/client/src/pages/dashboard.tsx))
   - System statistics (total, pending, running, completed, failed)
   - Worker cards with status and metrics
   - Enhanced task table with real-time updates
   - Bulk task creation panel
   - Worker control panel (scale, kill)
   - Activity log with SSE

2. **Schedule Task** ([`schedule.tsx`](file:///c:/Users/DELL/Desktop/index/PROJECTS/TASKMASTER/TaskMaster-master/client/client/src/pages/schedule.tsx))
   - Form to create individual tasks
   - Command input and scheduled time picker

3. **Task Detail** ([`task-detail.tsx`](file:///c:/Users/DELL/Desktop/index/PROJECTS/TASKMASTER/TaskMaster-master/client/client/src/pages/task-detail.tsx))
   - Detailed view of single task
   - Timeline visualization
   - Status transitions

### Key Components

- **BulkTaskPanel** - Create 1-1000 tasks at once
- **WorkerControlPanel** - Scale workers (1/3/5/10) or kill specific workers
- **EnhancedTaskTable** - Sortable, filterable task list with real-time updates
- **ActivityLog** - SSE-powered live event stream
- **StatusBadge** - Visual task status indicator
- **Timeline** - Task lifecycle visualization

### State Management
- **TanStack Query** for server state
  - Automatic refetching
  - Background updates
  - Optimistic updates
  - Cache invalidation
- **React hooks** for local state

---

## Docker Configuration

**Location**: [`docker-compose-node.yml`](file:///c:/Users/DELL/Desktop/index/PROJECTS/TASKMASTER/TaskMaster-master/docker-compose-node.yml)

### Services

1. **postgres** - PostgreSQL 16 database
   - Port: 5432
   - Volume: `./data:/var/lib/postgresql/data`
   - Schema auto-loaded from `setup.sql`

2. **coordinator** - Coordinator service
   - Port: 8080
   - Connects to postgres
   - gRPC server for workers

3. **scheduler** - Scheduler service
   - Port: 8081
   - Connects to postgres and coordinator
   - HTTP API and SSE
   - Docker socket mounted for scaling

4. **worker** - Worker service (scalable)
   - Dynamic ports
   - Connects to coordinator
   - Scalable via `--scale worker=N`

### Environment Variables

```yaml
POSTGRES_DB: scheduler
POSTGRES_USER: postgres
POSTGRES_PASSWORD: postgres
POSTGRES_HOST: postgres
POSTGRES_PORT: 5432
SCHEDULER_PORT: :8081
COORDINATOR_ADDRESS: coordinator:8080
COORDINATOR_PORT: :8080
WORKER_ADDRESS: worker
```

---

## Key Timing Parameters

| Parameter | Value | Location |
|-----------|-------|----------|
| Worker pool size | 5 | `pkg/worker/worker.js` |
| Task processing time | 5 seconds | `pkg/worker/worker.js` |
| Coordinator DB scan interval | 10 seconds | `pkg/coordinator/coordinator.js` |
| Coordinator lookahead window | 30 seconds | `pkg/coordinator/coordinator.js` |
| Heartbeat interval | 5 seconds | `pkg/common/common.js` |
| Max heartbeat misses | 3 | `pkg/coordinator/coordinator.js` |
| Scheduler log poll interval | 1 second | `pkg/scheduler/scheduler.js` |
| DB pool max connections | 20 | `pkg/common/common.js` |
| DB connection timeout | 2 seconds | `pkg/common/common.js` |
| DB idle timeout | 30 seconds | `pkg/common/common.js` |

---

## API Reference

### HTTP API (Scheduler)

#### POST /api/schedule/batch
Create multiple tasks at once.

**Request**:
```json
{
  "command": "demo-job",
  "count": 25,
  "delay_seconds": 5
}
```

**Response**:
```json
{
  "message": "25 tasks scheduled",
  "task_ids": ["uuid1", "uuid2", ...]
}
```

#### GET /api/stats
Get system statistics.

**Response**:
```json
{
  "total_tasks": 100,
  "pending_tasks": 10,
  "running_tasks": 5,
  "completed_tasks": 80,
  "failed_tasks": 5,
  "workers": [
    {
      "id": 123456,
      "address": "worker:50051",
      "tasks_completed": 15,
      "current_task_id": "uuid",
      "last_active_at": "2026-02-02T22:00:00Z"
    }
  ]
}
```

#### POST /api/workers/scale
Scale worker count.

**Request**:
```json
{
  "count": 5
}
```

**Response**:
```json
{
  "message": "Scaled to 5 workers"
}
```

#### GET /api/logs/stream
Server-Sent Events stream for real-time logs.

**Event Types**:
- `scheduled` - Task created
- `assigned` - Task assigned to worker
- `started` - Task execution started
- `completed` - Task completed successfully
- `failed` - Task failed
- `scale` - Workers scaled
- `kill` - Worker killed

---

## Development Workflow

### Running Locally (Docker)

```bash
# Start all services with 3 workers
docker-compose -f docker-compose-node.yml up --build --scale worker=3 -d

# Check status
docker-compose -f docker-compose-node.yml ps

# View logs
docker-compose -f docker-compose-node.yml logs -f scheduler

# Scale workers
docker-compose -f docker-compose-node.yml up --scale worker=10 -d

# Stop all services
docker-compose -f docker-compose-node.yml down -v
```

### Running Locally (Without Docker)

```bash
# Install dependencies
npm install

# Setup PostgreSQL
psql -U postgres -c "CREATE DATABASE scheduler;"
psql -U postgres -d scheduler -f pkg/db/setup.sql

# Set environment variables
export POSTGRES_USER=postgres
export POSTGRES_PASSWORD=postgres
export POSTGRES_DB=scheduler
export POSTGRES_HOST=localhost
export POSTGRES_PORT=5432

# Run services (3 terminals)
npm run coordinator
npm run scheduler
npm run worker
```

### Frontend Development

```bash
cd client
npm install
npm run dev
# Open http://localhost:5173
```

---

## Testing

**Location**: [`tests/`](file:///c:/Users/DELL/Desktop/index/PROJECTS/TASKMASTER/TaskMaster-master/tests)

```bash
# Run tests
npm test

# Tests use Testcontainers for integration testing
# Automatically spins up PostgreSQL in Docker
```

---

## Key Design Patterns

### 1. **Round-Robin Load Balancing**
- Coordinator maintains array of worker IDs
- Increments index on each task assignment
- Wraps around using modulo operator

### 2. **Heartbeat-Based Health Monitoring**
- Workers send heartbeats every 5 seconds
- Coordinator tracks missed heartbeats
- Removes workers after 3 consecutive misses (15s tolerance)

### 3. **Database Polling with Row Locking**
- `FOR UPDATE SKIP LOCKED` prevents double-picking
- Transaction safety ensures atomicity
- 30-second lookahead window for batching

### 4. **Server-Sent Events for Real-Time Updates**
- One-way communication from server to client
- Automatic reconnection
- Backlog replay on connection
- Keep-alive pings

### 5. **Worker Pool Pattern**
- Each worker runs 5 concurrent async loops
- In-memory FIFO task queue
- Non-blocking task processing

---

## Extensibility Points

### 1. **Add Task Priorities**
- Add `priority` column to `tasks` table
- Update coordinator query to `ORDER BY priority DESC, scheduled_at`
- Update UI to show/filter by priority

### 2. **Implement Retries**
- Add `retry_count` and `max_retries` columns
- On failure, coordinator requeues if `retry_count < max_retries`
- Update UI to show retry information

### 3. **Add Authentication**
- Implement JWT or session-based auth in scheduler
- Add mTLS for gRPC communication
- Secure Docker socket access

### 4. **Metrics and Monitoring**
- Add Prometheus scrape endpoints
- Export task latency, throughput, error rates
- Integrate with Grafana for dashboards

### 5. **Real Task Executors**
- Replace 5-second sleep in `worker.processTask()`
- Call external APIs, run scripts, process data
- Add task-specific configuration

---

## Troubleshooting

### Workers Not Showing Up
- Check coordinator logs for heartbeat messages
- Ensure `coordinator:8080` is reachable from workers
- Verify worker gRPC server started successfully

### Tasks Not Being Picked Up
- Check coordinator DB polling logs
- Verify `scheduled_at` is in the past
- Ensure at least one worker is registered

### SSE Logs Not Updating
- Verify `/api/logs/stream` endpoint is reachable
- Check scheduler log polling is running
- Inspect browser console for SSE errors

### Scaling Fails
- Ensure Docker socket is mounted: `/var/run/docker.sock`
- Verify `DOCKER_COMPOSE_FILE` environment variable
- Check scheduler has permissions to run Docker commands

---

## Summary

TaskMaster is a **well-architected distributed task scheduling system** that demonstrates:

✅ **Microservices Architecture** - Separate concerns (scheduler, coordinator, workers)  
✅ **gRPC Communication** - Efficient inter-service communication  
✅ **Fault Tolerance** - Heartbeat monitoring and automatic worker removal  
✅ **Horizontal Scaling** - Dynamic worker scaling via Docker Compose  
✅ **Real-Time Monitoring** - SSE-powered live updates  
✅ **Persistent State** - PostgreSQL with transaction safety  
✅ **Modern Frontend** - React + TypeScript + Tailwind CSS  
✅ **Production Patterns** - Graceful shutdown, connection pooling, retry logic  

The codebase is **clean, well-documented, and production-ready**, making it an excellent foundation for learning distributed systems or building production schedulers for CI/CD, data pipelines, or background job processing.
