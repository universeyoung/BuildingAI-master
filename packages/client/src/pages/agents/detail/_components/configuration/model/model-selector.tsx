import type { ModelRouting } from "@buildingai/types";
import { Button } from "@buildingai/ui/components/ui/button";
import { Input } from "@buildingai/ui/components/ui/input";
import { Label } from "@buildingai/ui/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@buildingai/ui/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@buildingai/ui/components/ui/tooltip";
import { HelpCircle, Settings2 } from "lucide-react";
import { memo, useCallback } from "react";

import { ModelSelector as AIModelSelector } from "@/components/ask-assistant-ui/components/model-selector";

type MemoryConfig = { maxUserMemories?: number; maxAgentMemories?: number } | null;
const MEMORY_DEFAULT = 20;
const MEMORY_MIN = 1;
const MEMORY_MAX = 200;

type ModelSlot = {
  key: keyof ModelRouting | "chat";
  title: string;
  description: string;
  tooltip: string;
  modelType?: "llm" | "text-embedding" | "rerank";
};

const MODEL_SLOTS: ModelSlot[] = [
  {
    key: "chat",
    title: "主对话模型 (LLM)",
    description: "智能体对话的核心模型",
    tooltip: "用于与用户对话的主模型，必选。",
    modelType: "llm",
  },
  {
    key: "memoryModel",
    title: "记忆提取模型",
    description: "用于提取长期记忆，可选用低成本模型",
    tooltip:
      "用于从对话中提取并写入长期记忆（用户全局记忆与智能体专属记忆）。不配置则不会读写长期记忆。",
    modelType: "llm",
  },
  {
    key: "planningModel",
    title: "目标规划模型",
    description: "用于复杂任务的规划与分解",
    tooltip: "用于对复杂任务做目标评估与执行计划分解，再逐步执行。不配置则不做目标规划，直接回复。",
    modelType: "llm",
  },
  //   {
  //     key: "reflectionModel",
  //     title: "反思模型",
  //     description: "用于回复质量自评",
  //     tooltip: "用于在输出最终回答前对回复质量做自我检查。不配置则不做反思。",
  //     modelType: "llm",
  //   },
  {
    key: "titleModel",
    title: "追问建议模型",
    description: "用于回复后自动生成追问建议，可选用低成本模型",
    tooltip: "用于在智能体回复后自动生成 3 条追问建议供用户快速选择。不配置则不会生成追问建议。",
    modelType: "llm",
  },
];

interface ModelSelectorPanelProps {
  chatModelId?: string;
  modelRouting?: ModelRouting | null;
  memoryConfig?: MemoryConfig;
  onChatModelChange: (id: string) => void;
  onModelRoutingChange: (routing: ModelRouting) => void;
  onMemoryConfigChange?: (config: MemoryConfig) => void;
}

export const ModelSelector = memo(
  ({
    chatModelId,
    modelRouting,
    memoryConfig,
    onChatModelChange,
    onModelRoutingChange,
    onMemoryConfigChange,
  }: ModelSelectorPanelProps) => {
    const getSlotValue = useCallback(
      (key: ModelSlot["key"]): string => {
        if (key === "chat") return chatModelId ?? "";
        return modelRouting?.[key]?.modelId ?? "";
      },
      [chatModelId, modelRouting],
    );

    const handleSlotChange = useCallback(
      (key: ModelSlot["key"], modelId: string) => {
        if (key === "chat") {
          onChatModelChange(modelId);
          return;
        }
        const next: ModelRouting = { ...modelRouting };
        if (modelId) {
          next[key] = { modelId };
        } else {
          delete next[key];
        }
        onModelRoutingChange(next);
      },
      [modelRouting, onChatModelChange, onModelRoutingChange],
    );

    const maxUser = memoryConfig?.maxUserMemories ?? MEMORY_DEFAULT;
    const maxAgent = memoryConfig?.maxAgentMemories ?? MEMORY_DEFAULT;
    const updateMemory = useCallback(
      (field: "maxUserMemories" | "maxAgentMemories", value: number) => {
        const v = Math.min(MEMORY_MAX, Math.max(MEMORY_MIN, value));
        onMemoryConfigChange?.({
          maxUserMemories:
            field === "maxUserMemories" ? v : (memoryConfig?.maxUserMemories ?? MEMORY_DEFAULT),
          maxAgentMemories:
            field === "maxAgentMemories" ? v : (memoryConfig?.maxAgentMemories ?? MEMORY_DEFAULT),
        });
      },
      [memoryConfig, onMemoryConfigChange],
    );

    return (
      <div className="space-y-3">
        <div className="space-y-2">
          <h3 className="text-sm font-medium">模型路由</h3>
          <p className="text-muted-foreground text-xs">
            为不同功能模块指定独立模型，未配置时功能将不起作用。
          </p>
        </div>

        {MODEL_SLOTS.map((slot) => (
          <div
            key={slot.key}
            className="bg-secondary flex items-center justify-between rounded-lg px-3 py-2.5"
          >
            <div className="flex min-w-0 flex-col">
              <div className="flex items-center gap-1.5">
                <Label className="text-sm font-medium">{slot.title}</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex shrink-0 rounded p-0.5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                      aria-label="说明"
                    >
                      <HelpCircle className="text-muted-foreground h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs">
                    {slot.tooltip}
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-muted-foreground mt-0.5 text-xs">{slot.description}</p>
            </div>
            <div className="ml-4 flex shrink-0 items-center gap-2">
              {slot.key === "memoryModel" && onMemoryConfigChange && (
                <Popover>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="hover:bg-primary/10 hover:text-primary h-8 w-8"
                          aria-label="记忆配置"
                        >
                          <Settings2 className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-background text-xs">记忆配置</div>
                    </TooltipContent>
                  </Tooltip>
                  <PopoverContent align="end" className="w-64">
                    <PopoverHeader>
                      <PopoverTitle className="text-sm">记忆配置</PopoverTitle>
                    </PopoverHeader>
                    <div className="grid gap-3">
                      <div className="grid gap-1.5">
                        <Label className="text-xs">最大用户全局记忆条数</Label>
                        <Input
                          type="number"
                          min={MEMORY_MIN}
                          max={MEMORY_MAX}
                          value={maxUser}
                          onChange={(e) =>
                            updateMemory(
                              "maxUserMemories",
                              parseInt(e.target.value, 10) || MEMORY_DEFAULT,
                            )
                          }
                          className="h-8"
                        />
                      </div>
                      <div className="grid gap-1.5">
                        <Label className="text-xs">最大智能体专属记忆条数</Label>
                        <Input
                          type="number"
                          min={MEMORY_MIN}
                          max={MEMORY_MAX}
                          value={maxAgent}
                          onChange={(e) =>
                            updateMemory(
                              "maxAgentMemories",
                              parseInt(e.target.value, 10) || MEMORY_DEFAULT,
                            )
                          }
                          className="h-8"
                        />
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
              <div className="w-56">
                <AIModelSelector
                  modelType={slot.modelType}
                  value={getSlotValue(slot.key)}
                  onSelect={(id) => handleSlotChange(slot.key, id)}
                  triggerVariant="button"
                  placeholder={slot.key === "chat" ? "选择模型" : "不启用"}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  },
);

ModelSelector.displayName = "ModelSelector";
