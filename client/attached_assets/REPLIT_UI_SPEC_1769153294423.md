# TaskMaster UI Development Specification

## Project Overview

TaskMaster is a **distributed task scheduler backend** built in Node.js. Your job is to create a **web-based UI** that allows users to schedule tasks, view their status, and monitor the system in real-time.

### What the Backend Does

The backend consists of 4 services running in Docker:
1. **Scheduler** (HTTP REST API on port 8081) - Accepts task submissions and provides status queries
2. **Coordinator** (gRPC on port 8080) - Manages workers and distributes tasks
3. **Workers** (gRPC, scalable) - Execute tasks (currently simulated as 5-second delays)
4. **PostgreSQL** (port 5432) - Stores task metadata and lifecycle timestamps

### Task Lifecycle

```
User submits task → Scheduler saves to DB → Coordinator polls DB every 10s → 
Coordinator assigns to Worker (round-robin) → Worker executes (5s simulation) → 
Worker reports completion → User can query status
```

---

## Backend API Reference

### Base URL
```
http://localhost:8081
```

### Endpoints

#### 1. Schedule a Task

**POST** `/schedule`

**Request Body:**
```json
{
  "command": "string (required) - Task command/description",
  "scheduled_at": "string (required) - ISO 8601 timestamp (e.g., '2026-01-23T15:00:00Z')"
}
```

**Example Request:**
```json
{
  "command": "process-user-report",
  "scheduled_at": "2026-01-23T15:30:00+00:00"
}
```

**Success Response (200 OK):**
```json
{
  "command": "process-user-report",
  "scheduled_at": 1737645000,
  "task_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479"
}
```

**Error Responses:**

- **400 Bad Request** - Missing fields:
```json
{
  "error": "command and scheduled_at are required"
}
```

- **400 Bad Request** - Invalid date format:
```json
{
  "error": "Invalid date format. Use ISO 8601 format."
}
```

- **500 Internal Server Error** - Database/server error:
```json
{
  "error": "Failed to submit task. Error: <details>"
}
```

---

#### 2. Get Task Status

**GET** `/status?task_id=<uuid>`

**Query Parameters:**
- `task_id` (required): UUID of the task

**Example Request:**
```
GET /status?task_id=f47ac10b-58cc-4372-a567-0e02b2c3d479
```

**Success Response (200 OK):**
```json
{
  "task_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "command": "process-user-report",
  "scheduled_at": "2026-01-23 15:30:00",
  "picked_at": "2026-01-23 15:30:02",
  "started_at": "2026-01-23 15:30:03",
  "completed_at": "2026-01-23 15:30:08",
  "failed_at": ""
}
```

**Field Descriptions:**
- `task_id`: UUID identifier
- `command`: Task description
- `scheduled_at`: When task should execute
- `picked_at`: When coordinator assigned it to a worker (empty string if not picked)
- `started_at`: When worker began execution (empty string if not started)
- `completed_at`: When task finished successfully (empty string if not completed)
- `failed_at`: When task failed (empty string if not failed)

**Error Responses:**

- **400 Bad Request** - Missing task_id:
```json
{
  "error": "Task ID is required"
}
```

- **404 Not Found** - Task doesn't exist:
```json
{
  "error": "Task not found"
}
```

---

## Task States

A task goes through these states in order:

1. **Scheduled** - `scheduled_at` set, `picked_at` is empty
2. **Assigned** - `picked_at` set, `started_at` is empty (coordinator assigned to worker)
3. **Running** - `started_at` set, `completed_at` and `failed_at` are empty
4. **Completed** - `completed_at` set (success)
5. **Failed** - `failed_at` set (error - not currently used in simulation)

### How to Display Status

```javascript
function getTaskStatus(task) {
  if (task.completed_at) return 'Completed';
  if (task.failed_at) return 'Failed';
  if (task.started_at) return 'Running';
  if (task.picked_at) return 'Assigned';
  return 'Scheduled';
}
```

---

## UI Requirements

### Pages/Views to Build

#### 1. **Task Submission Form**

