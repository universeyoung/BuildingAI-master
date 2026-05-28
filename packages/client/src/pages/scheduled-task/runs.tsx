import { useDocumentHead } from "@buildingai/hooks";
import {
  useScheduledTaskRunsQuery,
  useScheduledTaskDetailQuery,
} from "@buildingai/services/web";
import { Avatar, AvatarFallback, AvatarImage } from "@buildingai/ui/components/ui/avatar";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Card, CardContent } from "@buildingai/ui/components/ui/card";
import { cn } from "@buildingai/ui/lib/utils";
import { Bot, ChevronLeft, ChevronRight, Clock, Loader2, MessageSquare } from "lucide-react";
import { useState } from "react";
import { useParams, Link } from "react-router-dom";

const PAGE_SIZE = 20;

function formatTime(dateStr: string | null): string {
  if (!dateStr) return "-";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function getDuration(start: string | null, end: string | null): string {
  if (!start || !end) return "-";
  try {
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  } catch {
    return "-";
  }
}

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive"; className?: string }> = {
  pending: { label: "等待中", variant: "secondary" },
  running: { label: "运行中", variant: "default", className: "bg-blue-50 text-blue-700" },
  success: { label: "成功", variant: "default", className: "bg-green-50 text-green-700" },
  failed: { label: "失败", variant: "destructive" },
};

export default function ScheduledTaskRunsPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const [page, setPage] = useState(1);

  useDocumentHead({ title: "运行记录" });

  const { data: taskData } = useScheduledTaskDetailQuery(taskId!);
  const { data, isLoading } = useScheduledTaskRunsQuery(
    { taskId: taskId!, params: { page, pageSize: PAGE_SIZE } },
  );

  const runs = data?.items ?? [];
  const totalPages = data?.totalPages ?? 0;
  const task = taskData;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-6 py-4">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link to="/tasks">
            <ChevronLeft className="size-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold">
            {task?.name || "运行记录"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {task?.agent ? (
              <span className="flex items-center gap-1.5">
                <Avatar className="size-4">
                  <AvatarImage src={task.agent.avatar} />
                  <AvatarFallback className="text-[9px]">
                    {task.agent.name?.slice(0, 1).toUpperCase() || <Bot className="size-2.5" />}
                  </AvatarFallback>
                </Avatar>
                {task.agent.name}
              </span>
            ) : (
              <span>智能体</span>
            )}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 pb-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="text-muted-foreground size-8 animate-spin" />
          </div>
        ) : runs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Clock className="text-muted-foreground/50 size-16" />
            <p className="text-muted-foreground mt-4 text-lg">暂无运行记录</p>
            <p className="text-muted-foreground mt-1 text-sm">运行后将在这里显示执行记录</p>
          </div>
        ) : (
          <div className="space-y-3">
            {runs.map((run) => {
              const statusInfo = STATUS_MAP[run.status] || STATUS_MAP.pending;
              const agentId = task?.agentId;
              const conversationId = run.chatConversationId;

              return (
                <Card key={run.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <Badge
                          variant={statusInfo.variant}
                          className={statusInfo.className}
                        >
                          {statusInfo.label}
                        </Badge>
                        {conversationId && agentId ? (
                          <Link
                            to={`/agents/${agentId}/c/${conversationId}`}
                            className="hover:text-primary flex items-center gap-1.5 text-sm hover:underline"
                          >
                            <MessageSquare className="size-3.5" />
                            查看对话
                          </Link>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            {run.status === "failed" ? run.errorMessage || "执行失败" : "无对话记录"}
                          </span>
                        )}
                      </div>
                      <div className="text-muted-foreground shrink-0 text-xs">
                        {getDuration(run.startedAt, run.finishedAt)}
                      </div>
                    </div>

                    <div className="text-muted-foreground mt-2 flex items-center gap-4 text-xs">
                      <span>开始: {formatTime(run.startedAt)}</span>
                      <span>结束: {formatTime(run.finishedAt)}</span>
                      {run.tokenUsed > 0 && <span>Token: {run.tokenUsed}</span>}
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="size-4" />
                  上一页
                </Button>
                <span className="text-muted-foreground text-sm">
                  第 {page} / {totalPages} 页
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  下一页
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
