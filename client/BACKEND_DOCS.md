# TaskMaster - Backend Documentation

A distributed task scheduler UI that simulates multiple workers processing tasks through their lifecycle.

## Quick Start

```bash
# 1) Start the backend (from repo root)
# Option A: Docker Compose (recommended)
docker-compose -f docker-compose-node.yml up --build --scale worker=3

# Option B: Local processes (requires local Postgres + env vars)
npm run coordinator &
npm run scheduler &
npm run worker &

# 2) Start the frontend (from ./client)
cd client
npm install
# Vite proxies /api to the scheduler on http://localhost:8081
npm run dev
```

Frontend runs on port 5173 and calls the backend at /api via the proxy.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                      │
│  Dashboard | Schedule Form | Task Detail                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Express API Server                       │
│  POST /api/schedule | GET /api/status | GET /api/tasks      │
│  GET /api/workers   | GET /api/stats                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Simulated Distributed System                    │
│  ┌─────────┐    ┌─────────────┐    ┌──────────────────┐    │
│  │Scheduler│───▶│ Coordinator │───▶│ Workers (1,2,3)  │    │
│  └─────────┘    └─────────────┘    └──────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   PostgreSQL Database                        │
│  tasks | workers                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### Tasks Table
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| command | TEXT | Task command to execute |
| status | TEXT | scheduled, assigned, running, completed, failed |
| scheduledAt | TIMESTAMP | When task should run |
| pickedAt | TIMESTAMP | When coordinator picked it up |
| startedAt | TIMESTAMP | When worker started execution |
| completedAt | TIMESTAMP | When task completed |
| failedAt | TIMESTAMP | When task failed (if applicable) |
| assignedWorker | INTEGER | Foreign key to workers.id |
| errorMessage | TEXT | Error details if failed |
| createdAt | TIMESTAMP | Record creation time |

### Workers Table
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| name | TEXT | Worker identifier (worker-1, worker-2, worker-3) |
| status | TEXT | idle, busy, offline |
| currentTaskId | UUID | Currently processing task |
| tasksCompleted | INTEGER | Counter of completed tasks |
| lastActiveAt | TIMESTAMP | Last activity timestamp |

---

## API Endpoints

### NEW: Worker Control (requires Docker/Compose available where scheduler runs)

- `POST /api/workers/scale` — Body: `{ "count": <1-50> }` → runs `docker-compose -f docker-compose-node.yml up --scale worker=<count> -d`
- `POST /api/workers/kill` — Body: `{ "name": "taskmaster-master-worker-2" }` → runs `docker stop <name>`

These are used by the UI buttons in the Worker Control panel. Ensure the scheduler process has access to Docker/Compose (e.g., mounted docker.sock or running on the host with Docker installed).

### POST /api/schedule
Schedule a new task.

**Request:**
```json
{
  "command": "process-data --input file.csv",
  "scheduled_at": "2024-01-23T10:00:00.000Z"
}
```

**Response:**
```json
{
  "task_id": "uuid-string",
  "status": "scheduled",
  "scheduled_at": "2024-01-23T10:00:00.000Z"
}
```

### GET /api/status?task_id={uuid}
Get detailed task status.

**Response:**
```json
{
  "task_id": "uuid-string",
  "command": "process-data --input file.csv",
  "status": "running",
  "scheduled_at": "2024-01-23T10:00:00.000Z",
  "picked_at": "2024-01-23T10:00:01.000Z",
  "started_at": "2024-01-23T10:00:03.000Z",
  "completed_at": null,
  "failed_at": null,
  "assigned_worker": 1,
  "error_message": null
}
```

### GET /api/tasks
List all tasks.

**Response:**
```json
{
  "tasks": [
    {
      "id": "uuid-string",
      "command": "task-command",
      "status": "completed",
      "scheduledAt": "timestamp",
      "assignedWorker": 1
    }
  ]
}
```

### GET /api/workers
List all workers.

