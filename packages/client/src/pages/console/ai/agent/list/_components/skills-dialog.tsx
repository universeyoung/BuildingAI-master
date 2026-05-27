import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@buildingai/ui/components/ui/dialog";
import { Button } from "@buildingai/ui/components/ui/button";
import { Input } from "@buildingai/ui/components/ui/input";
import { Label } from "@buildingai/ui/components/ui/label";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { ScrollArea } from "@buildingai/ui/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Bot,
  Loader2,
  AlertCircle,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useState, useEffect } from "react";

export interface Skill {
  name: string;
  description: string;
  tags: string[];
}

export interface AgentSkillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  agentName: string;
  currentSkills?: Skill[];
  onSave?: (skills: Skill[]) => void;
}

export function AgentSkillDialog({
  open,
  onOpenChange,
  agentId,
  agentName,
  currentSkills = [],
  onSave,
}: AgentSkillDialogProps) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSkills, setExpandedSkills] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (open) {
      setSkills(currentSkills.length > 0 ? [...currentSkills] : []);
      setError(null);
      setExpandedSkills(new Set());
    }
  }, [open, currentSkills]);

  const handleAddSkill = () => {
    setSkills([
      ...skills,
      {
        name: "",
        description: "",
        tags: [],
      },
    ]);
    setExpandedSkills((prev) => new Set([...prev, skills.length]));
  };

  const handleRemoveSkill = (index: number) => {
    setSkills(skills.filter((_, i) => i !== index));
    setExpandedSkills((prev) => {
      const newSet = new Set<number>();
      prev.forEach((i) => {
        if (i < index) {
          newSet.add(i);
        } else if (i > index) {
          newSet.add(i - 1);
        }
      });
      return newSet;
    });
  };

  const handleSkillChange = (index: number, field: keyof Skill, value: string) => {
    setSkills((prev) => {
      const updated = [...prev];
      if (field === "tags") {
        const tagArray = value
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t.length > 0);
        updated[index] = { ...updated[index], tags: tagArray };
      } else {
        updated[index] = { ...updated[index], [field]: value };
      }
      return updated;
    });
  };

  const toggleExpand = (index: number) => {
    setExpandedSkills((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const validateSkills = (): boolean => {
    for (let i = 0; i < skills.length; i++) {
      const skill = skills[i];
      if (!skill.name.trim()) {
        setError(`第 ${i + 1} 个技能的名称不能为空`);
        return false;
      }
      if (!skill.description.trim()) {
        setError(`第 ${i + 1} 个技能的描述不能为空`);
        return false;
      }
    }
    setError(null);
    return true;
  };

  const handleSave = async () => {
    if (!validateSkills()) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/teams/agents/${agentId}/skills`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ skills }),
      });

      if (!response.ok) {
        throw new Error("保存失败");
      }

      toast({
        title: "保存成功",
        description: "智能体技能配置已更新",
      });

      onSave?.(skills);
      onOpenChange(false);
    } catch (error: any) {
      const errorMessage = error?.message || "保存失败，请重试";
      setError(errorMessage);
      console.error("保存技能失败:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="size-5" />
            {agentName} · 技能配置
          </DialogTitle>
          <DialogDescription>
            为智能体配置本地技能，每个技能包含名称、描述和标签
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden py-4">
          {error && (
            <div className="mb-4 flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {skills.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Sparkles className="text-muted-foreground size-12 mb-3" />
                  <p className="text-muted-foreground mb-4">还没有配置任何技能</p>
                  <Button variant="outline" size="sm" onClick={handleAddSkill}>
                    <Plus className="size-4 mr-2" />
                    添加技能
                  </Button>
                </div>
              ) : (
                <>
                  {skills.map((skill, index) => (
                    <div
                      key={index}
                      className="border rounded-lg overflow-hidden bg-card"
                    >
                      <div
                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                        onClick={() => toggleExpand(index)}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <Sparkles className="size-4 shrink-0 text-primary" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">
                              {skill.name || `技能 ${index + 1}`}
                            </div>
                            {skill.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {skill.tags.slice(0, 3).map((tag, tagIndex) => (
                                  <Badge
                                    key={tagIndex}
                                    variant="secondary"
                                    className="text-xs font-normal"
                                  >
                                    {tag}
                                  </Badge>
                                ))}
                                {skill.tags.length > 3 && (
                                  <Badge
                                    variant="secondary"
                                    className="text-xs font-normal"
                                  >
                                    +{skill.tags.length - 3}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveSkill(index);
                            }}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                          {expandedSkills.has(index) ? (
                            <ChevronUp className="size-4" />
                          ) : (
                            <ChevronDown className="size-4" />
                          )}
                        </div>
                      </div>

                      {expandedSkills.has(index) && (
                        <div className="px-4 pb-4 pt-0 space-y-4 border-t bg-muted/30">
                          <div className="space-y-2 pt-4">
                            <Label htmlFor={`skill-name-${index}`}>技能名称</Label>
                            <Input
                              id={`skill-name-${index}`}
                              placeholder="例如：代码审查、数据分析、文档写作"
                              value={skill.name}
                              onChange={(e) =>
                                handleSkillChange(index, "name", e.target.value)
                              }
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`skill-desc-${index}`}>技能描述</Label>
                            <Input
                              id={`skill-desc-${index}`}
                              placeholder="描述这个技能的功能和用途"
                              value={skill.description}
                              onChange={(e) =>
                                handleSkillChange(index, "description", e.target.value)
                              }
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`skill-tags-${index}`}>技能标签</Label>
                            <Input
                              id={`skill-tags-${index}`}
                              placeholder="用逗号分隔多个标签，例如：后端,Python,API"
                              value={skill.tags.join(", ")}
                              onChange={(e) =>
                                handleSkillChange(index, "tags", e.target.value)
                              }
                            />
                            <p className="text-xs text-muted-foreground">
                              输入逗号分隔的标签，例如：代码,Python,后端
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddSkill}
                    className="w-full"
                  >
                    <Plus className="size-4 mr-2" />
                    添加技能
                  </Button>
                </>
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={isSaving || skills.length === 0}>
            {isSaving ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                保存中...
              </>
            ) : (
              "保存"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
