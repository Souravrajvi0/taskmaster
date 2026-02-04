# TaskMaster Backend Architecture - Interview Guide

> **Purpose**: Visual diagrams to explain the distributed task scheduler backend architecture during technical interviews

---

## 1. System Overview - High-Level Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        UI[React UI<br/>Port: 5173]
    end
    
    subgraph "API Gateway Layer"
        Scheduler[Scheduler Service<br/>Express HTTP API<br/>Port: 8081]
    end
    
    subgraph "Orchestration Layer"
        Coordinator[Coordinator Service<br/>gRPC Server<br/>Port: 8080]
    end
    
    subgraph "Worker Pool Layer"
        W1[Worker 1<br/>gRPC Server]
        W2[Worker 2<br/>gRPC Server]
        W3[Worker N<br/>gRPC Server]
    end
    
    subgraph "Data Layer"
        DB[(PostgreSQL<br/>Port: 5432<br/>tasks table)]
    end
    
    UI -->|HTTP/REST + SSE| Scheduler
    Scheduler -->|SQL Queries| DB
    Scheduler -->|gRPC: ListWorkers| Coordinator
    Coordinator -->|SQL: Poll Tasks| DB
    Coordinator -->|gRPC: SubmitTask| W1
    Coordinator -->|gRPC: SubmitTask| W2
    Coordinator -->|gRPC: SubmitTask| W3
    W1 -->|gRPC: SendHeartbeat| Coordinator
    W2 -->|gRPC: SendHeartbeat| Coordinator
    W3 -->|gRPC: SendHeartbeat| Coordinator
    W1 -->|gRPC: UpdateTaskStatus| Coordinator
    W2 -->|gRPC: UpdateTaskStatus| Coordinator
    W3 -->|gRPC: UpdateTaskStatus| Coordinator
    Coordinator -->|SQL: Update Status| DB
    
    style UI fill:#e1f5ff
    style Scheduler fill:#fff4e6
    style Coordinator fill:#f3e5f5
    style W1 fill:#e8f5e9
    style W2 fill:#e8f5e9
    style W3 fill:#e8f5e9
    style DB fill:#fce4ec
```

**Key Points to Explain**:
- **4-Layer Architecture**: Client → API Gateway → Orchestration → Workers
- **Communication Protocols**: HTTP/REST for external, gRPC for internal microservices
- **Horizontal Scaling**: Workers can scale from 1 to 50+ instances
- **Centralized State**: PostgreSQL as single source of truth

---

## 2. Request Flow - Task Creation to Completion

```mermaid
sequenceDiagram
    participant User
    participant UI as React UI
    participant Scheduler as Scheduler<br/>(Express)
    participant DB as PostgreSQL
    participant Coordinator as Coordinator<br/>(gRPC)
    participant Worker as Worker<br/>(gRPC)
    
    Note over User,Worker: PHASE 1: Task Creation
    User->>UI: Click "Create 10 Tasks"
    UI->>Scheduler: POST /api/schedule/batch<br/>{count: 10, command: "demo-job"}
    Scheduler->>DB: INSERT INTO tasks (command, scheduled_at)<br/>VALUES (...) RETURNING id
    DB-->>Scheduler: task_ids: [uuid1, uuid2, ...]
    Scheduler-->>UI: {count: 10, task_ids: [...]}
    Scheduler->>UI: SSE: "Enqueued 10 tasks"
    
    Note over User,Worker: PHASE 2: Task Assignment
    Coordinator->>DB: SELECT id, command FROM tasks<br/>WHERE scheduled_at < NOW() + 30s<br/>AND picked_at IS NULL<br/>FOR UPDATE SKIP LOCKED
    DB-->>Coordinator: [task1, task2, task3]
    Coordinator->>Coordinator: Round-Robin: Select Worker 1
    Coordinator->>Worker: gRPC: SubmitTask(task_id, data)
    Worker-->>Coordinator: {success: true}
    Coordinator->>DB: UPDATE tasks SET picked_at = NOW(),<br/>worker_id = 1 WHERE id = task1
    
    Note over User,Worker: PHASE 3: Task Execution
    Worker->>Worker: Add task to internal queue
    Worker->>Coordinator: gRPC: UpdateTaskStatus(task_id, STARTED)
    Coordinator->>DB: UPDATE tasks SET started_at = NOW()<br/>WHERE id = task1
    Worker->>Worker: Process task (5 seconds)
    Worker->>Coordinator: gRPC: UpdateTaskStatus(task_id, COMPLETE)
    Coordinator->>DB: UPDATE tasks SET completed_at = NOW()<br/>WHERE id = task1
    
    Note over User,Worker: PHASE 4: Real-Time Updates
    Scheduler->>DB: Poll: SELECT * FROM tasks (every 1s)
    Scheduler->>Scheduler: Detect state transition
    Scheduler->>UI: SSE: "Task abc123 completed"
    UI->>UI: Update task table + worker stats
