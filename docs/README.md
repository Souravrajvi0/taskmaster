# Backend Documentation - Interview Preparation

> **Purpose**: Comprehensive visual documentation for explaining the TaskMaster distributed task scheduler backend in technical interviews

---

## 📚 Documentation Overview

This folder contains detailed Mermaid diagrams and interview preparation materials for explaining the backend architecture of TaskMaster.

### Files in This Folder

| File | Purpose | Best For |
|------|---------|----------|
| **[backend-architecture.md](./backend-architecture.md)** | Complete system architecture with 7 detailed diagrams | System design interviews, architecture discussions |
| **[data-flow-diagrams.md](./data-flow-diagrams.md)** | Step-by-step data flow diagrams for all major operations | Technical deep dives, explaining request flows |
| **[interview-quick-reference.md](./interview-quick-reference.md)** | Concise talking points and metrics | Quick review before interviews, elevator pitches |
| **[diagram-prompt-generator.md](./diagram-prompt-generator.md)** | Prompt template for generating custom diagrams | Creating new diagrams for specific questions |

---

## 🎯 How to Use These Docs for Interviews

### Before the Interview (30 minutes)

1. **Review Quick Reference** (10 min)
   - Read [interview-quick-reference.md](./interview-quick-reference.md)
   - Memorize key metrics (5s heartbeat, 10s polling, 30s lookahead)
   - Practice 30-second elevator pitch

2. **Study Architecture Diagrams** (15 min)
   - Review [backend-architecture.md](./backend-architecture.md)
   - Focus on: System Overview, Request Flow, Component Deep Dive
   - Be able to draw high-level architecture from memory

3. **Prepare Demo** (5 min)
   - Have project running locally
   - Test: Create tasks → Scale workers → Kill worker
   - Ensure logs are visible

### During the Interview

#### For "Walk me through your project" (2-3 minutes)

1. **Start with elevator pitch** (30 sec)
   - "TaskMaster is a distributed task scheduler..."
   - Mention: Node.js, gRPC, PostgreSQL, Docker

2. **Show architecture diagram** (1 min)
   - Open [backend-architecture.md](./backend-architecture.md) → Section 1
   - Explain 4 layers: Client → API Gateway → Orchestration → Workers

3. **Explain request flow** (1 min)
   - Open [backend-architecture.md](./backend-architecture.md) → Section 2
   - Walk through: Task Creation → Assignment → Execution → Updates

4. **Highlight key features** (30 sec)
   - Horizontal scaling, fault tolerance, real-time monitoring

#### For Technical Deep Dives

**"How do you handle concurrency?"**
- Show [data-flow-diagrams.md](./data-flow-diagrams.md) → Section 2 (Task Assignment Flow)
- Explain `FOR UPDATE SKIP LOCKED`

**"How do you detect worker failures?"**
- Show [data-flow-diagrams.md](./data-flow-diagrams.md) → Section 4 (Worker Heartbeat)
- Explain 3 missed heartbeats = 15s timeout

**"How do you scale workers?"**
- Show [data-flow-diagrams.md](./data-flow-diagrams.md) → Section 6 (Worker Scaling)
- Explain Docker Compose `--scale worker=N`

**"What are the bottlenecks?"**
- Refer to [interview-quick-reference.md](./interview-quick-reference.md) → Scalability section
- Mention: Database (single instance), Coordinator (SPOF), Polling latency

#### For System Design Questions

**"How would you improve this for production?"**
- Refer to [interview-quick-reference.md](./interview-quick-reference.md) → Production Readiness Gaps
- Mention: Redis pub/sub, Kubernetes, observability, task retries

**"Why did you choose X over Y?"**
- Refer to [interview-quick-reference.md](./interview-quick-reference.md) → Key Technical Decisions
- Explain trade-offs for gRPC vs HTTP, PostgreSQL vs Redis, polling vs pub/sub

---

## 📊 Diagram Quick Access

### System Architecture Diagrams

1. **High-Level Architecture**
   - File: [backend-architecture.md](./backend-architecture.md) → Section 1
   - Shows: All components, ports, protocols, data flow

2. **Request Flow (Task Creation to Completion)**
   - File: [backend-architecture.md](./backend-architecture.md) → Section 2
   - Shows: Sequence diagram with 4 phases

3. **Component Internals**
   - File: [backend-architecture.md](./backend-architecture.md) → Section 3
   - Shows: Scheduler, Coordinator, Worker internal architecture

4. **Database Schema & Task Lifecycle**
   - File: [backend-architecture.md](./backend-architecture.md) → Section 4
   - Shows: ER diagram, state machine