**Features:**
- Input field for task command (text)
- Date/time picker for scheduled execution time
- Submit button
- Display submitted task ID and link to status page
- Form validation (required fields)
- Error handling display

**User Flow:**
1. User enters task command (e.g., "Generate monthly report")
2. User picks a date/time (future or immediate)
3. Click "Schedule Task"
4. Show success message with task ID
5. Provide link to view task status

**Example UI Structure:**
```
┌─────────────────────────────────────┐
│ Schedule New Task                    │
├─────────────────────────────────────┤
│ Task Command:                        │
│ [________________________]          │
│                                      │
│ Scheduled Time:                      │
│ [Date Picker] [Time Picker]         │
│                                      │
│        [Schedule Task Button]        │
│                                      │
│ ✓ Task scheduled successfully!       │
│   Task ID: f47ac10b-58cc...          │
│   [View Status]                      │
└─────────────────────────────────────┘
```

---

#### 2. **Task Status View**

**Features:**
- Search by task ID
- Display all task details
- Status badge (color-coded)
- Timeline showing task lifecycle
- Auto-refresh option (poll every 3-5 seconds)
- Button to go back to submission form

**Status Badge Colors:**
- Scheduled: Blue
- Assigned: Yellow
- Running: Orange
- Completed: Green
- Failed: Red

**Example UI Structure:**
```
┌─────────────────────────────────────┐
│ Task Status                          │
├─────────────────────────────────────┤
│ Task ID: f47ac10b-58cc-4372-a567... │
│                                      │
│ Command: process-user-report         │
│ Status: ●Completed                   │
│                                      │
│ Timeline:                            │
│ ✓ Scheduled   2026-01-23 15:30:00   │
│ ✓ Assigned    2026-01-23 15:30:02   │
│ ✓ Started     2026-01-23 15:30:03   │
│ ✓ Completed   2026-01-23 15:30:08   │
│                                      │
│ Duration: 8 seconds                  │
│                                      │
│ [Refresh] [Back to Schedule]         │
└─────────────────────────────────────┘
```

---

#### 3. **Task List / Dashboard (Optional Advanced Feature)**

**Features:**
- List of all tasks (requires polling or building a cache)
- Filter by status (All, Scheduled, Running, Completed)
- Search by command text
- Click to view details
- Pagination (if many tasks)

**Note:** The backend doesn't have a "list all tasks" endpoint, so you'll need to either:
- Keep a client-side cache of submitted tasks
- Direct database connection (not recommended for UI)
- Add a new backend endpoint (requires backend modification)

**For MVP:** Focus on single-task submission and status lookup.

---

## Technical Implementation Guide

### Frontend Tech Stack Recommendations

- **React** or **Vue** or **Vanilla JS** - Your choice
- **Axios** or **Fetch** - For HTTP requests
- **Date-fns** or **Moment.js** - For date formatting
- **TailwindCSS** or **Material-UI** - For styling

### Key Implementation Details

#### 1. Date/Time Handling

The backend expects ISO 8601 format:
```javascript
// Convert user input to ISO 8601
const scheduledTime = new Date(userDate).toISOString();
// Example: "2026-01-23T15:30:00.000Z"
```

#### 2. API Calls with Axios

**Schedule Task:**
```javascript
async function scheduleTask(command, scheduledAt) {
  try {
    const response = await axios.post('http://localhost:8081/schedule', {
      command: command,
      scheduled_at: scheduledAt
    });
    return response.data; // { command, scheduled_at, task_id }
  } catch (error) {
    console.error('Failed to schedule task:', error.response?.data);
    throw error;
  }
}
```