```

**Key Points to Explain**:
- **Asynchronous Processing**: Task creation returns immediately, execution happens in background
- **Database Polling**: Coordinator scans every 10s with 30s lookahead window
- **Real-Time Updates**: Server-Sent Events (SSE) for live UI updates
- **Transaction Safety**: `FOR UPDATE SKIP LOCKED` prevents race conditions

---

## 3. Component Deep Dive - Internal Architecture

### 3.1 Scheduler Service (API Gateway)

```mermaid
graph LR
    subgraph "Scheduler Service (scheduler.js)"
        HTTP[Express HTTP Server<br/>Port: 8081]
        SSE[SSE Clients Set<br/>Real-time connections]
        LogBuffer[Log Buffer<br/>Ring buffer: 250 events]
        Poller[DB Poller<br/>Interval: 1s]
        
        HTTP --> Routes
        Routes --> |POST /api/schedule/batch| BatchHandler
        Routes --> |GET /api/tasks| TasksHandler
        Routes --> |GET /api/workers| WorkersHandler
        Routes --> |POST /api/workers/scale| ScaleHandler
        Routes --> |GET /api/logs/stream| SSEHandler
        
        BatchHandler --> DBPool
        TasksHandler --> DBPool
        WorkersHandler --> gRPCClient[gRPC Client<br/>to Coordinator]
        ScaleHandler --> Docker[Docker Compose<br/>exec]
        SSEHandler --> SSE
        
        Poller --> DBPool
        Poller --> LogBuffer
        LogBuffer --> SSE
    end
    
    DBPool[(PostgreSQL<br/>Connection Pool)]
    
    style HTTP fill:#fff4e6
    style SSE fill:#e3f2fd
    style LogBuffer fill:#f3e5f5
    style Poller fill:#e8f5e9
```

**Key Responsibilities**:
1. **HTTP API**: Expose REST endpoints for task management
2. **SSE Streaming**: Broadcast real-time logs to connected clients
3. **Worker Scaling**: Execute Docker Compose commands to scale workers
4. **State Polling**: Detect task state transitions for live updates

---

### 3.2 Coordinator Service (Orchestration Engine)

```mermaid
graph TB
    subgraph "Coordinator Service (coordinator.js)"
        gRPCServer[gRPC Server<br/>Port: 8080]
        
        subgraph "Worker Registry"
            WorkerPool[WorkerPool Map<br/>workerId → WorkerInfo]
            WorkerKeys[WorkerPoolKeys Array<br/>for Round-Robin]
            RRIndex[Round-Robin Index]
        end
        
        subgraph "Background Jobs"
            Scanner[Task Scanner<br/>Interval: 10s]
            Heartbeat[Heartbeat Monitor<br/>Interval: 15s]
        end
        
        gRPCServer --> SubmitTask[SubmitTask RPC]
        gRPCServer --> SendHeartbeat[SendHeartbeat RPC]
        gRPCServer --> UpdateStatus[UpdateTaskStatus RPC]
        gRPCServer --> ListWorkers[ListWorkers RPC]
        
        SubmitTask --> WorkerPool
        SendHeartbeat --> WorkerPool
        UpdateStatus --> DBPool
        ListWorkers --> WorkerPool
        
        Scanner --> DBPool
        Scanner --> WorkerPool
        Scanner --> RRIndex
        
        Heartbeat --> WorkerPool
        Heartbeat --> |Remove inactive| WorkerKeys
    end
    
    DBPool[(PostgreSQL)]
    Workers[Worker gRPC Clients]
    
    WorkerPool -.->|gRPC calls| Workers
    
    style gRPCServer fill:#f3e5f5
    style WorkerPool fill:#e8f5e9
    style Scanner fill:#fff4e6
    style Heartbeat fill:#fce4ec
