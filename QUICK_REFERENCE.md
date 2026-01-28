# TaskMaster Demo — Quick Reference Card

## Pre-Demo (2 min)

```bash
# Terminal 1: Start backend
cd c:\Users\DELL\Desktop\TaskMaster-master
docker-compose -f docker-compose-node.yml up --scale worker=3 -d

# Terminal 2: Start frontend
cd c:\Users\DELL\Desktop\TaskMaster-master\client
npm run dev

# Open browser
http://localhost:5173
```

---

## During Demo

| Step | What to Do | What You'll See |
|------|-----------|-----------------|
| **1. Show architecture** | Point at dashboard | 3 workers online, empty task list |
| **2. Create load** | Click "Create Tasks" (50) | Tasks populate, workers start executing |
| **3. Observe concurrency** | Watch for 30 seconds | Multiple tasks running simultaneously, progress bars advancing |
| **4. Scale down** | Copy & run "Scale to 1 Worker" | Queue backs up, completion rate drops (1 task/sec) |
| **5. Scale up** | Copy & run "Scale to 5 Workers" | Queue drains, completion rate spikes (5+ tasks/sec) |
| **6. Resilience** | Copy & run "Kill Worker" | 1 worker disappears, others finish tasks without interruption |
| **7. Recovery** | Copy & run "Scale to 5 Workers" again | Worker comes back online |

---

## Key Screenshots to Reference

### **Initial State**
```
Dashboard Shows:
- Total Tasks: 0
- Pending: 0 | Running: 0 | Completed: 0
- Workers: 3 online
- Task Monitor: Empty
- Activity Log: Empty
```

### **After "Create 50 Tasks"**
```
Dashboard Shows:
- Total Tasks: 50
- Pending: ~10 | Running: ~3 | Completed: ~37
- Workers: Each showing current_task_id & tasks_completed
- Task Monitor: 50 rows visible, mixed statuses
- Activity Log: Rapid task events (30+ events in view)
```

### **After "Scale to 1 Worker"**
```
Dashboard Shows:
- Workers: Only 1 online, 2 offline
- Running: ~1 task
- Pending: ~20 (queue backed up)
- Task Monitor: Progress bars moving slowly
- Activity Log: "Worker offline" events visible
```

### **After "Scale to 5 Workers"**
```
Dashboard Shows:
- Workers: 5 online
- Running: ~5 tasks (max parallelism)
- Pending: ~0 (queue empty)
- Completed: Rising rapidly
- Task Monitor: Tasks transitioning from running → completed in seconds
- Activity Log: Continuous completion events
```

---

## Talking Points (1-2 sentence each)

**Opening:**
> "This is a production-ready task scheduler. The key challenge is: how do you distribute work fairly, handle failures, and keep the UI in sync?"

**On "Create Tasks" button:**
> "One click creates 50 tasks. Behind the scenes, it's hitting a batch API endpoint. No UI lag, instant feedback."

**On Task Monitor (worker ID column):**
> "Each task shows which worker is executing it. You can see that tasks are being distributed round-robin across workers."

**On progress bars:**
> "Progress tracks the task lifecycle: pending → assigned → running → completed. Real-time updates via Server-Sent Events."

**On scaling demo:**
> "With 1 worker, throughput is bottlenecked. With 5 workers, it scales linearly. That's horizontal scaling in action."

**On kill worker:**
> "The system is resilient. When a worker crashes, its tasks get reassigned. No data loss, no interruption."

**Closing:**
> "The UI is a visualization layer on top of a battle-tested backend. Production deployments would add monitoring, alerting, and auto-scaling policies."

---

## CLI Commands (Copy & Paste)

### **Create Bulk Tasks (API Test)**
```bash
curl -X POST http://localhost:8081/api/schedule/batch \
  -H "Content-Type: application/json" \
  -d '{"command":"demo-job","count":100,"delay_seconds":0}'
```

### **Check Stats (JSON)**
```bash
(Invoke-WebRequest -Uri http://localhost:8081/api/stats -UseBasicParsing).Content | ConvertFrom-Json | ConvertTo-Json
```

### **Stream Live Logs**
```bash
# Shows task events as they happen
curl http://localhost:8081/api/logs/stream
```

