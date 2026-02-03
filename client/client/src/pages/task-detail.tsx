
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, getTaskStatus } from "@/components/status-badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { 
  ArrowLeft, 
  Zap, 
  Clock, 
  Server, 
  Play, 
  CheckCircle2, 
  XCircle,
  RefreshCw,
  Copy,
  Check
} from "lucide-react";
import { format, differenceInSeconds } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface TaskStatus {
  task_id: string;
  command: string;
  scheduled_at: string;
  picked_at: string;
  started_at: string;
  completed_at: string;
  failed_at: string;
  worker_id: number | null;
}

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const { data: task, isLoading, refetch } = useQuery<TaskStatus>({
    queryKey: ["/api/status", { task_id: id }],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/status?task_id=${id}`);
      return res.json();
    },
    refetchInterval: autoRefresh ? 3000 : false,
  });

  const status = task ? getTaskStatus(task) : "scheduled";
  const isTerminal = status === "completed" || status === "failed";

  const copyTaskId = () => {
    navigator.clipboard.writeText(id || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Task ID copied!" });
  };

  const parseDate = (dateStr: string) => {
    if (!dateStr) return null;
    return new Date(dateStr.replace(" ", "T"));
  };

  const getDuration = () => {
    if (!task?.scheduled_at) return null;
    const start = parseDate(task.scheduled_at);
    const end = task.completed_at 
      ? parseDate(task.completed_at) 
      : task.failed_at 
        ? parseDate(task.failed_at) 
        : null;
    if (!start || !end) return null;
    return differenceInSeconds(end, start);
  };

  const duration = getDuration();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Link href="/">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <Zap className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">Task Details</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground hidden sm:inline">Auto-refresh</span>
              <Switch 
                checked={autoRefresh} 
                onCheckedChange={setAutoRefresh}
                data-testid="switch-auto-refresh"
              />
            </div>
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => refetch()}
              data-testid="button-refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        {isLoading ? (
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-3/4" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        ) : task ? (
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{task.command}</CardTitle>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="font-mono" data-testid="text-task-id-short">
                        {task.task_id.substring(0, 8)}...
                      </span>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6"
                        onClick={copyTaskId}
                        data-testid="button-copy-id"
                      >
                        {copied ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <StatusBadge status={status} className="text-sm" />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {task.worker_id && (
                  <div className="flex items-center gap-2 text-sm">
                    <Server className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Assigned to:</span>
                    <Badge variant="outline">Worker-{task.worker_id}</Badge>
                  </div>
                )}
                {duration !== null && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Total Duration:</span>
                    <span className="font-medium">{duration} seconds</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Task Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-0">
                  <TimelineItem
                    icon={<Clock className="h-4 w-4" />}
                    label="Scheduled"
                    timestamp={task.scheduled_at}
                    isComplete={!!task.scheduled_at}
                    isActive={!task.picked_at}
                    color="blue"
                  />
                  <TimelineConnector isComplete={!!task.picked_at} />
                  
                  <TimelineItem
                    icon={<Server className="h-4 w-4" />}
                    label="Assigned"
                    timestamp={task.picked_at}
                    isComplete={!!task.picked_at}
                    isActive={!!task.picked_at && !task.started_at}
                    color="yellow"
                    extra={task.worker_id ? `Worker-${task.worker_id}` : undefined}
                  />
                  <TimelineConnector isComplete={!!task.started_at} />
                  
                  <TimelineItem
                    icon={<Play className="h-4 w-4" />}
                    label="Started"
                    timestamp={task.started_at}
                    isComplete={!!task.started_at}
                    isActive={!!task.started_at && !task.completed_at && !task.failed_at}
                    color="orange"
                  />
                  <TimelineConnector isComplete={!!task.completed_at || !!task.failed_at} />
                  
                  {task.failed_at ? (
                    <TimelineItem
                      icon={<XCircle className="h-4 w-4" />}
                      label="Failed"
                      timestamp={task.failed_at}
                      isComplete={true}
                      isActive={false}
                      color="red"
                    />
                  ) : (
                    <TimelineItem
                      icon={<CheckCircle2 className="h-4 w-4" />}
                      label="Completed"
                      timestamp={task.completed_at}
                      isComplete={!!task.completed_at}
                      isActive={false}
                      color="green"
                    />
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Link href="/" className="flex-1">
                <Button variant="outline" className="w-full" data-testid="button-back-dashboard">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
              <Link href="/schedule">
                <Button data-testid="button-schedule-new">
                  <Zap className="h-4 w-4 mr-2" />
                  Schedule New
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <XCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
              <p className="text-lg font-medium">Task Not Found</p>
              <p className="text-sm text-muted-foreground mt-1">
                The task with ID "{id}" does not exist.
              </p>
              <Link href="/">
                <Button className="mt-4" data-testid="button-back-home">
                  Back to Dashboard
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

function TimelineItem({ 
  icon, 
  label, 
  timestamp, 
  isComplete, 
  isActive,
  color,
  extra
}: { 
  icon: React.ReactNode; 
  label: string; 
  timestamp: string; 
  isComplete: boolean;
  isActive: boolean;
  color: "blue" | "yellow" | "orange" | "green" | "red";
  extra?: string;
}) {
  const colorClasses = {
    blue: "bg-blue-500 text-white",
    yellow: "bg-yellow-500 text-white",
    orange: "bg-orange-500 text-white",
    green: "bg-green-500 text-white",
    red: "bg-red-500 text-white",
  };

  const inactiveClasses = "bg-muted text-muted-foreground";

  return (
    <div className="flex items-start gap-3" data-testid={`timeline-${label.toLowerCase()}`}>
      <div 
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all",
          isComplete ? colorClasses[color] : inactiveClasses,
          isActive && "ring-2 ring-offset-2 ring-offset-background animate-pulse-slow",
          isActive && color === "blue" && "ring-blue-500",
          isActive && color === "yellow" && "ring-yellow-500",
          isActive && color === "orange" && "ring-orange-500",
        )}
      >
        {icon}
      </div>
      <div className="flex-1 pt-1">
        <div className="flex items-center justify-between">
          <span className={cn(
            "font-medium text-sm",
            !isComplete && "text-muted-foreground"
          )}>
            {label}
          </span>
          {extra && (
            <Badge variant="outline" className="text-xs">
              {extra}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {timestamp ? format(new Date(timestamp.replace(" ", "T")), "MMM d, yyyy HH:mm:ss") : "—"}
        </p>
      </div>
    </div>
  );
}

function TimelineConnector({ isComplete }: { isComplete: boolean }) {
  return (
    <div className="ml-[15px] w-0.5 h-6 bg-border">
      <div 
        className={cn(
          "w-full transition-all duration-500",
          isComplete ? "h-full bg-primary" : "h-0"
        )} 
      />
    </div>
  );
}