```

**Key Algorithms**:

1. **Round-Robin Load Balancing**:
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

2. **Heartbeat-Based Worker Health**:
- Workers send heartbeat every 5s
- Coordinator allows 3 missed heartbeats (15s tolerance)
- Auto-removes inactive workers from pool

3. **Task Polling with Lookahead**:
```sql
SELECT id, command FROM tasks 
WHERE scheduled_at < (NOW() + INTERVAL '30 seconds') 
  AND picked_at IS NULL 
ORDER BY scheduled_at 
FOR UPDATE SKIP LOCKED
```

---

### 3.3 Worker Service (Task Executor)

```mermaid
graph TB
    subgraph "Worker Service (worker.js)"
        gRPCServer[gRPC Server<br/>Random Port]
        
        subgraph "Task Management"
            TaskQueue[Task Queue<br/>Array FIFO]
            ReceivedTasks[Received Tasks Map<br/>task_id → task]
        end
        
        subgraph "Worker Pool (5 concurrent workers)"
            W1[Worker Goroutine 1]
            W2[Worker Goroutine 2]
            W3[Worker Goroutine 3]
            W4[Worker Goroutine 4]
            W5[Worker Goroutine 5]
        end
        
        subgraph "Background Jobs"
            HeartbeatJob[Heartbeat Job<br/>Interval: 5s]
        end
        
        gRPCServer --> SubmitTaskRPC[SubmitTask RPC]
        SubmitTaskRPC --> TaskQueue
        SubmitTaskRPC --> ReceivedTasks
        
        TaskQueue --> W1
        TaskQueue --> W2
        TaskQueue --> W3
        TaskQueue --> W4
        TaskQueue --> W5
        
        W1 --> ProcessTask[Process Task<br/>5 seconds]
        W2 --> ProcessTask
        W3 --> ProcessTask
        W4 --> ProcessTask
        W5 --> ProcessTask
        
        ProcessTask --> UpdateStatus[gRPC: UpdateTaskStatus<br/>to Coordinator]
        
        HeartbeatJob --> SendHeartbeat[gRPC: SendHeartbeat<br/>to Coordinator]
    end
    
    Coordinator[Coordinator Service]
    
    UpdateStatus -.->|gRPC| Coordinator
    SendHeartbeat -.->|gRPC| Coordinator
    
    style gRPCServer fill:#e8f5e9
    style TaskQueue fill:#fff4e6
    style W1 fill:#e3f2fd
    style W2 fill:#e3f2fd
    style W3 fill:#e3f2fd
    style W4 fill:#e3f2fd
    style W5 fill:#e3f2fd
