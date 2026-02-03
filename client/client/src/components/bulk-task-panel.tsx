import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Zap, Loader2 } from "lucide-react";

export function BulkTaskPanel() {
  const [count, setCount] = useState("50");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (num: number) => {
      const res = await apiRequest("POST", "/api/schedule/batch", {
        command: "demo-job",
        count: num,
        delay_seconds: 0,
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: `Created ${data.count} tasks`,
        description: `Tasks scheduled for immediate execution`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create tasks",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreate = () => {
    const n = Math.max(1, Math.min(1000, parseInt(count, 10) || 1));
    createMutation.mutate(n);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Zap className="h-5 w-5 text-yellow-500" />
          Bulk Task Creation (Demo)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            type="number"
            min="1"
            max="1000"
            value={count}
            onChange={(e) => setCount(e.target.value)}
            placeholder="Number of tasks"
            className="flex-1"
            disabled={createMutation.isPending}
          />
          <Button
            onClick={handleCreate}
            disabled={createMutation.isPending}
            className="gap-2"
          >
            {createMutation.isPending && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            Create Tasks
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Creates {Math.max(1, Math.min(1000, parseInt(count, 10) || 1))} tasks
          scheduled for immediate execution. Watch the dashboard as workers pick
          them up.
        </p>
      </CardContent>
    </Card>
  );
}
