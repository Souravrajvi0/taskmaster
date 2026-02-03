
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, WorkerStatusBadge, getTaskStatus } from "@/components/status-badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { 
  Clock, 
  CheckCircle2, 
  Loader2, 
  AlertCircle, 
  Plus, 
  Server,
  Activity,
  ListTodo,
  Zap
} from "lucide-react";
import { format } from "date-fns";
import { ActivityLog } from "@/components/activity-log";
import { BulkTaskPanel } from "@/components/bulk-task-panel";
import { WorkerControlPanel } from "@/components/worker-control-panel";
import { EnhancedTaskTable } from "@/components/enhanced-task-table";

interface SystemStats {
  total_tasks: number;
  pending_tasks: number;
  running_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  workers: Worker[];
}

interface Worker {
  id: number;
  name: string;
  status: string;
  current_task_id: string | null;
  tasks_completed: number;
  last_active_at: string | null;
}

interface TaskItem {
  task_id: string;
  command: string;
  scheduled_at: string;
  picked_at: string;
  started_at: string;
  completed_at: string;
  failed_at: string;
  worker_id: number | null;
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<SystemStats>({
    queryKey: ["/api/stats"],
    refetchInterval: 3000,
  });

  const { data: tasks, isLoading: tasksLoading } = useQuery<TaskItem[]>({
    queryKey: ["/api/tasks"],
    refetchInterval: 3000,
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">TaskMaster</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/schedule">
              <Button data-testid="button-schedule-new">
                <Plus className="h-4 w-4 mr-2" />
                Schedule Task
              </Button>
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Demo Control Panel */}
        <div className="grid lg:grid-cols-2 gap-4 bg-muted/30 p-4 rounded-lg border">
          <BulkTaskPanel />
          <WorkerControlPanel />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatsCard
            title="Total Tasks"
            value={stats?.total_tasks ?? 0}
            icon={<ListTodo className="h-5 w-5" />}
            loading={statsLoading}
          />
          <StatsCard
            title="Pending"
            value={stats?.pending_tasks ?? 0}
            icon={<Clock className="h-5 w-5 text-blue-500" />}
            loading={statsLoading}
          />
          <StatsCard
            title="Running"
            value={stats?.running_tasks ?? 0}
            icon={<Loader2 className="h-5 w-5 text-orange-500 animate-spin" />}
            loading={statsLoading}
          />
          <StatsCard
            title="Completed"
            value={stats?.completed_tasks ?? 0}
            icon={<CheckCircle2 className="h-5 w-5 text-green-500" />}
            loading={statsLoading}
          />
        </div>

        {/* Live Task Table with Worker Assignment & Timing */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-5 w-5" />
              Live Task Monitor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EnhancedTaskTable tasks={tasks ?? []} />
          </CardContent>
        </Card>

        {/* Activity Log and Workers */}
        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Server className="h-5 w-5" />
                Workers ({stats?.workers?.length ?? 0})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {statsLoading ? (
                <>
                  <WorkerSkeleton />
                  <WorkerSkeleton />
                  <WorkerSkeleton />
                </>
              ) : stats?.workers?.length ? (
                stats.workers.map((worker) => (
                  <WorkerCard key={worker.id} worker={worker} />
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No workers available</p>
              )}
            </CardContent>
          </Card>

          {/* Activity Log Panel (real-time) */}
          <div className="lg:col-span-2">
            <ActivityLog />
          </div>
        </div>

        {/* Legacy Task Queue - Hidden but kept for reference */}
        <div className="grid lg:grid-cols-3 gap-6 hidden">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-5 w-5" />
                Task Queue
              </CardTitle>
            </CardHeader>
            <CardContent>
              {tasksLoading ? (
                <div className="space-y-2">
                  <TaskSkeleton />
                  <TaskSkeleton />
                  <TaskSkeleton />
                </div>
              ) : tasks?.length ? (
                <div className="space-y-2">
                  {tasks.map((task) => (
                    <TaskRow key={task.task_id} task={task} workers={stats?.workers ?? []} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <ListTodo className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">No tasks scheduled yet</p>
                  <Link href="/schedule">
                    <Button variant="outline" className="mt-4" data-testid="button-schedule-first">
                      Schedule your first task
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

function StatsCard({ 
  title, 
  value, 
  icon, 
  loading 
}: { 
  title: string; 
  value: number; 
  icon: React.ReactNode; 
  loading: boolean;
}) {
  return (
    <Card data-testid={`card-stat-${title.toLowerCase().replace(' ', '-')}`}>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            {loading ? (
              <Skeleton className="h-8 w-12 mt-1" />
            ) : (
              <p className="text-2xl font-bold">{value}</p>
            )}
          </div>
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

function WorkerCard({ worker }: { worker: Worker }) {
  return (
    <div 
      className="p-3 rounded-md bg-muted/50 border"
      data-testid={`card-worker-${worker.id}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-sm">{worker.name}</span>
        <WorkerStatusBadge status={worker.status} />
      </div>
      <div className="text-xs text-muted-foreground space-y-1">
        <div className="flex justify-between">
          <span>Tasks Completed:</span>
          <span className="font-medium text-foreground">{worker.tasks_completed}</span>
        </div>
        {worker.current_task_id && (
          <div className="flex justify-between">
            <span>Current Task:</span>
            <Link href={`/task/${worker.current_task_id}`}>
              <span className="font-mono text-primary hover:underline">
                {worker.current_task_id.substring(0, 8)}...
              </span>
            </Link>
          </div>
        )}
        {worker.last_active_at && (
          <div className="flex justify-between">
            <span>Last Active:</span>
            <span>{format(new Date(worker.last_active_at), "HH:mm:ss")}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function WorkerSkeleton() {
  return (
    <div className="p-3 rounded-md bg-muted/50 border">
      <div className="flex items-center justify-between mb-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-5 w-12" />
      </div>
      <div className="space-y-1">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </div>
    </div>
  );
}

function TaskRow({ task, workers }: { task: TaskItem; workers: Worker[] }) {
  const status = getTaskStatus(task);
  const worker = workers.find(w => w.id === task.worker_id);
  
  return (
    <Link href={`/task/${task.task_id}`}>
      <div 
        className="p-3 rounded-md border hover-elevate cursor-pointer flex items-center gap-4"
        data-testid={`row-task-${task.task_id}`}
      >
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{task.command}</p>
          <p className="text-xs text-muted-foreground">
            Scheduled: {task.scheduled_at ? format(new Date(task.scheduled_at.replace(' ', 'T')), "MMM d, HH:mm:ss") : "—"}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {worker && (
            <span className="text-xs text-muted-foreground hidden sm:block">
              {worker.name}
            </span>
          )}
          <StatusBadge status={status} />
        </div>
      </div>
    </Link>
  );
}

function TaskSkeleton() {
  return (
    <div className="p-3 rounded-md border flex items-center gap-4">
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-5 w-16" />
    </div>
  );
}