```

**Key Design Patterns**:
1. **Internal Worker Pool**: 5 concurrent async workers per Worker instance
2. **Queue-Based Processing**: FIFO task queue with polling
3. **Graceful Shutdown**: Waits for all in-flight tasks to complete

---

## 4. Database Schema & Task Lifecycle

```mermaid
erDiagram
    TASKS {
        UUID id PK "Auto-generated UUID"
        TEXT command "Task payload/command"
        TIMESTAMP scheduled_at "When to execute"
        TIMESTAMP picked_at "When assigned to worker"
        TIMESTAMP started_at "When execution began"
        TIMESTAMP completed_at "When successfully completed"
        TIMESTAMP failed_at "When failed"
        INTEGER worker_id "Worker that processed task"
    }
```

### Task State Machine

```mermaid
stateDiagram-v2
    [*] --> SCHEDULED: Task created via API
    SCHEDULED --> ASSIGNED: Coordinator picks task<br/>(picked_at set)
    ASSIGNED --> RUNNING: Worker starts execution<br/>(started_at set)
    RUNNING --> COMPLETED: Task succeeds<br/>(completed_at set)
    RUNNING --> FAILED: Task fails<br/>(failed_at set)
    COMPLETED --> [*]
    FAILED --> [*]
    
    note right of SCHEDULED
        picked_at IS NULL
        started_at IS NULL
    end note
    
    note right of ASSIGNED
        picked_at NOT NULL
        started_at IS NULL
    end note
    
    note right of RUNNING
        started_at NOT NULL
        completed_at IS NULL
        failed_at IS NULL
    end note
```

**Database Indexes**:
```sql
CREATE INDEX idx_tasks_scheduled_at ON tasks (scheduled_at);
CREATE INDEX idx_tasks_worker_id ON tasks (worker_id);
```

---

## 5. gRPC Communication Contracts

```mermaid
graph LR
    subgraph "Worker → Coordinator"
        W1[SendHeartbeat<br/>workerId, address]
        W2[UpdateTaskStatus<br/>task_id, status, timestamps]
    end
    
    subgraph "Coordinator → Worker"
        C1[SubmitTask<br/>task_id, data]
    end
    
    subgraph "Scheduler → Coordinator"
        S1[ListWorkers<br/>empty request]
    end
    
    W1 -->|Every 5s| Coordinator
    W2 -->|On STARTED/COMPLETE| Coordinator
    Coordinator -->|Round-Robin| C1
    Scheduler -->|HTTP /api/workers| S1
    
    style W1 fill:#e8f5e9
    style W2 fill:#e8f5e9
    style C1 fill:#f3e5f5
    style S1 fill:#fff4e6