**Response:**
```json
{
  "workers": [
    {
      "id": 1,
      "name": "worker-1",
      "status": "idle",
      "currentTaskId": null,
      "tasksCompleted": 5,
      "lastActiveAt": "timestamp"
    }
  ]
}
```

### GET /api/stats
System statistics.

**Response:**
```json
{
  "total_tasks": 10,
  "pending_tasks": 2,
  "running_tasks": 1,
  "completed_tasks": 7,
  "failed_tasks": 0,
  "workers": [...]
}
```

---

## Task Lifecycle Simulation

Tasks progress through these stages with simulated timing:

```
SCHEDULED ──(1s)──▶ ASSIGNED ──(2s)──▶ RUNNING ──(5s)──▶ COMPLETED
     │                  │                  │                  │
     │                  │                  │                  │
  Created          Coordinator        Worker picks       Execution
  in DB            picks task         up & starts        finishes
```

### Coordinator Behavior
- Runs every 1 second via `setInterval`
- Picks tasks where `scheduled_at <= now` and status is `scheduled`
- Assigns to workers in round-robin fashion
- Updates task status to `assigned` and sets `picked_at`

### Worker Behavior
- Each worker picks up tasks assigned to them
- Waits 2 seconds, then sets status to `running` and `started_at`
- Waits 5 seconds, then sets status to `completed` and `completed_at`
- Updates worker's `tasks_completed` counter

---

## File Structure

```
├── server/
│   ├── index.ts          # Express server entry point
│   ├── routes.ts         # API route handlers
│   ├── storage.ts        # Database operations (IStorage interface)
│   ├── db.ts             # Drizzle database connection
│   └── vite.ts           # Vite dev server integration
│
├── shared/
│   ├── schema.ts         # Drizzle ORM schema + Zod validation
│   └── routes.ts         # Shared route types (request/response shapes)
│
├── client/
│   └── src/
│       ├── App.tsx           # React app with routing
│       ├── pages/
│       │   ├── dashboard.tsx    # Main dashboard
│       │   ├── schedule.tsx     # Task scheduling form
│       │   └── task-detail.tsx  # Task status view
│       └── components/
│           └── status-badge.tsx # Reusable status indicator
│
└── drizzle.config.ts     # Drizzle migration config
```

---

## Key Implementation Details

### Storage Interface (server/storage.ts)
All database operations go through `IStorage` interface:

```typescript
interface IStorage {
  // Tasks
  createTask(task: InsertTask): Promise<Task>;
  getTask(id: string): Promise<Task | undefined>;
  getAllTasks(): Promise<Task[]>;
  updateTask(id: string, updates: Partial<Task>): Promise<Task>;
  getScheduledTasksDue(): Promise<Task[]>;
  
  // Workers
  createWorker(worker: InsertWorker): Promise<Worker>;
  getWorker(id: number): Promise<Worker | undefined>;
  getAllWorkers(): Promise<Worker[]>;
  updateWorker(id: number, updates: Partial<Worker>): Promise<Worker>;
  getIdleWorkers(): Promise<Worker[]>;
}
```

### Adding New Features

1. **New API endpoint**: Add route in `server/routes.ts`
2. **New DB operation**: Add method to `IStorage` interface and implement in `DatabaseStorage`
3. **Schema changes**: Update `shared/schema.ts`, then run `npm run db:push`

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| DATABASE_URL | PostgreSQL connection string (auto-configured) |
| SESSION_SECRET | Session encryption key |
| NODE_ENV | development or production |

---

## Common Tasks

### Reset Database
```bash
npm run db:push --force
```

### View Database
Use the Replit database pane or connect via `psql $DATABASE_URL`.

### Add a New Worker
Workers are initialized on server startup in `server/routes.ts`. Modify the initialization loop to add more workers.

### Change Task Execution Time
In `server/routes.ts`, find the `simulateWorkerExecution` function and adjust the `setTimeout` delays.
