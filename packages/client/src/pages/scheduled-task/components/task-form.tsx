import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@buildingai/ui/components/ui/button";
import { Input } from "@buildingai/ui/components/ui/input";
import { Label } from "@buildingai/ui/components/ui/label";
import { Textarea } from "@buildingai/ui/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@buildingai/ui/components/ui/select";
import {
  useCreateScheduledTaskMutation,
  useUpdateScheduledTaskMutation,
  useConversationsQuery,
  useMyAgentsInfiniteQuery,
  type ScheduledTask,
} from "@buildingai/services/web";
import { Loader2 } from "lucide-react";
import { CronPicker } from "./cron-picker";
import { AdvancedSettings } from "./advanced-settings";
 
const PAGE_SIZE = 50;
 
interface TaskFormProps {
  mode: "create" | "edit";
  defaultValues?: ScheduledTask;
  taskId?: string;
}
 
export function TaskForm({ mode, defaultValues, taskId }: TaskFormProps) {
  const navigate = useNavigate();
 
  const [name, setName] = useState(defaultValues?.name ?? "");
  const [agentId, setAgentId] = useState(defaultValues?.agentId ?? "");
  const [conversationMode, setConversationMode] = useState<"new" | "continue">(
    defaultValues?.conversationMode ?? "new",
  );
  const [conversationId, setConversationId] = useState(defaultValues?.conversationId ?? "");
  const [prompt, setPrompt] = useState(defaultValues?.prompt ?? "");
  const [cronExpression, setCronExpression] = useState(defaultValues?.cronExpression ?? "0 8 * * *");
  const [modelId, setModelId] = useState(defaultValues?.advancedSettings?.modelId ?? "");
  const [mcpToolIds, setMcpToolIds] = useState<string[]>(defaultValues?.advancedSettings?.mcpToolIds ?? []);
  const [fileIds, setFileIds] = useState<string[]>(defaultValues?.advancedSettings?.fileIds ?? []);
  const [enableThinking, setEnableThinking] = useState(defaultValues?.advancedSettings?.enableThinking ?? false);
  const [appId, setAppId] = useState(defaultValues?.advancedSettings?.appId ?? "");
 
  const [agentSearch, setAgentSearch] = useState("");
 
  const { data: agentsData, isLoading: isAgentsLoading } = useMyAgentsInfiniteQuery(
    { pageSize: PAGE_SIZE, keyword: agentSearch || undefined },
    { enabled: true },
  );
 
  const agents = useMemo(() => {
    if (!agentsData?.pages) return [];
    return agentsData.pages.flatMap((page) => page.items);
  }, [agentsData]);
 
  const { data: conversationsData, isLoading: isConversationsLoading } = useConversationsQuery(
    { page: 1, pageSize: PAGE_SIZE },
    { enabled: conversationMode === "continue" },
  );
 
  const conversations = useMemo(() => {
    if (!conversationsData?.items) return [];
    return conversationsData.items;
  }, [conversationsData]);
 
  const createMutation = useCreateScheduledTaskMutation();
  const updateMutation = useUpdateScheduledTaskMutation();
  const isSubmitting = createMutation.isPending || updateMutation.isPending;
 
  const buildAdvancedSettings = useCallback(() => {
    return {
      modelId: modelId || undefined,
      mcpToolIds: mcpToolIds.length > 0 ? mcpToolIds : undefined,
      fileIds: fileIds.length > 0 ? fileIds : undefined,
      enableThinking: enableThinking || undefined,
      appId: appId || undefined,
    };
  }, [modelId, mcpToolIds, fileIds, enableThinking, appId]);
 
  const handleSubmit = useCallback(
    async (enableAfterSave: boolean) => {
      if (!name.trim()) {
        toast.error("请输入任务名称");
        return;
      }
      if (!agentId) {
        toast.error("请选择智能体");
        return;
      }
      if (!cronExpression) {
        toast.error("请配置调度规则");
        return;
      }
 
      const payload: Partial<ScheduledTask> = {
        name: name.trim(),
        agentId,
        conversationMode,
        conversationId: conversationMode === "continue" ? conversationId : undefined,
        prompt: prompt.trim() || undefined,
        cronExpression,
        isEnabled: enableAfterSave,
        advancedSettings: buildAdvancedSettings(),
      };
 
      if (mode === "edit" && taskId) {
        updateMutation.mutate(
          { id: taskId, data: payload },
          {
            onSuccess: () => {
              toast.success("任务已保存");
              navigate("/scheduled-task");
            },
            onError: () => {
              toast.error("保存失败，请重试");
            },
          },
        );
      } else {
        createMutation.mutate(
          { ...payload, isEnabled: enableAfterSave },
          {
            onSuccess: () => {
              toast.success("任务已创建");
              navigate("/scheduled-task");
            },
            onError: () => {
              toast.error("创建失败，请重试");
            },
          },
        );
      }
    },
    [
      name,
      agentId,
      conversationMode,
      conversationId,
      prompt,
      cronExpression,
      buildAdvancedSettings,
      mode,
      taskId,
      createMutation,
      updateMutation,
      navigate,
    ],
  );
 
  return (
    <div className="mx-auto max-w-2xl space-y-8 py-8">
      <div>
        <h1 className="text-2xl font-bold">
          {mode === "create" ? "新建任务" : "编辑任务"}
        </h1>
      </div>
 
      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="task-name">任务名称</Label>
          <Input
            id="task-name"
            placeholder="请输入任务名称"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isSubmitting}
          />
        </div>
 
        <div className="space-y-2">
          <Label>选择智能体</Label>
          {isAgentsLoading ? (
            <p className="text-sm text-muted-foreground">加载中...</p>
          ) : (
            <div className="space-y-2">
              <Input
                placeholder="搜索智能体..."
                value={agentSearch}
                onChange={(e) => setAgentSearch(e.target.value)}
                disabled={isSubmitting}
              />
              <Select value={agentId} onValueChange={setAgentId} disabled={isSubmitting}>
                <SelectTrigger>
                  <SelectValue placeholder="请选择智能体" />
                </SelectTrigger>
                <SelectContent>
                  {agents.length === 0 ? (
                    <div className="px-2 py-4 text-sm text-muted-foreground">
                      暂无可用的智能体
                    </div>
                  ) : (
                    agents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
 
        <div className="space-y-2">
          <Label>会话模式</Label>
          <Select
            value={conversationMode}
            onValueChange={(v) => setConversationMode(v as "new" | "continue")}
            disabled={isSubmitting}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new">新建会话</SelectItem>
              <SelectItem value="continue">继续历史会话</SelectItem>
            </SelectContent>
          </Select>
        </div>
 
        {conversationMode === "continue" && (
          <div className="space-y-2">
            <Label>选择会话</Label>
            {isConversationsLoading ? (
              <p className="text-sm text-muted-foreground">加载中...</p>
            ) : (
              <Select value={conversationId} onValueChange={setConversationId} disabled={isSubmitting}>
                <SelectTrigger>
                  <SelectValue placeholder="搜索历史会话..." />
                </SelectTrigger>
                <SelectContent>
                  {conversations.length === 0 ? (
                    <div className="px-2 py-4 text-sm text-muted-foreground">
                      暂无历史会话
                    </div>
                  ) : (
                    conversations.map((conv) => (
                      <SelectItem key={conv.id} value={conv.id}>
                        {conv.title || "未命名会话"}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
          </div>
        )}
 
        <div className="space-y-2">
          <Label htmlFor="task-prompt">提示词</Label>
          <Textarea
            id="task-prompt"
            placeholder="请输入提示词..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            disabled={isSubmitting}
          />
        </div>
 
        <div className="space-y-2">
          <Label>调度配置</Label>
          <CronPicker
            value={cronExpression}
            onChange={setCronExpression}
            disabled={isSubmitting}
          />
        </div>
 
        <AdvancedSettings
          modelId={modelId}
          onModelChange={setModelId}
          mcpToolIds={mcpToolIds}
          onMcpToolsChange={setMcpToolIds}
          fileIds={fileIds}
          onFilesChange={setFileIds}
          enableThinking={enableThinking}
          onEnableThinkingChange={setEnableThinking}
          appId={appId}
          onAppIdChange={setAppId}
          disabled={isSubmitting}
        />
      </div>
 
      <div className="flex gap-3 pt-4">
        <Button
          type="button"
          onClick={() => handleSubmit(false)}
          disabled={isSubmitting}
        >
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {mode === "create" ? "创建任务" : "保存"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => handleSubmit(true)}
          disabled={isSubmitting}
        >
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {mode === "create" ? "创建任务" : "保存并启用"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate(-1)}
          disabled={isSubmitting}
        >
          取消
        </Button>
      </div>
    </div>
  );
}
