import { motion } from "framer-motion";
import { Check, Clock, AlertCircle, Loader2, Play } from "lucide-react";
import { cn } from "@/lib/utils";

export type TaskState = "scheduled" | "picked" | "running" | "completed" | "failed" | "unknown";

interface TimelineProps {
  state: TaskState;
  timestamps: {
    scheduled_at: string;
    picked_at?: string;
    started_at?: string;
    completed_at?: string;
    failed_at?: string;
  };
}

const steps = [
  { id: "scheduled", label: "Scheduled", icon: Clock },
  { id: "picked", label: "Picked Up", icon: Loader2 },
  { id: "running", label: "Running", icon: Play },
  { id: "completed", label: "Completed", icon: Check },
];

export function Timeline({ state, timestamps }: TimelineProps) {
  // Determine failed state for UI logic
  const isFailed = state === "failed";
  const activeIndex = steps.findIndex((step) => step.id === state);
  
  // If failed, we show up to running, then a failure step instead of completed
  const displaySteps = isFailed 
    ? [...steps.slice(0, 3), { id: "failed", label: "Failed", icon: AlertCircle }]
    : steps;

  const currentStepIndex = isFailed ? 3 : (activeIndex === -1 ? 0 : activeIndex);

  return (
    <div className="w-full py-8">
      <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between w-full max-w-3xl mx-auto gap-8 md:gap-0">
        
        {/* Progress Bar Background (Desktop) */}
        <div className="hidden md:block absolute top-6 left-0 w-full h-1 bg-gray-100 rounded-full -z-10" />
        
        {/* Active Progress Bar (Desktop) */}
        <motion.div 
          className={cn(
            "hidden md:block absolute top-6 left-0 h-1 rounded-full -z-10",
            isFailed ? "bg-red-500" : "bg-primary"
          )}
          initial={{ width: "0%" }}
          animate={{ width: `${(currentStepIndex / (displaySteps.length - 1)) * 100}%` }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        />

        {displaySteps.map((step, index) => {
          const isActive = index <= currentStepIndex;
          const isCurrent = index === currentStepIndex;
          const Icon = step.icon;
          
          let timestamp = "";
          if (step.id === "scheduled") timestamp = timestamps.scheduled_at;
          if (step.id === "picked") timestamp = timestamps.picked_at || "";
          if (step.id === "running") timestamp = timestamps.started_at || "";
          if (step.id === "completed") timestamp = timestamps.completed_at || "";
          if (step.id === "failed") timestamp = timestamps.failed_at || "";

          // Don't show timestamp if "null" string from backend
          if (timestamp === "null") timestamp = "";

          return (
            <div key={step.id} className="relative flex md:flex-col items-center gap-4 md:gap-2 group w-full md:w-auto">
              
              {/* Vertical Line for Mobile */}
              {index !== displaySteps.length - 1 && (
                <div className={cn(
                  "absolute left-6 top-10 bottom-[-2rem] w-0.5 md:hidden",
                  isActive ? (isFailed ? "bg-red-200" : "bg-primary/30") : "bg-gray-100"
                )} />
              )}

              <motion.div
                initial={false}
                animate={{
                  scale: isCurrent ? 1.1 : 1,
                  backgroundColor: isActive 
                    ? (step.id === "failed" ? "rgb(239 68 68)" : "hsl(var(--primary))")
                    : "rgb(243 244 246)",
                  borderColor: isActive 
                    ? (step.id === "failed" ? "rgb(239 68 68)" : "hsl(var(--primary))")
                    : "rgb(229 231 235)"
                }}
                className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center border-2 z-10 shadow-sm transition-colors duration-300",
                  isActive ? "text-white shadow-md shadow-primary/20" : "text-gray-400"
                )}
              >
                <Icon className={cn("w-5 h-5", isCurrent && step.id === "running" && "animate-pulse")} />
              </motion.div>

              <div className="flex flex-col md:items-center">
                <span className={cn(
                  "text-sm font-bold transition-colors duration-300",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}>
                  {step.label}
                </span>
                {timestamp && (
                  <span className="text-xs text-muted-foreground mt-0.5 md:text-center">
                    {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
