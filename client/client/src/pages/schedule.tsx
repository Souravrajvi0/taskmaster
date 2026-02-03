
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/theme-toggle";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, CalendarIcon, Clock, Zap } from "lucide-react";
import { format, addMinutes, addHours, setHours, setMinutes, setSeconds } from "date-fns";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

const scheduleSchema = z.object({
  command: z.string().min(1, "Command is required"),
  scheduledDate: z.date({
    required_error: "Please select a date",
  }),
  scheduledTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
});

type ScheduleFormData = z.infer<typeof scheduleSchema>;

export default function ScheduleTask() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [createdTaskId, setCreatedTaskId] = useState<string | null>(null);

  const now = new Date();
  const defaultTime = format(now, "HH:mm");

  const form = useForm<ScheduleFormData>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      command: "",
      scheduledDate: now,
      scheduledTime: defaultTime,
    },
  });

  const scheduleMutation = useMutation({
    mutationFn: async (data: ScheduleFormData) => {
      const [hours, minutes] = data.scheduledTime.split(":").map(Number);
      let scheduledAt = setHours(data.scheduledDate, hours);
      scheduledAt = setMinutes(scheduledAt, minutes);
      scheduledAt = setSeconds(scheduledAt, 0);

      const response = await apiRequest("POST", "/api/schedule", {
        command: data.command,
        scheduled_at: scheduledAt.toISOString(),
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setCreatedTaskId(data.task_id);
      toast({
        title: "Task Scheduled",
        description: `Task ID: ${data.task_id.substring(0, 8)}...`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to schedule task",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const setQuickTime = (fn: (date: Date) => Date) => {
    const newDate = fn(new Date());
    form.setValue("scheduledDate", newDate);
    form.setValue("scheduledTime", format(newDate, "HH:mm"));
  };

  const onSubmit = (data: ScheduleFormData) => {
    scheduleMutation.mutate(data);
  };

  if (createdTaskId) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card sticky top-0 z-50">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Zap className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">TaskMaster</h1>
            </div>
            <ThemeToggle />
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <Card className="max-w-md mx-auto">
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="h-8 w-8 text-green-500" />
              </div>
              <CardTitle>Task Scheduled!</CardTitle>
              <CardDescription>
                Your task has been added to the queue
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-muted rounded-md">
                <p className="text-xs text-muted-foreground mb-1">Task ID</p>
                <p className="font-mono text-sm break-all" data-testid="text-task-id">{createdTaskId}</p>
              </div>
              <div className="flex gap-2">
                <Link href={`/task/${createdTaskId}`} className="flex-1">
                  <Button className="w-full" data-testid="button-view-status">
                    View Status
                  </Button>
                </Link>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setCreatedTaskId(null);
                    form.reset();
                  }}
                  data-testid="button-schedule-another"
                >
                  Schedule Another
                </Button>
              </div>
              <Link href="/">
                <Button variant="ghost" className="w-full" data-testid="button-back-dashboard">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

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
            <h1 className="text-xl font-bold">Schedule Task</h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card className="max-w-lg mx-auto">
          <CardHeader>
            <CardTitle>Schedule New Task</CardTitle>
            <CardDescription>
              Enter a command and choose when to execute it
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="command"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Task Command</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., generate-monthly-report" 
                          {...field}
                          data-testid="input-command"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <FormLabel>Quick Schedule</FormLabel>
                  <div className="flex flex-wrap gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={() => setQuickTime(() => new Date())}
                      data-testid="button-quick-now"
                    >
                      Now
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={() => setQuickTime((d) => addMinutes(d, 5))}
                      data-testid="button-quick-5min"
                    >
                      +5 min
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={() => setQuickTime((d) => addMinutes(d, 30))}
                      data-testid="button-quick-30min"
                    >
                      +30 min
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={() => setQuickTime((d) => addHours(d, 1))}
                      data-testid="button-quick-1hour"
                    >
                      +1 hour
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="scheduledDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  "pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                                data-testid="button-date-picker"
                              >
                                {field.value ? (
                                  format(field.value, "MMM d, yyyy")
                                ) : (
                                  <span>Pick a date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) =>
                                date < new Date(new Date().setHours(0, 0, 0, 0))
                              }
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="scheduledTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Time</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                              type="time" 
                              className="pl-10"
                              {...field}
                              data-testid="input-time"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={scheduleMutation.isPending}
                  data-testid="button-submit"
                >
                  {scheduleMutation.isPending ? (
                    <>Scheduling...</>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 mr-2" />
                      Schedule Task
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