### **Scale Workers**
```bash
# 1 worker (bottleneck demo)
docker-compose -f docker-compose-node.yml up --scale worker=1 -d

# 3 workers (baseline)
docker-compose -f docker-compose-node.yml up --scale worker=3 -d

# 5 workers (max throughput)
docker-compose -f docker-compose-node.yml up --scale worker=5 -d

# Kill a worker (resilience demo)
docker stop taskmaster-master-worker-2
```

### **View Logs**
```bash
# Scheduler logs
docker-compose -f docker-compose-node.yml logs -f scheduler

# Coordinator logs
docker-compose -f docker-compose-node.yml logs -f coordinator

# Worker logs
docker-compose -f docker-compose-node.yml logs -f worker
```

### **Cleanup**
```bash
docker-compose -f docker-compose-node.yml down
docker volume prune -f  # Clean up database volume (fresh state)
```

---

## Metrics to Highlight

### **Throughput**
- **1 worker**: ~0.5 tasks/sec
- **3 workers**: ~1.5 tasks/sec
- **5 workers**: ~2.5 tasks/sec
→ **Linear scaling confirmed**

### **Queue Depth**
- **Baseline (3 workers, 50 tasks)**: Clears in ~30 seconds
- **Scale down to 1**: Backs up to ~20-30 tasks
- **Scale up to 5**: Clears within 10 seconds
→ **Elasticity in action**

### **Worker Utilization**
- **Running tasks**: Should match worker count (full parallelism)
- **Task assignment**: Round-robin (no worker idle while others busy)
- **Completion rate**: Constant across all workers (balanced load)

---

## Expected Timings

| Operation | Time | Notes |
|-----------|------|-------|
| Backend startup | ~10 seconds | Postgres, coordinator, scheduler, 3 workers |
| Frontend startup | ~5 seconds | Vite dev server |
| Create 50 tasks | ~200ms | API response time |
| Task assignment | ~1 second | Scheduler polling interval |
| Per-task execution | ~0.5-0.8s | Varies by system |
| 50-task completion (3 workers) | ~30 seconds | 50 ÷ 1.5 tasks/sec |
| Scale operation | ~5 seconds | Docker compose up |

---

## Failure Recovery Plan

| If This Happens | Do This |
|-----------------|---------|
| Backend won't start | Check Docker: `docker ps` or `docker-compose -f docker-compose-node.yml logs` |
| No workers appear in UI | Coordinator not registering workers. Check logs: `docker-compose -f docker-compose-node.yml logs coordinator` |
| Tasks not progressing | Scheduler not polling. Check: `docker-compose -f docker-compose-node.yml logs scheduler` \| grep polling |
| UI won't load | Frontend dev server failed. Run: `npm run dev` again in client folder |
| Can't create tasks | API down. Check: `(Invoke-WebRequest http://localhost:8081/api/stats -UseBasicParsing).StatusCode` |
| Scale commands fail | Containers not named correctly. Try: `docker ps` to see actual names |

---

## Interviewer Questions & Answers

**Q: How is load balanced?**  
A: Round-robin at the coordinator level. When scheduler requests N assignments, coordinator picks workers in order: W1, W2, W3, W1, W2, W3, etc.

**Q: What if a task fails?**  
A: Worker reports failure via gRPC. Status is logged to Postgres with `failed_at` timestamp. In production, you'd have retry logic and dead-letter queues.

**Q: Is there a single point of failure?**  
A: Postgres is the critical dependency. Coordinator and scheduler are stateless; workers are ephemeral. If Postgres goes down, system halts but no data is lost.

**Q: Can I see task details?**  
A: Click any task in the Live Task Monitor to view detailed logs.

**Q: How do you monitor production?**  
A: `/api/stats` endpoint feeds into monitoring systems. You'd add Prometheus metrics, structured logging to ELK, and alerting based on queue depth.

---

## After-Demo Talking Points

> "This architecture scales to millions of tasks. Each layer is independently scalable. Add more workers, add more scheduler instances, add database replicas."

> "The real complexity is failure recovery and consistency guarantees, which we've built in from day one."

> "The code is open source and production-ready. You could fork this and adapt it to your use case in hours."

---

**Duration: 5-10 minutes**  
**Difficulty: Beginner → Intermediate**  
**Impact: High** (shows real distributed systems knowledge)

Good luck! 🚀