**Get Task Status:**
```javascript
async function getTaskStatus(taskId) {
  try {
    const response = await axios.get(`http://localhost:8081/status?task_id=${taskId}`);
    return response.data;
  } catch (error) {
    if (error.response?.status === 404) {
      throw new Error('Task not found');
    }
    throw error;
  }
}
```

#### 3. Auto-Refresh for Status Updates

```javascript
// Poll every 3 seconds
const intervalId = setInterval(async () => {
  const status = await getTaskStatus(taskId);
  updateUI(status);
  
  // Stop polling if task is complete or failed
  if (status.completed_at || status.failed_at) {
    clearInterval(intervalId);
  }
}, 3000);
```

#### 4. Status Badge Component (React Example)

```jsx
function StatusBadge({ task }) {
  const getStatus = () => {
    if (task.completed_at) return { text: 'Completed', color: 'green' };
    if (task.failed_at) return { text: 'Failed', color: 'red' };
    if (task.started_at) return { text: 'Running', color: 'orange' };
    if (task.picked_at) return { text: 'Assigned', color: 'yellow' };
    return { text: 'Scheduled', color: 'blue' };
  };
  
  const status = getStatus();
  
  return (
    <span className={`badge badge-${status.color}`}>
      {status.text}
    </span>
  );
}
```

---

## Example User Flows

### Flow 1: Schedule and Monitor Task

1. User opens the app
2. Enters command: "Generate Q4 report"
3. Selects time: 5 seconds from now
4. Clicks "Schedule Task"
5. App shows: "Task scheduled! ID: abc-123-def"
6. User clicks "View Status"
7. App polls status every 3 seconds
8. Status changes: Scheduled → Assigned → Running → Completed
9. Timeline shows all timestamps
10. Polling stops when completed

### Flow 2: Check Existing Task

1. User has a task ID from email/notification
2. Opens app and clicks "Check Status"
3. Enters task ID
4. Clicks "Search"
5. App displays current task status
6. If not complete, starts auto-refresh
7. User can manually refresh or leave page

---

## CORS Configuration

**Important:** The backend currently doesn't have CORS enabled. You may need to:

### Option 1: Run UI on same origin
- Build UI to serve from the same server as the backend
- No CORS issues

### Option 2: Enable CORS in backend (requires backend change)
You would need to add this to `pkg/scheduler/scheduler.js`:

```javascript
import cors from 'cors';
app.use(cors()); // Allow all origins (development only)
```

### Option 3: Use a proxy
Configure your dev server to proxy requests:

**Vite config:**
```javascript
export default {
  server: {
    proxy: {
      '/schedule': 'http://localhost:8081',
      '/status': 'http://localhost:8081'
    }
  }
}
```

---

## Database Schema (For Reference)

You **don't need** to connect directly to the database. Use the REST API only.

```sql
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    command TEXT NOT NULL,
    scheduled_at TIMESTAMP NOT NULL,
    picked_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    failed_at TIMESTAMP
);
```

---

## Testing Your UI

### Starting the Backend

```bash
# From TaskMaster-master directory
docker-compose -f docker-compose-node.yml up --build --scale worker=3
```

Wait for:
```
scheduler_1    | Starting scheduler server on :8081
coordinator_1  | Starting gRPC server on :8080
worker_1       | Starting worker server on port 12345
```

### Manual API Testing

**Schedule a task (curl):**
```bash
curl -X POST http://localhost:8081/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "command": "test-task",
    "scheduled_at": "2026-01-23T15:00:00Z"
  }'
