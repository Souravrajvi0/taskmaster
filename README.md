# TaskMaster - Distributed Task Scheduler

![TaskMaster Hero](assets/lightmode.png#gh-light-mode-only)
![TaskMaster Hero](assets/darkmode.png#gh-dark-mode-only)

A production-ready distributed task scheduling system with real-time monitoring, built with Node.js, gRPC, PostgreSQL, and React. Features auto-scaling workers, resilient task execution, and an interactive UI for demonstrating distributed system concepts.

For a full function-level deep dive of the stack (backend services, gRPC contracts, HTTP APIs, database schema, operations), see [DETAILED_DOCUMENTATION.md](DETAILED_DOCUMENTATION.md).

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Technology Stack](#technology-stack)
4. [Key Features](#key-features)
5. [Quick Start](#quick-start)
6. [Project Structure](#project-structure)
7. [Backend Documentation](#backend-documentation)
8. [Frontend Documentation](#frontend-documentation)
9. [API Reference](#api-reference)
10. [Task Lifecycle](#task-lifecycle)
11. [Demo Guide](#demo-guide)
12. [Development](#development)
13. [Testing](#testing)
14. [Deployment](#deployment)
15. [Performance & Scaling](#performance--scaling)
16. [Troubleshooting](#troubleshooting)

---

## Overview

TaskMaster is a **distributed task scheduling system** that demonstrates core distributed systems concepts through an interactive web interface. It features horizontal scaling, fault tolerance, real-time monitoring, and persistent state management.

### What Makes This Special?

🎯 **Interview-Ready Demo Tool** - Visually demonstrate distributed systems concepts  
🚀 **Horizontal Scaling** - Add/remove workers dynamically via UI buttons  
⚡ **Real-Time Monitoring** - Live task updates via Server-Sent Events (SSE)  
💪 **Fault Tolerant** - Tasks continue processing if workers fail  
🎨 **Interactive UI** - Built with React + TypeScript + Tailwind CSS  
🔄 **Round-Robin Distribution** - Fair task allocation across workers  
📊 **Worker Metrics** - Per-worker task counts and activity tracking  
🐳 **Docker Everything** - Full stack runs in containers  

### Use Cases

- **Technical Interviews**: Demonstrate distributed systems knowledge with live demo
- **Education**: Learn worker pools, task queues, and load balancing
- **Foundation**: Starting point for production schedulers (CI/CD, data pipelines)
---

## System Architecture

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

### Component Roles

| Component | Port | Technology | Purpose |
|-----------|------|------------|---------|
| **Frontend** | 5173 | React + Vite | Interactive UI, real-time monitoring |
| **Scheduler** | 8081 | Express | HTTP API, SSE logs, task polling |
| **Coordinator** | 8080 | gRPC | Worker registry, task dispatch, load balancing |
| **Workers** | Dynamic | gRPC | Task execution, heartbeat, status reporting |
| **PostgreSQL** | 5432 | SQL | Persistent task storage |

### Data Flow

**Task Creation:**
1. User clicks "Create Tasks" → POST `/api/schedule/batch`
2. Scheduler inserts tasks into PostgreSQL
3. Scheduler broadcasts "scheduled" event via SSE
4. Coordinator polls DB, finds pending tasks
5. Coordinator assigns to workers (round-robin)

**Task Execution:**
1. Worker receives task via gRPC
2. Worker updates status to "STARTED" in DB
3. Worker executes task (5-second simulation)
4. Worker updates status to "COMPLETED"
5. Scheduler detects completion, broadcasts via SSE
6. React UI updates task table and worker stats

**Worker Scaling:**
1. User clicks "5 Workers" button → POST `/api/workers/scale`
2. Scheduler runs `docker-compose up --scale worker=5`
3. New workers start, send heartbeats to coordinator
4. Coordinator adds workers to pool
5. React UI shows updated worker count

---

## Technology Stack

### Backend
- **Node.js 20** - Runtime
- **Express** - HTTP API server
- **gRPC** (@grpc/grpc-js) - Inter-service communication
- **PostgreSQL 16** - Task persistence
- **Protocol Buffers** - Service definitions
- **Docker Compose** - Orchestration

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

## Key Features

### Core Functionality
- ✅ **Bulk Task Creation** - Create 1-1000 tasks instantly via UI or API
- ✅ **Worker Scaling** - Scale workers from 1-50 via UI buttons or API
- ✅ **Round-Robin Distribution** - Fair task allocation across workers
- ✅ **Automatic Retry** - Tasks are reassigned if workers fail
- ✅ **Persistent State** - All task data survives restarts

### Monitoring & Observability
- ✅ **Live Task Monitor** - Shows task ID, status, worker, duration, progress
- ✅ **Activity Log** - Real-time task lifecycle events (SSE)
- ✅ **Worker Dashboard** - Per-worker metrics (tasks completed, last active)
- ✅ **System Stats** - Total/pending/running/completed/failed counts

### Demo Features
- ✅ **Worker Control Panel** - Scale to 1/3/5 workers, kill specific workers
- ✅ **Kill Worker Demo** - Stop a worker to show resilience
- ✅ **Throughput Visualization** - See queue depth change as workers scale

---

## Quick Start

### Prerequisites

- **Docker** and **Docker Compose** installed
- **Node.js 20+** (for frontend development)
- **Git**

### Full Stack Setup

```bash
# 1. Clone repository
git clone <repo-url>
cd TaskMaster-master

# 2. Start backend (Postgres, Coordinator, Scheduler, 3 Workers)
docker-compose -f docker-compose-node.yml up --build --scale worker=3 -d

# 3. Verify services
docker-compose -f docker-compose-node.yml ps

# 4. Start frontend (new terminal)
cd client
npm install
npm run dev

# 5. Open browser
# Frontend: http://localhost:5173
# API: http://localhost:8081/api/stats
```

### Verify Setup

```bash
# Check backend health
curl http://localhost:8081/api/stats

# Expected: {"total_tasks": 0, "workers": [...]}
- ✅ Coordinator: localhost:8080 (gRPC)
- ✅ Workers: 3 instances
- ✅ PostgreSQL: localhost:5432

**Scale workers dynamically:**

```bash
docker-compose -f docker-compose-node.yml up --scale worker=10
```

**Stop and cleanup:**

```bash
docker-compose -f docker-compose-node.yml down -v
```

### Option 2: Local Development (No Docker)

**1. Install Dependencies**

```bash
npm install
```

**2. Setup PostgreSQL**

```bash
# Create database
psql -U postgres -c "CREATE DATABASE scheduler;"

# Load schema
psql -U postgres -d scheduler -f pkg/db/setup.sql
```

**3. Set Environment Variables**

```bash
# Linux/Mac
export POSTGRES_USER=postgres
export POSTGRES_PASSWORD=postgres
export POSTGRES_DB=scheduler
export POSTGRES_HOST=localhost
export POSTGRES_PORT=5432

# Windows PowerShell
$env:POSTGRES_USER="postgres"
$env:POSTGRES_PASSWORD="postgres"
$env:POSTGRES_DB="scheduler"
$env:POSTGRES_HOST="localhost"
$env:POSTGRES_PORT="5432"
```

**4. Start Services (3 separate terminals)**

```bash
# Terminal 1
npm run coordinator

# Terminal 2
npm run scheduler

# Terminal 3
npm run worker
```

### Test the System

**Schedule a task:**

```bash
curl -X POST http://localhost:8081/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "command": "process-data",
    "scheduled_at": "2026-01-23T15:00:00Z"
  }'
```

**Response:**

```json
{
  "command": "process-data",
  "scheduled_at": 1737644400,
  "task_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Check task status:**

```bash
curl "http://localhost:8081/status?task_id=a1b2c3d4-e5f6-7890-abcd-ef1234567890"
```

**Response:**

```json
{
  "task_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "command": "process-data",
  "scheduled_at": "2026-01-23 15:00:00",
  "picked_at": "2026-01-23 15:00:02",
  "started_at": "2026-01-23 15:00:03",
  "completed_at": "2026-01-23 15:00:08",
  "failed_at": ""
}
```

---

## Components Deep Dive

### 1. Scheduler Service

**Files:**
- `pkg/scheduler/scheduler.js` - Business logic
- `cmd/scheduler/main.js` - Entry point

**Responsibilities:**
- Expose HTTP API on port 8081
- Accept and validate task submissions
- Persist tasks to PostgreSQL
- Provide task status queries
- Generate unique task IDs (UUID v4)

**HTTP Routes:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/schedule` | Create new task |
| GET | `/status?task_id=<id>` | Get task status |

**Request Validation:**
- `command`: required, non-empty string
- `scheduled_at`: required, ISO 8601 timestamp

**Database Operations:**
```sql
-- Insert task
INSERT INTO tasks (command, scheduled_at) VALUES ($1, $2) RETURNING id;

-- Get status
SELECT * FROM tasks WHERE id = $1;
```

**Key Implementation Details:**
```javascript
// Connection with retry logic
const pool = await connectToDatabase(dbConnectionString);

// Express route handlers
app.post('/schedule', handleScheduleTask);
app.get('/status', handleGetTaskStatus);

// Graceful shutdown on SIGINT/SIGTERM
process.on('SIGINT', async () => await stop());
```

---

### 2. Coordinator Service

**Files:**
- `pkg/coordinator/coordinator.js` - Business logic
- `cmd/coordinator/main.js` - Entry point

**Responsibilities:**
- Maintain worker registry (thread-safe with async patterns)
- Accept worker heartbeats (every 5s)
- Remove inactive workers (after 1 missed heartbeat)
- Scan database for due tasks (every 10s)
- Distribute tasks via round-robin
- Update task status in database

**gRPC Services:**

```protobuf
service CoordinatorService {
  rpc SubmitTask (ClientTaskRequest) returns (ClientTaskResponse);
  rpc SendHeartbeat (HeartbeatRequest) returns (HeartbeatResponse);
  rpc UpdateTaskStatus (UpdateTaskStatusRequest) returns (UpdateTaskStatusResponse);
}
```

**Worker Pool Management:**

```javascript
class WorkerInfo {
  constructor(address, grpcConnection, workerServiceClient) {
    this.heartbeatMisses = 0;
    this.address = address;
    this.grpcConnection = grpcConnection;
    this.workerServiceClient = workerServiceClient;
  }
}

// Registry
this.workerPool = new Map(); // workerId -> WorkerInfo
this.workerPoolKeys = [];    // Array of worker IDs for round-robin
this.roundRobinIndex = 0;
```

**Task Distribution Algorithm:**

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

**Database Polling:**

```sql
SELECT id, command 
FROM tasks 
WHERE scheduled_at < (NOW() + INTERVAL '30 seconds') 
  AND picked_at IS NULL 
ORDER BY scheduled_at 
FOR UPDATE SKIP LOCKED;
```

**Key Features:**
- **Lookahead Window**: 30 seconds to batch tasks
- **SKIP LOCKED**: Prevents contention in multi-coordinator scenarios
- **Transaction Safety**: BEGIN/COMMIT/ROLLBACK handling
- **Heartbeat Monitoring**: setInterval checks every 5s
- **Automatic Cleanup**: Removes workers with >1 missed heartbeat

---

### 3. Worker Service

**Files:**
- `pkg/worker/worker.js` - Business logic
- `cmd/worker/main.js` - Entry point

**Responsibilities:**
- Register with coordinator on startup
- Send heartbeats every 5 seconds
- Receive tasks via gRPC
- Manage internal task queue (array-based)
- Process tasks with worker pool (5 concurrent workers)
- Report status updates (STARTED, COMPLETE)

**gRPC Service:**

```protobuf
service WorkerService {
  rpc SubmitTask (TaskRequest) returns (TaskResponse);
}
```

**Worker Pool Architecture:**

```javascript
// In-memory task queue
this.taskQueue = [];
this.receivedTasks = new Map(); // task_id -> task

// Worker pool (5 async workers)
startWorkerPool(numWorkers) {
  for (let i = 0; i < numWorkers; i++) {
    this.workerPromises.push(this.worker());
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
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}
```

**Task Processing:**

```javascript
async processTask(task) {
  console.log('Processing task:', task);
  await new Promise(resolve => setTimeout(resolve, 5000)); // Simulate work
  console.log('Completed task:', task);
}
```

**Startup Sequence:**
1. Start gRPC server (binds to random port)
2. Connect to coordinator
3. Start heartbeat interval
4. Start worker pool (5 goroutine-like async functions)

**Heartbeat Logic:**

```javascript
async sendHeartbeat() {
  let workerAddress = process.env.WORKER_ADDRESS || 'localhost';
  workerAddress = `${workerAddress}:${this.actualPort}`;
  
  this.coordinatorServiceClient.SendHeartbeat({
    workerId: this.id,
    address: workerAddress
  }, (err, response) => {
    if (err) console.error('Heartbeat failed:', err.message);
  });
}
```

---

### 4. Common Utilities

**File:** `pkg/common/common.js`

**Database Connection String Builder:**

```javascript
export function getDBConnectionString() {
  const dbUser = process.env.POSTGRES_USER;
  const dbPassword = process.env.POSTGRES_PASSWORD;
  const dbName = process.env.POSTGRES_DB;
  const dbHost = process.env.POSTGRES_HOST || 'localhost';
  const dbPort = process.env.POSTGRES_PORT || '5432';
  
  return `postgres://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbName}`;
}
```

**Connection with Retry:**

```javascript
export async function connectToDatabase(dbConnectionString) {
  const pool = new Pool({
    connectionString: dbConnectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  let retryCount = 0;
  const maxRetries = 5;

  while (retryCount < maxRetries) {
    try {
      const client = await pool.connect();
      console.log('Connected to the database.');
      client.release();
      return pool;
    } catch (err) {
      console.log('Failed to connect. Retrying in 5 seconds...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      retryCount++;
    }
  }

  throw new Error('Ran out of retries to connect to database (5)');
}
```

**Constants:**

```javascript
export const DEFAULT_HEARTBEAT = 5000; // 5 seconds in milliseconds
```

---

## Database Schema

**File:** `pkg/db/setup.sql`

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    command TEXT NOT NULL,
    scheduled_at TIMESTAMP NOT NULL,
    picked_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    failed_at TIMESTAMP
);

CREATE INDEX idx_tasks_scheduled_at ON tasks (scheduled_at);
```

### Field Descriptions

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | No | Unique task identifier (auto-generated) |
| `command` | TEXT | No | Task command/payload |
| `scheduled_at` | TIMESTAMP | No | When task should execute |
| `picked_at` | TIMESTAMP | Yes | When coordinator assigned task to worker |
| `started_at` | TIMESTAMP | Yes | When worker began execution |
| `completed_at` | TIMESTAMP | Yes | When task completed successfully |
| `failed_at` | TIMESTAMP | Yes | When task failed (error scenario) |

### Task States

1. **Scheduled**: `scheduled_at` set, `picked_at` NULL
2. **Assigned**: `picked_at` set, `started_at` NULL
3. **Running**: `started_at` set, `completed_at` NULL, `failed_at` NULL
4. **Completed**: `completed_at` set
5. **Failed**: `failed_at` set

### Index Strategy

```sql
CREATE INDEX idx_tasks_scheduled_at ON tasks (scheduled_at);
```

- **Purpose**: Optimize coordinator polling queries
- **Benefit**: Fast lookup of tasks ready for execution
- **Query Pattern**: `WHERE scheduled_at < (NOW() + INTERVAL '30 seconds')`

---

## API Reference

### HTTP API (Scheduler)

#### POST /schedule

Create a new scheduled task.

**Request:**

```json
{
  "command": "string (required)",
  "scheduled_at": "ISO 8601 timestamp (required)"
}
```

**Example:**

```bash
curl -X POST http://localhost:8081/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "command": "process-report",
    "scheduled_at": "2026-01-23T15:30:00+00:00"
  }'
```

**Response (200 OK):**

```json
{
  "command": "process-report",
  "scheduled_at": 1737645000,
  "task_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479"
}
```

**Error Responses:**

```json
// 400 Bad Request - Missing fields
{
  "error": "command and scheduled_at are required"
}

// 400 Bad Request - Invalid date
{
  "error": "Invalid date format. Use ISO 8601 format."
}

// 500 Internal Server Error
{
  "error": "Failed to submit task. Error: <details>"
}
```

---

#### GET /status

Query task status by ID.

**Query Parameters:**
- `task_id` (required): UUID of the task

**Example:**

```bash
curl "http://localhost:8081/status?task_id=f47ac10b-58cc-4372-a567-0e02b2c3d479"
```

**Response (200 OK):**

```json
{
  "task_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "command": "process-report",
  "scheduled_at": "2026-01-23 15:30:00",
  "picked_at": "2026-01-23 15:30:02",
  "started_at": "2026-01-23 15:30:03",
  "completed_at": "2026-01-23 15:30:08",
  "failed_at": ""
}
```

**Error Responses:**

```json
// 400 Bad Request
{
  "error": "Task ID is required"
}

// 404 Not Found
{
  "error": "Task not found"
}

// 500 Internal Server Error
{
  "error": "Failed to get task status. Error: <details>"
}
```

---

### gRPC API (Internal)

#### CoordinatorService

**SubmitTask (Client → Coordinator):**

```protobuf
message ClientTaskRequest {
  string data = 1;
}

message ClientTaskResponse {
  string message = 2;
  string task_id = 3;
}
```

**SendHeartbeat (Worker → Coordinator):**

```protobuf
message HeartbeatRequest {
  uint32 workerId = 1;
  string address = 2;
}

message HeartbeatResponse {
  bool acknowledged = 1;
}
```

**UpdateTaskStatus (Worker → Coordinator):**

```protobuf
enum TaskStatus {
  QUEUED = 0;
  STARTED = 1;
  COMPLETE = 2;
  FAILED = 3;
}

message UpdateTaskStatusRequest {
  string task_id = 1;
  TaskStatus status = 2;
  int64 started_at = 3;
  int64 completed_at = 4;
  int64 failed_at = 5;
}

message UpdateTaskStatusResponse {
  bool success = 1;
}
```

#### WorkerService

**SubmitTask (Coordinator → Worker):**

```protobuf
message TaskRequest {
  string task_id = 1;
  string data = 2;
}

message TaskResponse {
  string task_id = 1;
  string message = 2;
  bool success = 3;
}
```

---

## Task Lifecycle

### Complete Flow Diagram

```
1. Client Submission
   │
   ▼
[POST /schedule] ──> Scheduler validates request
   │
   ▼
2. Database Insert
   │
   INSERT INTO tasks (command, scheduled_at)
   │
   ▼
3. Polling (every 10s)
   │
   Coordinator: SELECT tasks WHERE scheduled_at < NOW() + 30s
   │
   ▼
4. Task Assignment
   │
   Coordinator: UPDATE tasks SET picked_at = NOW() WHERE id = ?
   │
   ▼
5. Worker Dispatch
   │
   Coordinator ──gRPC──> Worker.SubmitTask()
   │
   ▼
6. Task Queued
   │
   Worker: taskQueue.push(task)
   │
   ▼
7. Worker Pool Pickup
   │
   Worker: task = taskQueue.shift()
   │
   ▼
8. Update STARTED
   │
   Worker ──gRPC──> Coordinator.UpdateTaskStatus(STARTED)
   │
   Coordinator: UPDATE tasks SET started_at = NOW()
   │
   ▼
9. Task Execution
   │
   Worker: await processTask(task) // 5s simulation
   │
   ▼
10. Update COMPLETE
    │
    Worker ──gRPC──> Coordinator.UpdateTaskStatus(COMPLETE)
    │
    Coordinator: UPDATE tasks SET completed_at = NOW()
    │
    ▼
11. Client Query
    │
[GET /status?task_id=X] ──> Scheduler
    │
    SELECT * FROM tasks WHERE id = X
    │
    ▼
    Return JSON with all timestamps
```

### Timing Details

| Event | Typical Latency |
|-------|----------------|
| Client → Scheduler | < 10ms |
| Scheduler → Database | < 50ms |
| Coordinator Poll Interval | 10s |
| Database Query (SKIP LOCKED) | < 100ms |
| gRPC Task Dispatch | < 10ms |
| Worker Queue Pickup | < 100ms (polling) |
| Task Execution (simulated) | 5000ms |
| Status Update gRPC | < 10ms |

---

## Demo Guide

### Interview Demonstration (5-10 minutes)

**Setup (2 min):**
```bash
# Start backend
docker-compose -f docker-compose-node.yml up --build --scale worker=3 -d

# Start frontend
cd client && npm run dev

# Open http://localhost:5173
```

**Demo Flow:**

#### 1. Show Architecture (1 min)
- Point to Workers panel: "3 workers online, 0 tasks"
- Point to Stats: "System starts at zero state"
- Explain: "This demonstrates distributed task processing with horizontal scaling"

#### 2. Create Initial Load (30 sec)
- Set bulk count to 50
- Click "Create Tasks"
- Point to Live Task Monitor: "Tasks distributed round-robin"
- Point to Workers: "Each worker picking up tasks, counts incrementing"

#### 3. Observe Concurrency (1 min)
- Watch progress bars advance
- Show Activity Log: "Real-time events via Server-Sent Events"
- Point to duration: "Each task takes ~5 seconds"
- Calculate throughput: "3 workers × ~0.2 tasks/sec = ~0.6 tasks/sec"

#### 4. Scale Down (1 min)
- Click "1 worker" button
- Wait 5 seconds, observe dashboard
- Point to queue: "Pending count rises, throughput drops"
- Show single worker: "tasks_completed incrementing rapidly"

#### 5. Scale Up (1 min)
- Click "5 workers" button
- Wait 5 seconds, observe dashboard
- Point to stats: "Running count jumps to 5"
- Show queue draining: "Pending → 0 in ~10 seconds"

#### 6. Resilience Demo (1 min)
- Type worker container name (e.g., "taskmaster-master-worker-2")
- Click "Kill Worker" button
- Show worker disappear from panel
- Point to remaining workers: "Tasks continue, no data loss"
- Show activity log: "Worker offline event"

**Talking Points:**
- "Round-robin ensures fair distribution"
- "Postgres is source of truth; services can restart"
- "SSE keeps UI in sync without polling overhead"
- "Production would add: auto-scaling policies, dead-letter queues, metrics export"

### Extended Demo (Additional Features)

#### Bulk Creation Stress Test
```bash
# Create 1000 tasks
# Set count to 1000 in UI
# Click "Create Tasks"
# Observe: System handles burst, queue processes steadily
```

#### Worker Failure Recovery
```bash
# Kill a busy worker mid-task
docker stop taskmaster-master-worker-2

# Observe: Task gets reassigned to another worker
# No task loss, eventual completion
```

#### Database Restart
```bash
# Stop database
docker-compose -f docker-compose-node.yml stop postgres

# Observe: Services retry connection
# Start database
docker-compose -f docker-compose-node.yml start postgres

# Observe: Services reconnect, processing resumes
```

---

## Development

### Prerequisites
- Node.js 20+
- Docker Desktop
- Git
- PostgreSQL (for local development)

### Backend Development

**1. Install Dependencies:**
```bash
npm install
```

**2. Start PostgreSQL:**
```bash
docker run -d --name postgres \
  -e POSTGRES_DB=scheduler \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:16
```

**3. Run Services Locally:**

```bash
# Terminal 1: Coordinator
export POSTGRES_HOST=localhost
export COORDINATOR_PORT=:8080
node cmd/coordinator/main.js

# Terminal 2: Scheduler
export POSTGRES_HOST=localhost
export COORDINATOR_ADDRESS=localhost:8080
export SCHEDULER_PORT=:8081
node cmd/scheduler/main.js

# Terminal 3: Worker
export COORDINATOR=localhost:8080
node cmd/worker/main.js
```

**4. Hot Reload (Optional):**
```bash
npm install -g nodemon

# Run with auto-restart
nodemon cmd/coordinator/main.js
```

### Frontend Development

```bash
cd client/client

# Install dependencies
npm install

# Start dev server with HMR
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type checking
npm run type-check

# Linting
npm run lint
```

### Protocol Buffers

**Rebuild after changing api.proto:**
```bash
cd pkg/grpcapi
chmod +x build.sh
./build.sh

# Restart services to load new proto
docker-compose -f docker-compose-node.yml restart coordinator scheduler worker
```

### Database Migrations

**Current approach:** Simple SQL file executed on startup.

**For production, consider:**
- **Flyway** - Versioned migrations
- **Liquibase** - XML/YAML migrations
- **Prisma** - ORM with migrations
- **node-pg-migrate** - Node.js migrations

**Manual Migration:**
```bash
# Connect to database
docker-compose -f docker-compose-node.yml exec postgres psql -U postgres -d scheduler

# Add column
ALTER TABLE tasks ADD COLUMN priority INTEGER DEFAULT 0;

# Add index
CREATE INDEX idx_tasks_priority ON tasks(priority);
```

**Reset Database:**
```bash
# Drop all data and recreate
docker-compose -f docker-compose-node.yml down -v
docker-compose -f docker-compose-node.yml up -d
```

---

## Testing

### Unit Tests (Jest)

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch

# Specific test file
npm test -- integration_test.js
```

### Integration Tests

**Testcontainers-based:**
```bash
# Requires Docker running
npm test

# Tests automatically:
# 1. Start Postgres container
# 2. Run migrations
# 3. Start coordinator/scheduler/worker
# 4. Execute test scenarios
# 5. Cleanup containers
```

### Manual API Testing

**Test Task Creation:**
```bash
curl -X POST http://localhost:8081/api/schedule/batch \
  -H "Content-Type: application/json" \
  -d '{"command":"test","count":10,"delay_seconds":0}'

# Expected: {"count":10,"scheduled_at":...,"task_ids":[...]}
```

**Test Task Status:**
```bash
curl http://localhost:8081/api/tasks | jq '.[] | select(.completed_at != "") | {task_id, command, duration}'
```

**Test Worker Scaling:**
```bash
curl -X POST http://localhost:8081/api/workers/scale \
  -H "Content-Type: application/json" \
  -d '{"count":5}'

# Wait 5 seconds
curl http://localhost:8081/api/workers | jq 'length'
# Expected: 5
```

**Test Worker Kill:**
```bash
# List containers
docker ps --format "{{.Names}}"

# Kill worker
curl -X POST http://localhost:8081/api/workers/kill \
  -H "Content-Type: application/json" \
  -d '{"name":"taskmaster-master-worker-2"}'

# Verify removal
docker ps | grep worker-2
# Should be empty
```

### Load Testing

**Apache Bench:**
```bash
# 100 requests, 10 concurrent
ab -n 100 -c 10 -T application/json \
  -p payload.json \
  http://localhost:8081/api/schedule/batch

# payload.json:
# {"command":"load-test","count":50,"delay_seconds":0}
```

**Expected Performance:**
- 3 workers: ~1.5 tasks/sec
- 10 workers: ~5 tasks/sec
- 50 workers: ~25 tasks/sec
- Limited by: Task duration (5s), DB connections, CPU

---

## Deployment

### Docker Compose Production

**1. Set Environment Variables:**
```bash
export POSTGRES_PASSWORD=$(openssl rand -base64 32)
export NODE_ENV=production
```

**2. Enable Restart Policies:**
```yaml
# docker-compose-node.yml
services:
  postgres:
    restart: always
  coordinator:
    restart: always
  scheduler:
    restart: always
  worker:
    restart: always
```

**3. Start Production Stack:**
```bash
docker-compose -f docker-compose-node.yml up -d --scale worker=10
```

**4. Monitor Logs:**
```bash
docker-compose -f docker-compose-node.yml logs -f
```

### Kubernetes Deployment

**Example Manifests (not included):**

```yaml
# postgres-statefulset.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
spec:
  serviceName: postgres
  replicas: 1
  template:
    spec:
      containers:
      - name: postgres
        image: postgres:16
        volumeMounts:
        - name: data
          mountPath: /var/lib/postgresql/data
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 10Gi
```

```yaml
# coordinator-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: coordinator
spec:
  replicas: 1  # Single coordinator (or use distributed lock)
  template:
    spec:
      containers:
      - name: coordinator
        image: taskmaster-coordinator:latest
        env:
        - name: POSTGRES_HOST
          value: postgres
        - name: COORDINATOR_PORT
          value: ":8080"
```

```yaml
# worker-hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: worker-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: worker
  minReplicas: 3
  maxReplicas: 50
  metrics:
  - type: External
    external:
      metric:
        name: pending_tasks_count
      target:
        type: Value
        value: "10"  # Scale up if pending > 10
```

### Cloud Deployment

**AWS:**
- **RDS PostgreSQL** - Managed database
- **ECS Fargate** - Containerized services
- **ALB** - Load balancer for scheduler
- **CloudWatch** - Logs and metrics

**GCP:**
- **Cloud SQL** - Managed Postgres
- **Cloud Run** - Serverless containers
- **Load Balancer** - HTTP(S) load balancing
- **Cloud Logging** - Centralized logs

**Azure:**
- **Azure Database for PostgreSQL**
- **Container Instances** - Managed containers
- **Application Gateway** - Load balancer
- **Monitor** - Metrics and logs

### Environment-Specific Configs

**Production:**
- Increase heartbeat timeout to 30s
- Add structured logging (Winston, Pino)
- Add metrics export (Prometheus)
- Enable HTTPS/TLS for gRPC
- Use managed Postgres with backups
- Set connection pool size: 50-100

**Staging:**
- Same as production, smaller scale
- Enable debug logs
- Shorter heartbeat: 10s

**Development:**
- Fast heartbeat: 5s
- Verbose logging
- Hot reload enabled
- Small worker pool

---

## Performance & Scaling

### Throughput Optimization

**Current Baseline (3 workers):**
- ~1.5 tasks/sec with 5s task execution time
- **Formula:** Throughput = Workers × (1 / Task Duration)

**To Increase Throughput:**

#### 1. Scale Workers (Linear)
```bash
docker-compose -f docker-compose-node.yml up --scale worker=20 -d

# Expected: 20 × 0.2 = 4 tasks/sec
```

#### 2. Reduce Task Duration
```javascript
// pkg/worker/worker.js
const TASK_PROCESS_TIME = 1000; // 1s instead of 5s

// New throughput: 20 × 1 = 20 tasks/sec
```

#### 3. Optimize Polling Intervals
```javascript
// pkg/coordinator/coordinator.js
const SCAN_INTERVAL = 5000; // 5s instead of 10s

// Reduces task pickup latency by 5s
```

#### 4. Batch Task Assignment
```javascript
// Assign 5 tasks per worker instead of 1
// Reduces gRPC overhead
```

### Database Optimization

**Connection Pooling:**
```javascript
// pkg/common/common.js
const pool = new pg.Pool({
  max: 50,  // Increase from 20
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

**Indexes:**
```sql
-- Existing
CREATE INDEX idx_tasks_scheduled_at ON tasks (scheduled_at);
CREATE INDEX idx_tasks_worker_id ON tasks (worker_id);

-- Additional for performance
CREATE INDEX idx_tasks_status ON tasks (picked_at, started_at, completed_at);
CREATE INDEX idx_tasks_pending ON tasks (scheduled_at) WHERE picked_at IS NULL;
```

**Partitioning (for >1M tasks):**
```sql
-- Partition by month
CREATE TABLE tasks_2026_01 PARTITION OF tasks
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
```

### Monitoring

**Prometheus Metrics (to add):**
```javascript
// Metrics to export
- tasks_total
- tasks_pending
- tasks_running
- tasks_completed_total
- tasks_failed_total
- workers_active
- task_duration_seconds
- worker_task_latency_seconds
```

**Grafana Dashboards:**
- Task throughput over time
- Worker utilization
- Queue depth
- Task duration percentiles
- Error rates

---

## Configuration

### Environment Variables

#### Required (All Services)

```bash
POSTGRES_USER=postgres          # Database username
POSTGRES_PASSWORD=postgres      # Database password
POSTGRES_DB=scheduler           # Database name
POSTGRES_HOST=localhost         # Database host
POSTGRES_PORT=5432              # Database port
```

#### Scheduler

```bash
SCHEDULER_PORT=:8081           # HTTP port (with colon prefix)
COORDINATOR_ADDRESS=coordinator:8080  # gRPC coordinator address
DOCKER_COMPOSE_FILE=docker-compose-node.yml  # For scaling
```

#### Coordinator

```bash
COORDINATOR_PORT=:8080         # gRPC port (with colon prefix)
```

#### Worker

```bash
WORKER_PORT=                    # Empty = random port assignment
WORKER_ADDRESS=worker           # Hostname for registration
COORDINATOR=coordinator:8080    # Coordinator gRPC address
```### Tunable Parameters

**Coordinator:**
```javascript
// pkg/coordinator/coordinator.js
const HEARTBEAT_INTERVAL = 1000;    // Check workers every 1s
const DEFAULT_MAX_MISSES = 3;       // Remove after 3 missed beats (15s tolerance)
const SCAN_INTERVAL = 10000;        // Poll DB for tasks every 10s
```

**Worker:**
```javascript
// pkg/worker/worker.js
const HEARTBEAT_SEND_INTERVAL = 5000; // Send heartbeat every 5s
const TASK_PROCESS_TIME = 5000;       // Simulate 5s task execution
const POOL_SIZE = 5;                  // 5 concurrent tasks per worker
```

**Scheduler:**
```javascript
// pkg/scheduler/scheduler.js
const MAX_LOG_EVENTS = 250;         // Ring buffer size for SSE logs
const POLL_INTERVAL = 1000;         // Poll DB for transitions every 1s
```

---

## Troubleshooting

### Workers Not Appearing

**Symptom:** `/api/workers` returns empty array

**Diagnosis:**
```bash
# 1. Check coordinator logs
docker-compose -f docker-compose-node.yml logs coordinator

# Look for: "Worker registered: <address>"
```

**Solutions:**
```bash
# 1. Verify coordinator is running
docker-compose -f docker-compose-node.yml ps coordinator

# 2. Check worker logs for heartbeat errors
docker-compose -f docker-compose-node.yml logs worker | grep -i "heartbeat\|error"

# 3. Restart workers
docker-compose -f docker-compose-node.yml restart worker

# 4. Wait 5-10 seconds for heartbeat registration
sleep 10 && curl http://localhost:8081/api/workers

# 5. Verify coordinator is accessible from worker
docker-compose -f docker-compose-node.yml exec worker ping coordinator
```

---

### Tasks Stuck in Pending

**Symptom:** Tasks remain in "pending" state indefinitely

**Diagnosis:**
```bash
# 1. Check scheduler is polling
docker-compose -f docker-compose-node.yml logs scheduler | grep "polling\|pending"

# 2. Check coordinator is assigning
docker-compose -f docker-compose-node.yml logs coordinator | grep "assigned\|submit"

# 3. Check workers are executing
docker-compose -f docker-compose-node.yml logs worker | grep "Received task"

# 4. Query database directly
docker-compose -f docker-compose-node.yml exec postgres psql -U postgres -d scheduler -c \
  "SELECT COUNT(*) FROM tasks WHERE picked_at IS NULL;"
```

**Solutions:**
```bash
# 1. Ensure coordinator is running
docker-compose -f docker-compose-node.yml restart coordinator

# 2. Verify workers are registered
curl http://localhost:8081/api/workers

# 3. Check task scheduled_at is in past
curl http://localhost:8081/api/tasks | jq '.[] | select(.picked_at == null)'

# 4. Restart all services
docker-compose -f docker-compose-node.yml restart
```

---

### Worker Attribution Incorrect

**Symptom:** All workers show same task count or counts don't match reality

**Diagnosis:**
```bash
# 1. Check database has worker_id column
docker-compose -f docker-compose-node.yml exec postgres psql -U postgres -d scheduler -c \
  "SELECT column_name FROM information_schema.columns WHERE table_name = 'tasks';"

# Should include: worker_id

# 2. Check proto has worker_id field
cat pkg/grpcapi/api.proto | grep -A 10 "UpdateTaskStatusRequest"

# Should include: uint32 worker_id = 6;
```

**Solutions:**
```bash
# 1. Add worker_id column if missing
docker-compose -f docker-compose-node.yml exec postgres psql -U postgres -d scheduler -c \
  "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS worker_id INTEGER;"

# 2. Rebuild proto files
cd pkg/grpcapi && ./build.sh

# 3. Rebuild all services
docker-compose -f docker-compose-node.yml down
docker-compose -f docker-compose-node.yml up --build -d

# 4. Clear old data and test fresh
docker-compose -f docker-compose-node.yml down -v
docker-compose -f docker-compose-node.yml up --build -d
```

---

### Scaling Commands Fail

**Symptom:** "docker-compose: not found" or "permission denied" when scaling

**Diagnosis:**
```bash
# 1. Check scheduler has Docker CLI
docker-compose -f docker-compose-node.yml exec scheduler which docker

# Should return: /usr/bin/docker or /usr/local/bin/docker

# 2. Check Docker socket is mounted
docker-compose -f docker-compose-node.yml exec scheduler ls -la /var/run/docker.sock

# Should exist and be a socket

# 3. Check scheduler logs
docker-compose -f docker-compose-node.yml logs scheduler | grep -i "scale\|docker"
```

**Solutions:**
```bash
# 1. Ensure Docker socket is mounted in docker-compose-node.yml
# scheduler:
#   volumes:
#     - /var/run/docker.sock:/var/run/docker.sock
#     - .:/workspace
#   working_dir: /workspace

# 2. Ensure Docker CLI is installed in scheduler-node.dockerfile
# RUN apk add --no-cache docker-cli docker-cli-compose

# 3. Rebuild scheduler
docker-compose -f docker-compose-node.yml up --build -d scheduler

# 4. Test Docker access
docker-compose -f docker-compose-node.yml exec scheduler docker ps
```

---

### Workers Dropping Under Load

**Symptom:** Workers disappear from pool when handling many tasks

**Diagnosis:**
```bash
# 1. Check heartbeat tolerance
cat pkg/coordinator/coordinator.js | grep "DEFAULT_MAX_MISSES"

# Should be: 3 (allows 15s grace)

# 2. Check worker logs for heartbeat failures
docker-compose -f docker-compose-node.yml logs worker | grep -i "heartbeat"

# 3. Monitor worker count during load
watch -n 1 'curl -s http://localhost:8081/api/stats | jq .workers | jq length'
```

**Solutions:**
```bash
# 1. Increase heartbeat tolerance
# pkg/coordinator/coordinator.js
# const DEFAULT_MAX_MISSES = 3; // Change to 5 for 25s tolerance

# 2. Reduce task execution time
# pkg/worker/worker.js
# const TASK_PROCESS_TIME = 2000; // 2s instead of 5s

# 3. Increase worker pool size
# pkg/worker/worker.js
# const POOL_SIZE = 10; // 10 concurrent tasks

# 4. Rebuild and test
docker-compose -f docker-compose-node.yml up --build -d
```

---

### Frontend Not Loading

**Symptom:** Blank page, "Cannot GET /", or CORS errors

**Diagnosis:**
```bash
# 1. Check frontend dev server is running
ps aux | grep vite

# 2. Check backend API is accessible
curl http://localhost:8081/api/stats

# 3. Check browser console for errors
# Open DevTools → Console

# 4. Check Vite proxy configuration
cat client/client/vite.config.ts | grep -A 5 "proxy"
```

**Solutions:**
```bash
# 1. Start frontend dev server
cd client/client && npm run dev

# 2. Verify proxy is configured
# vite.config.ts should have:
# proxy: { '/api': { target: 'http://localhost:8081', changeOrigin: true } }

# 3. Clear npm cache and reinstall
cd client/client
rm -rf node_modules package-lock.json
npm install
npm run dev

# 4. Check port 5173 is not in use
lsof -i :5173  # Mac/Linux
netstat -ano | findstr :5173  # Windows
```

---

### Database Connection Errors

**Symptom:** "ECONNREFUSED", "connection timeout", or "database does not exist"

**Diagnosis:**
```bash
# 1. Check Postgres is running
docker-compose -f docker-compose-node.yml ps postgres

# 2. Check Postgres logs
docker-compose -f docker-compose-node.yml logs postgres | tail -20

# 3. Test connection manually
docker-compose -f docker-compose-node.yml exec postgres psql -U postgres -d scheduler -c "SELECT 1;"

# 4. Check environment variables
docker-compose -f docker-compose-node.yml exec scheduler env | grep POSTGRES
```

**Solutions:**
```bash
# 1. Restart Postgres
docker-compose -f docker-compose-node.yml restart postgres

# 2. Verify database exists
docker-compose -f docker-compose-node.yml exec postgres psql -U postgres -c "\l"

# 3. Recreate database
docker-compose -f docker-compose-node.yml exec postgres psql -U postgres -c \
  "DROP DATABASE IF EXISTS scheduler; CREATE DATABASE scheduler;"

# 4. Run schema migration
docker-compose -f docker-compose-node.yml exec postgres psql -U postgres -d scheduler < pkg/db/setup.sql

# 5. Full reset
docker-compose -f docker-compose-node.yml down -v
docker-compose -f docker-compose-node.yml up -d
```

---

### gRPC Errors

**Symptom:** "14 UNAVAILABLE", "connection refused", or "deadline exceeded"

**Diagnosis:**
```bash
# 1. Check coordinator is running
docker-compose -f docker-compose-node.yml ps coordinator

# 2. Check gRPC port is open
docker-compose -f docker-compose-node.yml exec scheduler nc -zv coordinator 8080

# 3. Enable gRPC debug logs
export GRPC_VERBOSITY=DEBUG
export GRPC_TRACE=all
docker-compose -f docker-compose-node.yml logs coordinator
```

**Solutions:**
```bash
# 1. Restart coordinator
docker-compose -f docker-compose-node.yml restart coordinator

# 2. Verify address in environment
docker-compose -f docker-compose-node.yml exec worker env | grep COORDINATOR

# 3. Check Docker network
docker network ls
docker network inspect taskmaster-master_default

# 4. Rebuild proto files
cd pkg/grpcapi && ./build.sh
docker-compose -f docker-compose-node.yml up --build -d
```

---

### High Memory Usage

**Symptom:** Containers using excessive memory (>1GB)

**Diagnosis:**
```bash
# Check memory usage
docker stats --no-stream

# Check Node.js heap
docker-compose -f docker-compose-node.yml exec scheduler node -e \
  "console.log(process.memoryUsage())"
```

**Solutions:**
```bash
# 1. Limit container memory in docker-compose-node.yml
# worker:
#   mem_limit: 512m
#   memswap_limit: 512m

# 2. Increase Node.js heap limit
# dockerfile:
# CMD ["node", "--max-old-space-size=512", "cmd/worker/main.js"]

# 3. Clear logs ring buffer more frequently
# pkg/scheduler/scheduler.js
# const MAX_LOG_EVENTS = 100; // Reduce from 250

# 4. Monitor and restart if needed
docker-compose -f docker-compose-node.yml restart
```

---

### Test Timeouts

**Symptom:** "Exceeded timeout of 30000 ms for a test"

**Solutions:**
```javascript
// Increase test timeout
test('E2E Success', async () => {
  // ...
}, 60000); // 60 seconds

// Or globally in jest.config.js
export default {
  testTimeout: 60000,
};
```

---

### Debug Mode

**Enable Verbose Logging:**
```bash
# Set in environment
export DEBUG=*
export NODE_ENV=development

# Or in code (pkg/common/common.js)
console.log('[DEBUG]', JSON.stringify(object, null, 2));
```

**gRPC Debugging:**
```bash
export GRPC_VERBOSITY=DEBUG
export GRPC_TRACE=all
docker-compose -f docker-compose-node.yml up coordinator
```

---

### Logs Analysis

**Docker Compose Logs:**
```bash
# All services
docker-compose -f docker-compose-node.yml logs -f

# Specific service
docker-compose -f docker-compose-node.yml logs -f coordinator

# Last 100 lines
docker-compose -f docker-compose-node.yml logs --tail=100

# Since timestamp
docker-compose -f docker-compose-node.yml logs --since 2026-01-23T15:00:00

# Search for errors
docker-compose -f docker-compose-node.yml logs | grep -i error

# Find specific task
docker-compose -f docker-compose-node.yml logs | grep "task_id: abc123"
```

---

## License

MIT License

Copyright (c) 2026 TaskMaster Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

---

## Credits & Acknowledgments

**Built as a demonstration of distributed systems concepts for technical interviews and education.**

**Key Concepts Demonstrated:**
- Worker Pool Pattern
- Task Queue (Producer-Consumer)
- Round-Robin Load Balancing
- Heartbeat Mechanism
- Eventual Consistency
- Horizontal Scaling
- Fault Tolerance
- Real-time Monitoring (Server-Sent Events)
- gRPC Communication
- Database Transaction Management

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

**Areas for Improvement:**
- Add authentication/authorization (JWT, OAuth)
- Implement task retries and dead letter queue
- Add Prometheus/Grafana metrics
- Implement priority queue
- Add cron-style scheduling
- Implement task dependencies (DAG)
- Add distributed tracing (OpenTelemetry)
- Implement horizontal autoscaling (HPA)
- Add rate limiting
- Implement task cancellation

**Development Guidelines:**
1. Fork repository
2. Create feature branch (`git checkout -b feat/amazing-feature`)
3. Write tests for new features
4. Run tests (`npm test`)
5. Commit changes (follow Conventional Commits)
6. Push to branch
7. Open Pull Request

---

## Support

- **Issues**: Open a GitHub issue
- **Documentation**: See [DEMO.md](DEMO.md) and [QUICK_REFERENCE.md](QUICK_REFERENCE.md)
- **Backend API**: See [client/BACKEND_DOCS.md](client/BACKEND_DOCS.md)

---

**Questions? Issues?** Open an issue on GitHub or check the troubleshooting section above.

---

**Project Status:** ✅ Production-Ready for Demos | 🚧 Educational/Interview Tool

**Last Updated:** January 23, 2026

**Happy Scheduling! 🚀**
      POSTGRES_DB: ${POSTGRES_DB:-scheduler}
      POSTGRES_USER: ${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres}
    volumes:
      - ./data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  scheduler:
    build:
      context: .
      dockerfile: scheduler-node.dockerfile
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-scheduler}
      POSTGRES_USER: ${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres}
      POSTGRES_HOST: postgres
      POSTGRES_PORT: "5432"
      SCHEDULER_PORT: ":8081"
    ports:
      - "8081:8081"
    depends_on:
      - postgres

  coordinator:
    build:
      context: .
      dockerfile: coordinator-node.dockerfile
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-scheduler}
      POSTGRES_USER: ${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres}
      POSTGRES_HOST: postgres
      POSTGRES_PORT: "5432"
      COORDINATOR_PORT: ":8080"
    ports:
      - "8080:8080"
    depends_on:
      - postgres

  worker:
    build:
      context: .
      dockerfile: worker-node.dockerfile
    environment:
      WORKER_ADDRESS: worker
      COORDINATOR: coordinator:8080
    depends_on:
      - coordinator
```

### Tunable Parameters

| Parameter | Location | Default | Description |
|-----------|----------|---------|-------------|
| `SCAN_INTERVAL` | coordinator.js | 10000ms | Database poll frequency |
| `DEFAULT_HEARTBEAT` | common.js | 5000ms | Heartbeat interval |
| `maxHeartbeatMisses` | coordinator.js | 1 | Missed beats before removal |
| `WORKER_POOL_SIZE` | worker.js | 5 | Concurrent task workers per node |
| `TASK_PROCESS_TIME` | worker.js | 5000ms | Simulated execution time |
| `maxRetries` | common.js | 5 | DB connection retry attempts |

---

## Testing

### Unit Tests

Currently focused on integration testing. Unit tests can be added:

```javascript
// Example: pkg/common/common.test.js
import { describe, test, expect } from '@jest/globals';
import { getDBConnectionString } from './common.js';

describe('Common Utilities', () => {
  test('builds connection string correctly', () => {
    process.env.POSTGRES_USER = 'testuser';
    process.env.POSTGRES_PASSWORD = 'testpass';
    process.env.POSTGRES_DB = 'testdb';
    process.env.POSTGRES_HOST = 'testhost';
    process.env.POSTGRES_PORT = '5433';
    
    const result = getDBConnectionString();
    expect(result).toBe('postgres://testuser:testpass@testhost:5433/testdb');
  });
});
```

### Integration Tests

**File:** `tests/integration.test.js`

**Framework:** Jest + Testcontainers

**Test Scenarios:**

1. **E2E Success**
   - Schedule task via HTTP
   - Wait for worker processing
   - Verify task completion in database

2. **Workers Not Available**
   - Stop all workers
   - Attempt task submission
   - Expect "no workers available" error

3. **Task Load Balancing**
   - Submit 8 tasks to 4 workers
   - Verify each worker received exactly 2 tasks (round-robin)

**Run Tests:**

```bash
# Build postgres test image (pretest hook)
npm test

# Or manually:
docker build -f postgres-dockerfile -t scheduler-postgres .
npm test
```

**Test Configuration:**

```javascript
// jest.config.js
export default {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  transform: {},
  testTimeout: 60000,
  verbose: true,
};
```

**Running with Coverage:**

```bash
npm test -- --coverage
```

---

## Project Structure

```
TaskMaster-master/
├── assets/                      # Images for README
│   ├── darkmode.png
│   └── lightmode.png
│
├── cmd/                         # Service entry points
│   ├── coordinator/
│   │   └── main.js             # Coordinator entry
│   ├── scheduler/
│   │   └── main.js             # Scheduler entry
│   └── worker/
│       └── main.js             # Worker entry
│
├── pkg/                         # Core business logic
│   ├── common/
│   │   └── common.js           # Shared utilities (DB, constants)
│   ├── coordinator/
│   │   └── coordinator.js      # Coordinator service logic
│   ├── scheduler/
│   │   └── scheduler.js        # Scheduler service logic
│   ├── worker/
│   │   └── worker.js           # Worker service logic
│   ├── db/
│   │   └── setup.sql           # Database schema
│   └── grpcapi/
│       ├── api.proto           # Protocol Buffer definitions
│       └── build.sh            # Notes on proto compilation
│
├── tests/
│   └── integration.test.js     # Integration test suite
│
├── .gitignore                   # Git ignore rules
├── docker-compose-node.yml      # Docker Compose for Node version
├── coordinator-node.dockerfile  # Coordinator container image
├── scheduler-node.dockerfile    # Scheduler container image
├── worker-node.dockerfile       # Worker container image
├── postgres-dockerfile          # PostgreSQL with schema
├── jest.config.js               # Jest configuration
├── package.json                 # Node dependencies & scripts
├── package-lock.json            # Locked dependency versions
└── README.md                    # This file
```

### Key Files

| File | Purpose |
|------|---------|
| `package.json` | npm scripts, dependencies |
| `jest.config.js` | Test configuration |
| `docker-compose-node.yml` | Multi-container orchestration |
| `pkg/grpcapi/api.proto` | gRPC service definitions |
| `pkg/db/setup.sql` | Database initialization |

---

## Development Guide

### Prerequisites

- Node.js 20+
- npm or yarn
- Docker Desktop (for containers)
- PostgreSQL 16+ (for local dev)

### Setup Development Environment

```bash
# Clone repository
git clone <repo-url>
cd TaskMaster-master

# Install dependencies
npm install

# Setup PostgreSQL locally
psql -U postgres -c "CREATE DATABASE scheduler;"
psql -U postgres -d scheduler -f pkg/db/setup.sql
```

### Development Workflow

**1. Start PostgreSQL (if not in Docker)**

```bash
# Ensure PostgreSQL is running
sudo systemctl start postgresql  # Linux
brew services start postgresql    # Mac
# Windows: Services → PostgreSQL
```

**2. Set Environment Variables**

```bash
export POSTGRES_USER=postgres
export POSTGRES_PASSWORD=postgres
export POSTGRES_DB=scheduler
export POSTGRES_HOST=localhost
export POSTGRES_PORT=5432
```

**3. Run Services with Nodemon (auto-reload)**

```bash
# Install nodemon globally
npm install -g nodemon

# Terminal 1
nodemon cmd/coordinator/main.js

# Terminal 2
nodemon cmd/scheduler/main.js

# Terminal 3
nodemon cmd/worker/main.js
```

### Code Style

- **ESM Modules**: Use `import/export`
- **Async/Await**: Prefer over callbacks
- **Error Handling**: Try/catch for async, callbacks for gRPC
- **Logging**: Use `console.log` / `console.error`

### Adding New Features

**Example: Add Task Priority**

1. **Update Database Schema:**

```sql
ALTER TABLE tasks ADD COLUMN priority INTEGER DEFAULT 0;
CREATE INDEX idx_tasks_priority ON tasks (priority DESC, scheduled_at);
```

2. **Update Proto:**

```protobuf
message TaskRequest {
  string task_id = 1;
  string data = 2;
  int32 priority = 3;  // NEW
}
```

3. **Update Scheduler:**

```javascript
const { command, scheduled_at, priority } = req.body;
await this.dbPool.query(
  'INSERT INTO tasks (command, scheduled_at, priority) VALUES ($1, $2, $3) RETURNING id',
  [command, scheduledTime, priority || 0]
);
```

4. **Update Coordinator Query:**

```javascript
const result = await client.query(`
  SELECT id, command, priority 
  FROM tasks 
  WHERE scheduled_at < (NOW() + INTERVAL '30 seconds') 
    AND picked_at IS NULL 
  ORDER BY priority DESC, scheduled_at 
  FOR UPDATE SKIP LOCKED
`);
```

### Debugging

**Enable Debug Logs:**

```bash
export DEBUG=*                    # All logs
export GRPC_VERBOSITY=DEBUG       # gRPC logs
export GRPC_TRACE=all             # gRPC traces
```

**Inspect Docker Containers:**

```bash
# View logs
docker-compose -f docker-compose-node.yml logs -f scheduler

# Execute commands in container
docker-compose -f docker-compose-node.yml exec scheduler sh

# Check environment variables
docker-compose -f docker-compose-node.yml exec coordinator env
```

**Database Inspection:**

```bash
# Connect to PostgreSQL
docker-compose -f docker-compose-node.yml exec postgres psql -U postgres -d scheduler

# Useful queries
SELECT * FROM tasks ORDER BY scheduled_at DESC LIMIT 10;
SELECT COUNT(*), completed_at IS NOT NULL as completed FROM tasks GROUP BY completed;
```

---

## Performance & Scaling

### Horizontal Scaling

**Scale Workers:**

```bash
docker-compose -f docker-compose-node.yml up --scale worker=20
```

**Benchmark:**
- 1 Worker: ~12 tasks/min (5s/task)
- 5 Workers: ~60 tasks/min
- 10 Workers: ~120 tasks/min
- 20 Workers: ~240 tasks/min

### Vertical Scaling

**Increase Worker Pool Size:**

```javascript
// pkg/worker/worker.js
const WORKER_POOL_SIZE = 10; // Default: 5
```

Each worker node can process `WORKER_POOL_SIZE` tasks concurrently.

### Database Optimization

**Connection Pooling:**

```javascript
const pool = new Pool({
  connectionString: dbConnectionString,
  max: 20,                      // Increase for high load
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

**Indexing:**

```sql
-- Existing index
CREATE INDEX idx_tasks_scheduled_at ON tasks (scheduled_at);

-- Additional indexes for queries
CREATE INDEX idx_tasks_status ON tasks (picked_at, started_at, completed_at);
```

### Bottlenecks

1. **Database Polling**: 10s interval limits responsiveness
   - **Solution**: Reduce scan interval or use LISTEN/NOTIFY
   
2. **Round-Robin Fairness**: Workers with slower tasks bottleneck
   - **Solution**: Implement weighted round-robin or least-conn
   
3. **gRPC Connection Overhead**: Creating connections per dispatch
   - **Solution**: Connection pooling (already implemented)

### Monitoring

**Add Prometheus Metrics:**

```bash
npm install prom-client
```

```javascript
// pkg/coordinator/coordinator.js
import { register, Counter, Gauge } from 'prom-client';

const tasksDispatched = new Counter({
  name: 'tasks_dispatched_total',
  help: 'Total tasks dispatched to workers'
});

const activeWorkers = new Gauge({
  name: 'active_workers',
  help: 'Number of active workers'
});

// Expose metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

---

## Troubleshooting

### Common Issues

#### 1. Port Already in Use

**Symptom:**

```
Error: listen EADDRINUSE: address already in use :::8080
```

**Solution:**

```bash
# Linux/Mac
lsof -ti:8080 | xargs kill -9

# Windows PowerShell
netstat -ano | findstr :8080
taskkill /PID <PID> /F

# Or use npx
npx kill-port 8080 8081
```

#### 2. Database Connection Failed

**Symptom:**

```
Failed to connect to the database. Retrying in 5 seconds...
```

**Solutions:**

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql    # Linux
brew services list | grep postgres  # Mac
services.msc                         # Windows

# Verify credentials
psql -U postgres -d scheduler

# Check environment variables
env | grep POSTGRES
```

#### 3. Workers Not Registering

**Symptom:**

```
no workers available
```

**Solutions:**

1. Ensure coordinator is running first
2. Check worker logs for connection errors
3. Verify `COORDINATOR` env var is correct
4. Check firewall/network connectivity

```bash
# Test coordinator gRPC port
telnet localhost 8080

# Docker networking
docker-compose -f docker-compose-node.yml exec worker ping coordinator
```

#### 4. Tasks Not Being Picked Up

**Symptom:**

Tasks remain in database with `picked_at` NULL.

**Solutions:**

1. Check coordinator logs for errors
2. Verify `scheduled_at` is not too far in future
3. Ensure database polling is active

```sql
-- Check scheduled_at
SELECT id, scheduled_at, NOW() FROM tasks WHERE picked_at IS NULL;

-- Manually trigger (for debugging)
UPDATE tasks SET scheduled_at = NOW() WHERE id = '<task-id>';
```

#### 5. gRPC Connection Errors

**Symptom:**

```
14 UNAVAILABLE: Name resolution failed
```

**Solutions:**

1. Check address format (should include port)
2. Verify DNS resolution

```javascript
// Worker → Coordinator
const coordinatorAddress = 'coordinator:8080'; // Not 'coordinator8080'
```

#### 6. Jest Tests Timeout

**Symptom:**

```
thrown: "Exceeded timeout of 30000 ms for a test."
```

**Solutions:**

```javascript
// Increase test timeout
test('E2E Success', async () => {
  // ...
}, 60000); // 60 seconds

// Or globally in jest.config.js
export default {
  testTimeout: 60000,
};
```

### Debug Mode

**Enable Verbose Logging:**

```bash
# Set in environment
export DEBUG=*
export NODE_ENV=development

# Or in code
console.log('Debug:', JSON.stringify(object, null, 2));
```

**gRPC Debugging:**

```bash
export GRPC_VERBOSITY=DEBUG
export GRPC_TRACE=all
npm run coordinator
```

### Logs Analysis

**Docker Compose Logs:**

```bash
# All services
docker-compose -f docker-compose-node.yml logs -f

# Specific service
docker-compose -f docker-compose-node.yml logs -f coordinator

# Last 100 lines
docker-compose -f docker-compose-node.yml logs --tail=100

# Since timestamp
docker-compose -f docker-compose-node.yml logs --since 2026-01-23T15:00:00
```

**Search Logs:**

```bash
# Find errors
docker-compose -f docker-compose-node.yml logs | grep -i error

# Find specific task
docker-compose -f docker-compose-node.yml logs | grep "task_id: a1b2c3d4"
```

---

## License

MIT License

Copyright (c) 2026 TaskMaster Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

---

## Credits

**Original Author:** JyotinderSingh  
**JavaScript/Node.js Conversion:** 2026  
**Purpose:** Educational demonstration of distributed systems

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

**Areas for Improvement:**
- Add authentication/authorization
- Implement task retries and dead letter queue
- Add metrics and monitoring
- Implement priority queue
- Add cron-style scheduling
- Implement task dependencies (DAG)
- Add web dashboard
- Implement horizontal autoscaling

---

**Questions? Issues?** Open an issue on GitHub or check the troubleshooting section above.

---

**Happy Scheduling! 🚀**

