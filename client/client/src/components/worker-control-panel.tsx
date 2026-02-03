import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, ShieldAlert } from "lucide-react";

const SCALE_PRESETS = [1, 3, 5];

export function WorkerControlPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [killTarget, setKillTarget] = useState("taskmaster-master-worker-2");

  const scaleMutation = useMutation({
    mutationFn: async (count: number) => {
      const res = await apiRequest("POST", "/api/workers/scale", { count });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to scale workers");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/workers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: `Scaling to ${data.count} workers`,
        description: "Docker compose command executed from UI",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Scale failed", description: error.message, variant: "destructive" });
    },
  });

  const killMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/workers/kill", { name });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to kill worker");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/workers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: `Killed ${data.name}`, description: "Worker will drop offline and tasks reroute" });
    },
    onError: (error: Error) => {
      toast({ title: "Kill failed", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Worker Control (from UI)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="text-sm font-medium">Scale Workers</div>
          <div className="flex gap-2">
            {SCALE_PRESETS.map((count) => (
              <Button
                key={count}
                variant="outline"
                className="flex-1"
                disabled={scaleMutation.isPending}
                onClick={() => scaleMutation.mutate(count)}
              >
                {scaleMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  `${count} worker${count === 1 ? "" : "s"}`
                )}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Executes docker-compose scaling from the scheduler API. Metrics and worker list will refresh automatically.
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ShieldAlert className="h-4 w-4 text-destructive" />
            Kill a Worker (resilience demo)
          </div>
          <div className="flex gap-2">
            <Input
              value={killTarget}
              onChange={(e) => setKillTarget(e.target.value)}
              placeholder="taskmaster-master-worker-2"
              disabled={killMutation.isPending}
            />
            <Button
              variant="destructive"
              disabled={killMutation.isPending || !killTarget}
              onClick={() => killMutation.mutate(killTarget)}
              className="shrink-0"
            >
              {killMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Kill"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Stops the named container via scheduler API. Remaining workers continue processing tasks.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