```

**Check status:**
```bash
curl "http://localhost:8081/status?task_id=YOUR_TASK_ID_HERE"
```

### Expected Behavior

- Tasks scheduled for the past or within 30 seconds: Picked up immediately
- Tasks scheduled >30 seconds ahead: Picked up when within 30s window
- Task execution: Takes ~5 seconds (simulated)
- Database persistence: Survives container restarts

---

## UI Design Guidelines

### Color Scheme Suggestion

- **Primary:** Blue (#3B82F6) - Action buttons, links
- **Success:** Green (#10B981) - Completed tasks
- **Warning:** Orange (#F59E0B) - Running tasks
- **Info:** Yellow (#EAB308) - Assigned tasks
- **Error:** Red (#EF4444) - Failed tasks
- **Neutral:** Gray (#6B7280) - Text, borders

### Typography

- **Headings:** Bold, larger font
- **Task ID:** Monospace font (for UUIDs)
- **Timestamps:** Smaller, gray text
- **Status badges:** Bold, uppercase, padded

### Responsiveness

- Mobile-first design
- Stack form fields vertically on small screens
- Make task ID copyable on mobile
- Use bottom navigation for mobile

---

## Advanced Features (Optional)

### 1. Task History

Store submitted tasks in localStorage:
```javascript
const tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
tasks.push({ id: taskId, command, scheduledAt: new Date() });
localStorage.setItem('tasks', JSON.stringify(tasks));
```

### 2. Bulk Task Submission

Allow users to upload CSV/JSON with multiple tasks:
```csv
command,scheduled_at
"Task 1","2026-01-23T15:00:00Z"
"Task 2","2026-01-23T16:00:00Z"
```

### 3. Real-Time Updates with WebSocket

Currently not supported by backend. Would require backend modification.

### 4. System Statistics

Query multiple tasks and show:
- Total tasks scheduled
- Tasks completed today
- Average execution time
- Success rate

**Note:** Requires building client-side aggregation or adding backend endpoint.

### 5. Dark Mode

Implement theme toggle with localStorage persistence.

---

## Error Handling

### Common Errors and UI Response

| Error | Cause | UI Action |
|-------|-------|-----------|
| Network error | Backend not running | Show "Backend unavailable. Please start the server." |
| 400 Bad Request | Invalid input | Show validation error below field |
| 404 Not Found | Task ID doesn't exist | Show "Task not found. Check the ID." |
| 500 Server Error | Backend bug/DB issue | Show "Server error. Please try again later." |

### Validation Rules

- **Command:** Required, min 1 char, max 255 chars
- **Scheduled Time:** Required, must be valid date, can be past or future

---

## Deployment Considerations

### Development
- Run backend with Docker Compose
- Run UI with `npm run dev` (Vite) or `npm start` (Create React App)
- Use proxy or CORS for API calls

### Production
- Build UI with `npm run build`
- Serve static files from backend or separate server
- Ensure CORS is properly configured
- Use environment variables for API URLs

---

## Example Complete React App Structure

```
src/
├── App.jsx                 # Main component
├── components/
│   ├── TaskForm.jsx       # Task submission form
│   ├── TaskStatus.jsx     # Task status display
│   ├── StatusBadge.jsx    # Status indicator
│   └── Timeline.jsx       # Task lifecycle timeline
├── services/
│   └── api.js             # Axios API calls
├── utils/
│   ├── dateFormat.js      # Date formatting helpers
│   └── taskStatus.js      # Status logic
└── styles/
    └── main.css           # Global styles
```

---

## Quick Start Code Snippets

### Minimal HTML + Vanilla JS UI

```html
<!DOCTYPE html>
<html>
<head>
  <title>TaskMaster UI</title>
  <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
</head>
<body>
  <h1>Schedule Task</h1>
  <input id="command" placeholder="Task command" />
  <input id="datetime" type="datetime-local" />
  <button onclick="scheduleTask()">Schedule</button>
  <div id="result"></div>

  <script>
    async function scheduleTask() {
      const command = document.getElementById('command').value;
      const datetime = document.getElementById('datetime').value;
      
      try {
        const response = await axios.post('http://localhost:8081/schedule', {
          command: command,
          scheduled_at: new Date(datetime).toISOString()
        });
        
        document.getElementById('result').innerHTML = 
          `Task scheduled! ID: ${response.data.task_id}`;
      } catch (error) {
        alert('Error: ' + error.response.data.error);
      }
    }
  </script>
</body>
</html>
```

---

## Summary for Replit AI

**Your task is to create a web UI for TaskMaster with:**

1. **Task Submission Form** - Let users schedule tasks with command + timestamp
2. **Task Status View** - Show task progress with auto-refresh
3. **Status Timeline** - Visual representation of task lifecycle
4. **Error Handling** - User-friendly error messages
5. **Responsive Design** - Works on desktop and mobile

**API endpoints to use:**
- `POST http://localhost:8081/schedule` - Schedule tasks
- `GET http://localhost:8081/status?task_id=X` - Get task status

**Task states:** Scheduled → Assigned → Running → Completed/Failed

**Make it look professional with:**
- Color-coded status badges
- Clear form validation
- Loading states during API calls
- Success/error notifications
- Clean, modern design

Good luck! 🚀