5. **gRPC Communication**
   - File: [backend-architecture.md](./backend-architecture.md) → Section 5
   - Shows: All RPC calls and Protocol Buffer definitions

### Data Flow Diagrams

1. **Task Creation Flow**
   - File: [data-flow-diagrams.md](./data-flow-diagrams.md) → Section 1
   - Shows: Bulk task creation with validation

2. **Task Assignment Flow**
   - File: [data-flow-diagrams.md](./data-flow-diagrams.md) → Section 2
   - Shows: Database polling with `FOR UPDATE SKIP LOCKED`

3. **Worker Execution Flow**
   - File: [data-flow-diagrams.md](./data-flow-diagrams.md) → Section 3
   - Shows: Internal worker pool processing

4. **Heartbeat & Registration**
   - File: [data-flow-diagrams.md](./data-flow-diagrams.md) → Section 4
   - Shows: Worker registration and failure detection

5. **Real-Time UI Updates (SSE)**
   - File: [data-flow-diagrams.md](./data-flow-diagrams.md) → Section 5
   - Shows: State transition detection and broadcasting

6. **Worker Scaling**
   - File: [data-flow-diagrams.md](./data-flow-diagrams.md) → Section 6
   - Shows: Docker Compose scaling flow

7. **Error Handling**
   - File: [data-flow-diagrams.md](./data-flow-diagrams.md) → Section 7
   - Shows: Failure scenarios and recovery

---

## 🔑 Key Metrics to Memorize

| Metric | Value | Context |
|--------|-------|---------|
| Heartbeat Interval | 5 seconds | Worker → Coordinator |
| Heartbeat Timeout | 15 seconds | 3 missed heartbeats |
| Task Polling | 10 seconds | Coordinator → Database |
| Lookahead Window | 30 seconds | Task batching |
| Worker Pool Size | 5 concurrent | Per Worker instance |
| Task Processing | 5 seconds | Simulated work |
| SSE Polling | 1 second | UI updates |
| Max Workers | 50+ | Horizontal scaling limit |
| Throughput | 500+ tasks/sec | With 100 workers |

---

## 🎨 Viewing Mermaid Diagrams

### Option 1: GitHub (Recommended)
- Push docs to GitHub
- GitHub automatically renders Mermaid diagrams

### Option 2: VS Code
- Install extension: "Markdown Preview Mermaid Support"
- Open any `.md` file
- Press `Ctrl+Shift+V` (Windows) or `Cmd+Shift+V` (Mac)

### Option 3: Mermaid Live Editor
- Go to https://mermaid.live/
- Copy/paste Mermaid code blocks
- Export as PNG/SVG for presentations

### Option 4: Obsidian
- Open docs folder in Obsidian
- Mermaid diagrams render automatically

---

## 🚀 Demo Preparation Checklist

Before your interview, ensure you can:

- [ ] Explain the 30-second elevator pitch without notes
- [ ] Draw the high-level architecture on a whiteboard
- [ ] Run the full stack locally (Docker Compose)
- [ ] Create 10 tasks and show real-time logs
- [ ] Scale workers from 3 to 5 via UI
- [ ] Kill a worker and explain failure detection
- [ ] Explain round-robin algorithm in code
- [ ] Explain `FOR UPDATE SKIP LOCKED` query
- [ ] Discuss 3 production improvements
- [ ] Answer "Why gRPC?" and "Why PostgreSQL?"

---

## 📝 Interview Question Categories

### Architecture & Design (60% of questions)
- System architecture overview
- Component responsibilities
- Communication protocols
- Technology choices and trade-offs

**Preparation**: Study [backend-architecture.md](./backend-architecture.md) sections 1-3

### Concurrency & Scalability (20% of questions)
- Race condition prevention
- Horizontal scaling
- Load balancing
- Performance bottlenecks

**Preparation**: Study [data-flow-diagrams.md](./data-flow-diagrams.md) sections 2, 6, 8

### Fault Tolerance (15% of questions)
- Worker failure detection
- Task recovery
- Error handling
- Retry mechanisms

**Preparation**: Study [data-flow-diagrams.md](./data-flow-diagrams.md) sections 4, 7

### Production Readiness (5% of questions)
- Monitoring and observability
- Security
- Deployment
- Data management

**Preparation**: Study [interview-quick-reference.md](./interview-quick-reference.md) → Production Readiness Gaps

---

## 🎓 Learning Resources

