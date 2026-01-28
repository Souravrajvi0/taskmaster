# TaskMaster Technical Guide

An end-to-end guide to TaskMaster: architecture, services, APIs (HTTP and gRPC), database model, runtime operations, and extension tips. This is written for engineers who need to develop, operate, or extend the system.
# TaskMaster Technical Guide (Interview-Ready)

This guide is meant to make you self-sufficient for interviews and production-style conversations. It explains architecture, data flows, APIs, internals, operations, troubleshooting, and extension points. All links point to concrete code so you can defend implementation details.

## Table of Contents
1. System Overview (what, why, how it fits together)
2. Architecture & Components (services, ports, responsibilities)
3. Data Model (PostgreSQL schema)
4. Protocols (gRPC contracts)
5. HTTP API (routes, payloads, examples)
6. Internal Flows (task lifecycle, scheduling, heartbeats)
7. Concurrency & Timing (intervals, pools, backpressure)
8. Configuration (env matrix, defaults)
9. Operations (run, scale, observe)
10. Logs & Observability (SSE stream, buffers)
11. Troubleshooting Playbook (common faults, fixes)
12. Security & Hardening (auth, network, resource limits)
13. Performance Notes (tuning levers)
14. Extensibility Guide (where to change what)
15. Frontend Integration (UI expectations)
16. Deployment Variants (Docker and local)
17. File Landmarks (where things live)
18. Talking Points for Interviews (quick hits)

## 1) System Overview
- Purpose: Distributed task scheduler with live monitoring, autoscaled workers, and fault tolerance.
- Stack: Node.js 20, Express, gRPC, PostgreSQL 16, React + Vite, Docker Compose.
- Ports: frontend 5173; scheduler HTTP/SSE 8081; coordinator gRPC 8080; Postgres 5432; workers dynamic inside the compose network.
- Flow: client -> scheduler (HTTP/SSE) -> coordinator (gRPC + DB polling) -> workers (gRPC) -> DB updates -> scheduler SSE to UI.

## 2) Architecture & Components
- Scheduler: HTTP/SSE API, stats, logs, scaling controls. Code: [cmd/scheduler/main.js](cmd/scheduler/main.js) -> [pkg/scheduler/scheduler.js](pkg/scheduler/scheduler.js).
- Coordinator: Worker registry, dispatch, heartbeats, DB polling. Code: [cmd/coordinator/main.js](cmd/coordinator/main.js) -> [pkg/coordinator/coordinator.js](pkg/coordinator/coordinator.js).
- Worker: Executes tasks, heartbeats, status reports. Code: [cmd/worker/main.js](cmd/worker/main.js) -> [pkg/worker/worker.js](pkg/worker/worker.js).
- Shared utilities: [pkg/common/common.js](pkg/common/common.js).
- Contracts: [pkg/grpcapi/api.proto](pkg/grpcapi/api.proto).
- Schema: [pkg/db/setup.sql](pkg/db/setup.sql).

### Responsibilities by Service
- Scheduler: ingress for task creation, exposes stats/tasks/workers, emits logs via SSE, shells to docker compose for scaling/kill.
- Coordinator: round-robin worker selection, monitors heartbeats, polls DB for due tasks, writes status updates.
- Worker: concurrent task executor (pool of 5), reports status transitions, sends heartbeats.

## 3) Data Model (PostgreSQL)
Table: tasks ([pkg/db/setup.sql](pkg/db/setup.sql))
- id UUID PK DEFAULT uuid_generate_v4()
- command TEXT NOT NULL
- scheduled_at TIMESTAMP NOT NULL
- picked_at TIMESTAMP
- started_at TIMESTAMP
- completed_at TIMESTAMP
- failed_at TIMESTAMP
- worker_id INTEGER
Indexes: idx_tasks_scheduled_at, idx_tasks_worker_id

## 4) Protocols (gRPC) ([pkg/grpcapi/api.proto](pkg/grpcapi/api.proto))
- WorkerService.SubmitTask(TaskRequest) -> TaskResponse: coordinator to worker.
- CoordinatorService.SubmitTask(ClientTaskRequest) -> ClientTaskResponse: client gRPC ingress (parallel to HTTP path).
- CoordinatorService.SendHeartbeat(HeartbeatRequest): worker liveness and address.
- CoordinatorService.UpdateTaskStatus(UpdateTaskStatusRequest): worker reports STARTED/COMPLETE/FAILED with timestamps and worker id.
- CoordinatorService.ListWorkers(ListWorkersRequest) -> ListWorkersResponse: worker registry snapshot.
- Enum TaskStatus { QUEUED, STARTED, COMPLETE, FAILED }.

