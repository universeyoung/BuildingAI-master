import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@buildingai/ui/components/ui/collapsible";
import { Input } from "@buildingai/ui/components/ui/input";
import { Label } from "@buildingai/ui/components/ui/label";
import { Switch } from "@buildingai/ui/components/ui/switch";
import { cn } from "@buildingai/ui/lib/utils";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { ModelSelector } from "@/components/ask-assistant-ui/components/model-selector";

export interface AdvancedSettingsProps {
  modelId?: string;
  onModelChange?: (modelId: string) => void;
  mcpToolIds?: string[];
  onMcpToolsChange?: (toolIds: string[]) => void;
  fileIds?: string[];
  onFilesChange?: (fileIds: string[]) => void;
  enableThinking?: boolean;
  onEnableThinkingChange?: (enabled: boolean) => void;
  appId?: string;
  onAppIdChange?: (appId: string) => void;
  disabled?: boolean;
}

export function AdvancedSettings({
  modelId,
  onModelChange,
  mcpToolIds,
  onMcpToolsChange: _onMcpToolsChange,
  fileIds,
  onFilesChange,
  enableThinking,
  onEnableThinkingChange,
  appId,
  onAppIdChange,
  disabled,
}: AdvancedSettingsProps) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="hover:bg-muted/50 flex w-full items-center justify-between rounded-md border px-4 py-3 text-sm font-medium">
        <span>高级设置</span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 transition-transform duration-200", open && "rotate-180")}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-6 pt-4">
        <div className="space-y-2">
          <Label>模型选择</Label>
          <ModelSelector
            modelType="llm"
            selectedModelId={modelId}
            onModelChange={onModelChange}
            triggerVariant="button"
            placeholder="请选择模型"
            disabled={disabled}
          />
        </div>

        <div className="space-y-2">
          <Label>MCP 工具</Label>
          <p className="text-muted-foreground text-sm">
            请先在智能体中配置 MCP 工具，此处的 MCP 工具将覆盖智能体的默认配置
          </p>
          {mcpToolIds && mcpToolIds.length > 0 && (
            <p className="text-sm">已选择 {mcpToolIds.length} 个工具</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>文件附件</Label>
          <Input
            type="file"
            multiple
            disabled={disabled}
            onChange={(e) => {
              const names = Array.from(e.target.files ?? []).map((f) => f.name);
              onFilesChange?.(names);
            }}
          />
          {fileIds && fileIds.length > 0 && (
            <p className="text-muted-foreground text-sm">已选择 {fileIds.length} 个文件</p>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>思考模式</Label>
            <p className="text-muted-foreground text-sm">启用后，AI 将在回答前进行深度思考</p>
          </div>
          <Switch
            checked={enableThinking ?? false}
            onCheckedChange={onEnableThinkingChange}
            disabled={disabled}
          />
        </div>

        <div className="space-y-2">
          <Label>关联应用</Label>
          <Input
            placeholder="应用 ID（可选）"
            value={appId ?? ""}
            onChange={(e) => onAppIdChange?.(e.target.value)}
            disabled={disabled}
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
