import { useDocumentHead } from "@buildingai/hooks";
import {
  type ScheduledTask,
  useDeleteScheduledTaskMutation,
  useRunScheduledTaskMutation,
  useScheduledTaskListQuery,
  useToggleScheduledTaskMutation,
} from "@buildingai/services/web";
import { Avatar, AvatarFallback, AvatarImage } from "@buildingai/ui/components/ui/avatar";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Card, CardContent } from "@buildingai/ui/components/ui/card";
import { Switch } from "@buildingai/ui/components/ui/switch";
import { useAlertDialog } from "@buildingai/ui/hooks/use-alert-dialog";
import { cn } from "@buildingai/ui/lib/utils";
import { Bot, ChevronLeft, ChevronRight, Clock, Loader2, Play, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const PAGE_SIZE = 20;

type StatusFilter = "all" | "enabled" | "disabled";

const WEEK_NAMES: Record<string, string> = {
  "0": "日",
  "1": "一",
  "2": "二",
  "3": "三",
  "4": "四",
  "5": "五",
  "6": "六",
  "7": "日",
};

function cronToReadable(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length < 5) return cron;

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  const hh = hour.padStart(2, "0");
  const mm = minute.padStart(2, "0");

  if (hour.startsWith("*/") && dayOfMonth === "*" && dayOfWeek === "*") {
    const n = hour.slice(2);
    return `每${n}小时`;
  }

  if (minute.startsWith("*/") && hour === "*" && dayOfMonth === "*" && dayOfWeek === "*") {
    const n = minute.slice(2);
    return `每${n}分钟`;
  }

  if (dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    return `每天 ${hh}:${mm}`;
  }

  if (dayOfMonth === "*" && month === "*" && WEEK_NAMES[dayOfWeek]) {
    return `每周${WEEK_NAMES[dayOfWeek]} ${hh}:${mm}`;
  }

  if (/^\d+$/.test(dayOfMonth) && month === "*" && dayOfWeek === "*") {
    return `每月${parseInt(dayOfMonth)}日 ${hh}:${mm}`;
  }

  return cron;
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return "-";

  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "刚刚";
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 30) return `${diffDays}天前`;

    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function formatFutureTime(dateStr: string | null): string {
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

export default function ScheduledTaskListPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const { confirm } = useAlertDialog();

  useDocumentHead({ title: "定时任务" });

  const queryParams = {
    page,
    pageSize: PAGE_SIZE,
    ...(statusFilter !== "all" ? { isEnabled: statusFilter === "enabled" } : {}),
  };

  const { data, isLoading } = useScheduledTaskListQuery(queryParams, { refetchInterval: 30000 });
  const deleteMutation = useDeleteScheduledTaskMutation();
  const toggleMutation = useToggleScheduledTaskMutation();
  const runMutation = useRunScheduledTaskMutation();

  const tasks = data?.items ?? [];
  const totalPages = data?.totalPages ?? 0;

  const handleDelete = async (task: ScheduledTask) => {
    try {
      await confirm({
        title: "删除定时任务",
        description: `确定要删除「${task.name}」吗？此操作不可恢复。`,
        confirmText: "删除",
        confirmVariant: "destructive",
      });
      deleteMutation.mutate(task.id, {
        onSuccess: () => {
          toast.success("删除成功");
          queryClient.invalidateQueries({ queryKey: ["scheduled-tasks"] });
        },
        onError: () => toast.error("删除失败"),
      });
    } catch {
      // user cancelled
    }
  };

  const handleToggle = (task: ScheduledTask) => {
    toggleMutation.mutate(task.id, {
      onSuccess: () => {
        toast.success(task.isEnabled ? "已禁用" : "已启用");
        queryClient.invalidateQueries({ queryKey: ["scheduled-tasks"] });
      },
      onError: () => toast.error("操作失败"),
    });
  };

  const handleRun = async (task: ScheduledTask) => {
    try {
      await confirm({
        title: "立即执行",
        description: `确定要立即执行「${task.name}」吗？`,
      });
      runMutation.mutate(task.id, {
        onSuccess: () => {
          toast.success("任务已开始执行");
          queryClient.invalidateQueries({ queryKey: ["scheduled-tasks"] });
        },
        onError: () => toast.error("执行失败"),
      });
    } catch {
      // user cancelled
    }
  };

  const filterTabs: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "全部" },
    { key: "enabled", label: "已启用" },
    { key: "disabled", label: "已禁用" },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <h1 className="text-2xl font-semibold">定时任务</h1>
          <p className="text-muted-foreground mt-1 text-sm">管理和监控你的定时任务</p>
        </div>
        <Button asChild>
          <Link to="/tasks/new">
            <Plus className="size-4" />
            新建任务
          </Link>
        </Button>
      </div>

      <div className="px-6 pb-4">
        <div className="flex gap-2">
          {filterTabs.map((tab) => (
            <Badge
              key={tab.key}
              className={cn(
                "h-9 cursor-pointer px-4 font-medium",
                statusFilter === tab.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-accent text-accent-foreground",
              )}
              onClick={() => {
                setPage(1);
                setStatusFilter(tab.key);
              }}
            >
              {tab.label}
            </Badge>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 pb-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="text-muted-foreground size-8 animate-spin" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Clock className="text-muted-foreground/50 size-16" />
            <p className="text-muted-foreground mt-4 text-lg">
              {statusFilter === "enabled" && "没有已启用的定时任务"}
              {statusFilter === "disabled" && "没有已禁用的定时任务"}
              {statusFilter === "all" && "暂无定时任务"}
            </p>
            <p className="text-muted-foreground mt-1 text-sm">
              {statusFilter === "all" ? "创建你的第一个定时任务吧" : "试试切换其他筛选条件"}
            </p>
            {statusFilter === "all" && (
              <Button className="mt-6" asChild>
                <Link to="/tasks/new">
                  <Plus className="size-4" />
                  创建任务
                </Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <Card key={task.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <Link
                        to={`/tasks/${task.id}/edit`}
                        className="hover:text-primary truncate font-medium hover:underline"
                      >
                        {task.name}
                      </Link>
                      <Badge
                        variant={task.isEnabled ? "default" : "secondary"}
                        className={
                          task.isEnabled
                            ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                            : ""
                        }
                      >
                        {task.isEnabled ? "已启用" : "已禁用"}
                      </Badge>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        size="icon-sm"
                        variant="outline"
                        onClick={() => handleRun(task)}
                        disabled={runMutation.isPending || !task.isEnabled}
                        title="立即执行"
                      >
                        <Play className="size-4" />
                      </Button>
                      <Switch
                        checked={task.isEnabled}
                        onCheckedChange={() => handleToggle(task)}
                        disabled={toggleMutation.isPending}
                      />
                      <Button
                        size="icon-sm"
                        variant="outline"
                        onClick={() => handleDelete(task)}
                        disabled={deleteMutation.isPending}
                        title="删除"
                      >
                        <Trash2 className="text-destructive size-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="text-muted-foreground mt-3 flex items-center gap-2 text-sm">
                    {task.agent ? (
                      <div className="flex items-center gap-1.5">
                        <Avatar className="size-5">
                          <AvatarImage src={task.agent.avatar} />
                          <AvatarFallback className="text-[10px]">
                            {task.agent.name.slice(0, 1).toUpperCase() || (
                              <Bot className="size-3" />
                            )}
                          </AvatarFallback>
                        </Avatar>
                        <span>{task.agent.name}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <Avatar className="size-5">
                          <AvatarFallback className="text-[10px]">
                            <Bot className="size-3" />
                          </AvatarFallback>
                        </Avatar>
                        <span>未知智能体</span>
                      </div>
                    )}
                    <span className="mx-1">·</span>
                    <Clock className="size-3.5" />
                    <span>{cronToReadable(task.cronExpression)}</span>
                  </div>

                  <div className="text-muted-foreground mt-2 flex items-center gap-4 text-xs">
                    <span>上次运行: {formatTime(task.lastRunAt)}</span>
                    <span>下次运行: {task.isEnabled ? formatFutureTime(task.nextRunAt) : "待启用"}</span>
                  </div>
                </CardContent>
              </Card>
            ))}

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
