import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

type LogItem = {
  ts: string;
  level: "info" | "success" | "error" | string;
  msg: string;
};

export function ActivityLog() {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource("/api/logs/stream");
    esRef.current = es;

    es.onmessage = (ev) => {
      try {
        const item = JSON.parse(ev.data) as LogItem;
        setLogs((prev) => {
          const next = [...prev, item];
          // keep last 200
          if (next.length > 200) next.shift();
          return next;
        });
      } catch (_) {
        // ignore
      }
    };

    es.onerror = () => {
      // allow the browser to retry automatically
    };

    return () => {
      es.close();
    };
  }, []);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-48 pr-2">
          <ul className="space-y-1 text-sm">
            {logs.map((l, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-muted-foreground whitespace-nowrap">
                  {new Date(l.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
                <Badge variant={l.level === "success" ? "default" : l.level === "error" ? "destructive" : "secondary"}>
                  {l.level}
                </Badge>
                <span className="flex-1">{l.msg}</span>
              </li>
            ))}
            {logs.length === 0 && (
              <li className="text-muted-foreground">No activity yet</li>
            )}
          </ul>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
