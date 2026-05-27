"use client";
 
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useScheduledTaskRunsQuery,
  useScheduledTaskListQuery,
  type ScheduledTaskRun,
} from "@buildingai/services/web";
import { ScrollArea } from "@buildingai/ui/components/ui/scroll-area";
import { Skeleton } from "@buildingai/ui/components/ui/skeleton";
import { cn } from "@buildingai/ui/lib/utils";
import { Clock, CheckCircle, XCircle, Loader2, Bot, ChevronRight } from "lucide-react";
 
import { formatRelativeTime } from "../utils/conversation-group";
 
const statusIcons: Record<
  ScheduledTaskRun["status"],
  { Icon: typeof Clock; className: string }
> = {
  pending: { Icon: Clock, className: "text-yellow-500" },
  running: { Icon: Loader2, className: "text-blue-500 animate-spin" },
  success: { Icon: CheckCircle, className: "text-green-500" },
  failed: { Icon: XCircle, className: "text-red-500" },
};
 
function StatusIcon({ status }: { status: ScheduledTaskRun["status"] }) {
  const { Icon, className } = statusIcons[status];
  return <Icon className={cn("size-3.5 shrink-0", className)} />;
}
 
function TaskRunItem({ run }: { run: ScheduledTaskRun }) {
  const navigate = useNavigate();
 
  return (
    <button
      type="button"
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
      onClick={() => navigate(`/c/${run.chatConversationId}`)}
    >
      <StatusIcon status={run.status} />
      <span className="line-clamp-1 flex-1 text-xs text-muted-foreground">
        {formatRelativeTime(run.createdAt)}
      </span>
      {run.tokenUsed > 0 && (
        <span className="shrink-0 text-xs text-muted-foreground">
          {run.tokenUsed.toLocaleString()} tokens
        </span>
      )}
    </button>
  );
}
 
function TaskGroup({ taskId, taskName }: { taskId: string; taskName: string }) {
  const [expanded, setExpanded] = useState(false);
 
  const { data, isLoading } = useScheduledTaskRunsQuery(
    taskId,
    { page: 1, pageSize: 10 },
    { enabled: expanded },
  );
 
  return (
    <div className="space-y-0.5">
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-medium transition-colors hover:bg-accent"
        onClick={() => setExpanded(!expanded)}
      >
        <Bot className="size-4 shrink-0 text-primary" />
        <span className="line-clamp-1 flex-1">{taskName}</span>
        <ChevronRight
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-90",
          )}
        />
      </button>
      {expanded && (
        <div className="ml-2 space-y-0.5 border-l pl-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-full rounded-md" />
            ))
          ) : (data?.items?.length ?? 0) === 0 ? (
            <p className="px-2 py-2 text-xs text-muted-foreground">暂无执行记录</p>
          ) : (
            data?.items.map((run) => (
              <TaskRunItem key={run.id} run={run} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
 
export function TaskRecordsPanel({ className }: { className?: string }) {
  const { data, isLoading } = useScheduledTaskListQuery({ page: 1, pageSize: 100 });
 
  return (
    <div className={cn("flex h-full flex-col", className)}>
      <ScrollArea className="flex-1">
        <div className="space-y-1 px-2 py-2">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-md" />
            ))
          ) : (data?.items?.length ?? 0) === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">暂无定时任务</p>
          ) : (
            data?.items.map((task) => (
              <TaskGroup key={task.id} taskId={task.id} taskName={task.name} />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