### Distributed Systems Concepts
- **Round-Robin Load Balancing**: [backend-architecture.md](./backend-architecture.md) → Section 3.2
- **Heartbeat-Based Health Checks**: [data-flow-diagrams.md](./data-flow-diagrams.md) → Section 4
- **Database Concurrency**: [data-flow-diagrams.md](./data-flow-diagrams.md) → Section 8
- **Worker Pool Pattern**: [backend-architecture.md](./backend-architecture.md) → Section 3.3

### gRPC & Protocol Buffers
- **Service Definitions**: [backend-architecture.md](./backend-architecture.md) → Section 5
- **Communication Patterns**: [data-flow-diagrams.md](./data-flow-diagrams.md) → Sections 2, 3, 4

### PostgreSQL Patterns
- **FOR UPDATE SKIP LOCKED**: [data-flow-diagrams.md](./data-flow-diagrams.md) → Section 2
- **Transaction Patterns**: [data-flow-diagrams.md](./data-flow-diagrams.md) → Section 8
- **Index Strategy**: [backend-architecture.md](./backend-architecture.md) → Section 4

---

## 🔄 Generating Custom Diagrams

If you need a diagram for a specific interview question:

1. Open [diagram-prompt-generator.md](./diagram-prompt-generator.md)
2. Copy the universal prompt template
3. Replace `[SPECIFIC_ASPECT]` with your topic
4. Paste into ChatGPT/Claude
5. Get a custom Mermaid diagram

**Example Topics**:
- "How the system handles 1000 concurrent tasks"
- "What happens when the Coordinator crashes"
- "The race condition prevention using FOR UPDATE SKIP LOCKED"
- "Comparison with RabbitMQ/Kafka architecture"

---

## 📞 Interview Tips

### Do's ✅
- Start with high-level architecture, then drill down
- Use diagrams to explain complex flows
- Mention specific metrics (5s, 10s, 30s)
- Discuss trade-offs for every decision
- Acknowledge production gaps and improvements

### Don'ts ❌
- Don't dive into code without explaining architecture first
- Don't claim it's production-ready (it's a demo project)
- Don't ignore edge cases (worker failures, database crashes)
- Don't forget to mention scalability limits
- Don't skip explaining "why" for technology choices

### If You Don't Know Something
- "I haven't implemented that yet, but here's how I would approach it..."
- "That's a great question. Let me think through the trade-offs..."
- "In this demo I chose X for simplicity, but for production I'd use Y because..."

---

## 🎯 Success Criteria

You're ready for the interview if you can:

1. **Explain the architecture** in 2 minutes without notes
2. **Draw the system** on a whiteboard from memory
3. **Answer "why X over Y?"** for all technology choices
4. **Discuss 3 production improvements** with specific details
5. **Demo the system** and explain what's happening in logs
6. **Handle edge cases** (worker crash, database failure, race conditions)

---

## 📂 Project Structure Reference

```
taskmaster-master/
├── docs/                              # ← YOU ARE HERE
│   ├── README.md                      # This file
│   ├── backend-architecture.md        # System architecture diagrams
│   ├── data-flow-diagrams.md          # Detailed data flow diagrams
│   ├── interview-quick-reference.md   # Talking points and metrics
│   └── diagram-prompt-generator.md    # Prompt template for custom diagrams
├── pkg/
│   ├── scheduler/scheduler.js         # HTTP API + SSE
│   ├── coordinator/coordinator.js     # gRPC orchestration
│   ├── worker/worker.js               # Task execution
│   ├── common/common.js               # Shared utilities
│   ├── grpcapi/api.proto              # gRPC contracts
│   └── db/setup.sql                   # Database schema
├── cmd/
│   ├── scheduler/main.js              # Scheduler entry point
│   ├── coordinator/main.js            # Coordinator entry point
│   └── worker/main.js                 # Worker entry point
├── client/                            # React frontend
└── docker-compose-node.yml            # Orchestration config
```

---

## 🌟 Final Checklist

Before your interview:

- [ ] Read all 4 documentation files
- [ ] Memorize key metrics table
- [ ] Practice elevator pitch 3 times
- [ ] Run demo locally and verify it works
- [ ] Prepare answers to "Why X over Y?" questions
- [ ] Review production improvement ideas
- [ ] Be ready to draw architecture on whiteboard
- [ ] Have GitHub repo link ready to share

**Good luck with your interviews! 🚀**

---

## 📧 Questions or Improvements?

If you think of additional diagrams or talking points that would be helpful, use the [diagram-prompt-generator.md](./diagram-prompt-generator.md) to create them!