```

**Protocol Buffers Definition**:
```protobuf
service CoordinatorService {
  rpc SendHeartbeat (HeartbeatRequest) returns (HeartbeatResponse);
  rpc UpdateTaskStatus (UpdateTaskStatusRequest) returns (UpdateTaskStatusResponse);
  rpc ListWorkers (ListWorkersRequest) returns (ListWorkersResponse);
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

## 6. Scaling & Fault Tolerance

### Horizontal Scaling Flow

```mermaid
sequenceDiagram
    participant User
    participant UI
    participant Scheduler
    participant Docker
    participant NewWorker
    participant Coordinator
    
    User->>UI: Click "5 Workers" button
    UI->>Scheduler: POST /api/workers/scale {count: 5}
    Scheduler->>Docker: docker-compose up --scale worker=5 -d
    Docker->>NewWorker: Start new worker containers
    NewWorker->>NewWorker: Start gRPC server on random port
    NewWorker->>Coordinator: gRPC: SendHeartbeat(workerId, address)
    Coordinator->>Coordinator: Register worker in pool
    Coordinator-->>NewWorker: {acknowledged: true}
    Scheduler-->>UI: {ok: true, count: 5}
    UI->>UI: Refresh worker list
```

### Fault Tolerance Mechanisms

```mermaid
graph TB
    subgraph "Worker Failure Scenarios"
        F1[Worker Crashes]
        F2[Network Partition]
        F3[Worker Overload]
    end
    
    subgraph "Detection Mechanisms"
        D1[Missed Heartbeats<br/>3 × 5s = 15s timeout]
        D2[gRPC Connection Errors]
        D3[Task Timeout<br/>No status update]
    end
    
    subgraph "Recovery Actions"
        R1[Remove from Worker Pool]
        R2[Task remains in DB<br/>picked_at set, started_at NULL]
        R3[Coordinator re-assigns<br/>on next poll cycle]
    end
    
    F1 --> D1
    F2 --> D1
    F3 --> D3
    
    D1 --> R1
    D2 --> R1
    D3 --> R2
    
    R1 --> R3
    R2 --> R3
    
    style F1 fill:#ffebee
    style F2 fill:#ffebee
    style F3 fill:#ffebee
    style R3 fill:#e8f5e9
```

---

## 7. Technology Stack Summary

```mermaid
graph TB
    subgraph "Backend Stack"
        Node[Node.js 20<br/>Runtime]
        Express[Express.js<br/>HTTP Server]
        gRPC[gRPC + Protocol Buffers<br/>Inter-service Communication]
        PG[PostgreSQL 16<br/>Persistent Storage]
        Docker[Docker + Docker Compose<br/>Containerization]
    end
    
    subgraph "Key Libraries"
        L1[@grpc/grpc-js<br/>gRPC client/server]
        L2[pg<br/>PostgreSQL driver]
        L3[uuid<br/>Task ID generation]
    end
    
    Node --> Express
    Node --> gRPC
    Express --> L2
    gRPC --> L1
    Express --> L3
    
    style Node fill:#68a063
    style Express fill:#000000,color:#fff
    style gRPC fill:#244c5a,color:#fff
    style PG fill:#336791,color:#fff
    style Docker fill:#2496ed,color:#fff
```

---

## Interview Talking Points

### 1. **Why gRPC for Internal Communication?**
- **Performance**: Binary protocol, faster than JSON/HTTP
- **Type Safety**: Protocol Buffers enforce contracts
- **Bi-directional Streaming**: Future support for worker → coordinator push
- **Language Agnostic**: Easy to add workers in Go/Python/Java

### 2. **Why PostgreSQL over Redis/MongoDB?**
- **ACID Transactions**: Critical for task state consistency
- **SQL Queries**: Complex queries for task filtering
- **Persistence**: Tasks survive system restarts
- **`FOR UPDATE SKIP LOCKED`**: Built-in support for queue patterns

### 3. **Scalability Bottlenecks**
- **Database**: Single PostgreSQL instance (can add read replicas)
- **Coordinator**: Single instance (can implement leader election with Raft/etcd)
- **Workers**: Horizontally scalable to 100+ instances

### 4. **Production Improvements**
- Add Redis for distributed locking
- Implement task retries with exponential backoff
- Add metrics (Prometheus) and tracing (Jaeger)
- Use Kubernetes instead of Docker Compose
- Add authentication/authorization (JWT)

---

## Quick Reference - Port Mapping

| Service | Port | Protocol | Purpose |
|---------|------|----------|---------|
| React UI | 5173 | HTTP | User interface |
| Scheduler | 8081 | HTTP | REST API + SSE |
| Coordinator | 8080 | gRPC | Worker orchestration |
| Workers | Dynamic | gRPC | Task execution |
| PostgreSQL | 5432 | TCP | Database |

---

## File Structure Reference

```
taskmaster-master/
├── pkg/
│   ├── scheduler/scheduler.js    # HTTP API + SSE
│   ├── coordinator/coordinator.js # gRPC orchestration
│   ├── worker/worker.js          # Task execution
│   ├── common/common.js          # DB utilities
│   ├── grpcapi/api.proto         # gRPC contracts
│   └── db/setup.sql              # Database schema
├── cmd/
│   ├── scheduler/main.js         # Scheduler entry point
│   ├── coordinator/main.js       # Coordinator entry point
│   └── worker/main.js            # Worker entry point
└── docker-compose-node.yml       # Orchestration config
```
