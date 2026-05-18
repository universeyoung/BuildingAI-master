import { Input } from "@buildingai/ui/components/ui/input";
import { Label } from "@buildingai/ui/components/ui/label";
import { memo } from "react";

export interface AgentFeaturesProps {
  maxSteps: number;
  onChange: (updates: { maxSteps?: number }) => void;
}

export const AgentFeatures = memo(({ maxSteps, onChange }: AgentFeaturesProps) => {
  return (
    <div className="bg-secondary flex items-center justify-between rounded-lg px-3 py-2.5">
      <div className="flex flex-col">
        <Label className="text-sm font-medium">最大执行步数</Label>
        <p className="text-muted-foreground mt-0.5 text-xs">工具循环的最大步数（1~50），默认 10</p>
      </div>
      <Input
        type="number"
        min={1}
        max={50}
        className="bg-background w-20"
        value={maxSteps}
        onChange={(e) => {
          const v = parseInt(e.target.value, 10);
          if (!isNaN(v) && v >= 1 && v <= 50) {
            onChange({ maxSteps: v });
          }
        }}
      />
    </div>
  );
});

AgentFeatures.displayName = "AgentFeatures";