## 5) HTTP API (Scheduler)
Routes (aliases under /api/*):
- POST /schedule and POST /api/schedule: body {command, scheduled_at ISO}. Returns {command, scheduled_at (epoch seconds), task_id}.
- POST /api/schedule/batch: body {command=demo-job, count 1-1000, delay_seconds=0}. Enqueues many at once.
- GET /status and GET /api/status?task_id=UUID: returns timestamps + worker_id.
- GET /api/tasks: list all tasks ordered by scheduled_at.
- GET /api/stats: totals (pending/running/completed/failed) + workers (via gRPC ListWorkers).
- GET /api/workers: list workers.
- POST /api/workers/scale: body {count 1-50}. Executes docker compose up --scale worker=<count> -d.
- POST /api/workers/kill: body {name} (sanitized). Executes docker stop <name>.
- Logs: GET /api/logs (recent buffer), GET /api/logs/stream (SSE with backlog + keep-alive).

Example payloads:
- Schedule one:
	- POST /api/schedule
	- {"command":"demo-job","scheduled_at":"2026-01-27T12:30:00Z"}
- Schedule batch:
	- POST /api/schedule/batch
	- {"command":"bulk-job","count":25,"delay_seconds":5}
- Scale workers:
	- POST /api/workers/scale
	- {"count":5}

## 6) Internal Flows
### Task lifecycle
1) Client calls scheduler (HTTP). Task row inserted.
2) Scheduler log poller emits "scheduled" event to SSE.
3) Coordinator scan (every 10s) selects due tasks (< now + 30s, not picked, FOR UPDATE SKIP LOCKED), dispatches via gRPC SubmitTask, sets picked_at, worker_id.
4) Worker dequeues, reports STARTED, does 5s simulated work, reports COMPLETE (or FAILED).
5) Coordinator writes started_at/completed_at/failed_at, updates worker metrics.
6) Scheduler poller sees DB transitions, emits SSE, UI updates stats/table.

### Worker registration and heartbeats
- Worker starts, connects to coordinator, sends SendHeartbeat(workerId, address) every 5s.
- Coordinator tracks heartbeatMisses and drops workers exceeding 3 misses (15s tolerance) from pool and closes connections.

### Logs and SSE
- Scheduler keeps LogBuffer (250). Broadcasts events (scheduled/assigned/started/completed/failed and ops like scale/kill) to SSE clients, with backlog replay and keep-alive pings.

## 7) Concurrency & Timing
- Worker pool size: 5 concurrent loops per worker instance (WORKER_POOL_SIZE in [pkg/worker/worker.js](pkg/worker/worker.js)).
- Task processing time: 5 seconds simulated (TASK_PROCESS_TIME).
- Coordinator DB scan interval: 10 seconds (SCAN_INTERVAL). Window: tasks due within 30 seconds.
- Heartbeat interval: 5 seconds (DEFAULT_HEARTBEAT). Max misses: 3.
- Scheduler log poll interval: 1 second.
- DB pool: max 20 connections, 2s connect timeout, 30s idle timeout.

## 8) Configuration Matrix (defaults via docker-compose-node.yml)
- POSTGRES_DB=scheduler
- POSTGRES_USER=postgres
- POSTGRES_PASSWORD=postgres
- POSTGRES_HOST=postgres
- POSTGRES_PORT=5432
- SCHEDULER_PORT=:8081
- COORDINATOR_ADDRESS=coordinator:8080
- COORDINATOR_PORT=:8080
- WORKER_ADDRESS=worker
- WORKER_PORT (optional override)
- DOCKER_COMPOSE_FILE=docker-compose-node.yml

## 9) Operations
- Start stack (Docker): docker compose -f docker-compose-node.yml up --build --scale worker=3 -d
- Check: docker compose -f docker-compose-node.yml ps
- Logs: docker compose -f docker-compose-node.yml logs -f scheduler|coordinator|worker|postgres
- Scale: docker compose -f docker-compose-node.yml up --scale worker=N -d or POST /api/workers/scale
- Kill worker: docker stop <container> or POST /api/workers/kill
- Health: curl http://localhost:8081/api/stats

Local (non-Docker):
- npm install
- Create DB scheduler; apply schema: psql -U postgres -d scheduler -f pkg/db/setup.sql
- Set env POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB, POSTGRES_HOST=localhost, POSTGRES_PORT=5432
- Run: npm run coordinator | npm run scheduler | npm run worker (3 terminals)

Frontend:
- cd client && npm install && npm run dev (http://localhost:5173)

## 10) Logs & Observability
- SSE stream: /api/logs/stream (with backlog replay and keep-alive). Good for UI and quick tail.
- JSON logs: /api/logs.
- Derived events emitted for schedule, assignment, start, completion, failure, scale, kill.
- Container logs: docker compose -f docker-compose-node.yml logs -f <service>.

## 11) Troubleshooting Playbook
- Coordinator exits on start: DB not ready. Fix: docker compose -f docker-compose-node.yml up -d coordinator once Postgres is healthy.
- Workers not shown: check coordinator logs for heartbeats; ensure coordinator:8080 reachable from workers.
- Scaling endpoint fails: ensure Docker socket mounted and DOCKER_COMPOSE_FILE points to docker-compose-node.yml.
- No SSE logs: verify /api/logs/stream reachable; check scheduler log poller running; inspect scheduler logs.
- DB connectivity: psql -h localhost -U postgres -d scheduler -c "select count(*) from tasks".

## 12) Security & Hardening (what to mention in interviews)

## 13) Performance Notes
- Increase throughput: raise worker count (scale horizontally) and/or WORKER_POOL_SIZE per worker.
- Lower latency: shorten SCAN_INTERVAL and widen window; balance with DB load.
- DB tuning: bump pool size if coordinator is dispatch-bound; index additional columns if you add filters.
- Backpressure: currently best-effort; can add queue depth caps or reject when no workers.

## 14) Extensibility Guide
- Add task metadata: extend tasks table, update scheduler inserts and coordinator updates, expose in /api/tasks and UI.
- Retries: on worker failure, have coordinator requeue tasks whose failed_at is set; add retry count columns.
- Priorities: add priority column; change query in executeAllScheduledTasks to order by priority then time.
- Different executors: swap worker processTask to call real workloads or HTTP/gRPC downstreams.
- Metrics: add Prometheus scrape endpoints or push metrics to a time-series DB.

## 15) Frontend Integration
- Targets scheduler at http://localhost:8081/api/* and SSE at /api/logs/stream.
- Uses stats (pending/running/completed/failed) and workers list to render dashboards.
- Batch creation and scaling endpoints back the demo controls in the UI.
Code entry: [client/client/src/main.tsx](client/client/src/main.tsx), [client/client/src/App.tsx](client/client/src/App.tsx).

## 16) Deployment Variants
- Docker (default): docker compose -f docker-compose-node.yml up --build --scale worker=3 -d
- Local: run three Node processes + local Postgres.
- K8s (outline): deploy scheduler/coordinator/worker Deployments with Services; Postgres as StatefulSet; use Jobs for migrations; ConfigMaps/Secrets for env.

## 17) File Landmarks
- Compose: [docker-compose-node.yml](docker-compose-node.yml)
- Dockerfiles: [coordinator-node.dockerfile](coordinator-node.dockerfile), [scheduler-node.dockerfile](scheduler-node.dockerfile), [worker-node.dockerfile](worker-node.dockerfile), [postgres-dockerfile](postgres-dockerfile)
- Entrypoints: [cmd/coordinator/main.js](cmd/coordinator/main.js), [cmd/scheduler/main.js](cmd/scheduler/main.js), [cmd/worker/main.js](cmd/worker/main.js)
- Core logic: [pkg/coordinator/coordinator.js](pkg/coordinator/coordinator.js), [pkg/scheduler/scheduler.js](pkg/scheduler/scheduler.js), [pkg/worker/worker.js](pkg/worker/worker.js), [pkg/common/common.js](pkg/common/common.js)
- Schema/contract: [pkg/db/setup.sql](pkg/db/setup.sql), [pkg/grpcapi/api.proto](pkg/grpcapi/api.proto)
- Frontend entry: [client/client/src/main.tsx](client/client/src/main.tsx), [client/client/src/App.tsx](client/client/src/App.tsx)

## 18) Talking Points for Interviews
- Architecture: Scheduler (HTTP/SSE) + Coordinator (gRPC control plane) + Workers (gRPC executors) + Postgres persistence.
- Reliability: Heartbeats with eviction (3 misses at 5s), FOR UPDATE SKIP LOCKED to avoid double-pick, graceful shutdown hooks.
- Scalability: Horizontal worker scaling via docker compose or API; per-worker concurrency of 5.
- Observability: SSE log stream, status transitions derived from DB polling, stats endpoint.
- Data integrity: Single-writer semantics on picked tasks via row locks; status updates recorded with worker_id.
- Extensibility: priorities, retries, metrics, real task executors, auth/mTLS.

This document is intentionally dense so you can answer implementation-level questions and describe operational behavior confidently.
