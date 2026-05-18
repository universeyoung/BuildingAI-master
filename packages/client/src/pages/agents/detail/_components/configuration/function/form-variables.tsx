import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Checkbox } from "@buildingai/ui/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@buildingai/ui/components/ui/dialog";
import { Field, FieldGroup } from "@buildingai/ui/components/ui/field";
import { Input } from "@buildingai/ui/components/ui/input";
import { Label } from "@buildingai/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@buildingai/ui/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@buildingai/ui/components/ui/tooltip";
import { useAlertDialog } from "@buildingai/ui/hooks/use-alert-dialog";
import { cn } from "@buildingai/ui/lib/utils";
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlignLeft,
  GripVertical,
  Hash,
  HelpCircle,
  List,
  Pencil,
  Plus,
  Trash2,
  Type,
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";

type FormVariableType = "text" | "paragraph" | "select" | "number";

type SelectOption = {
  id: string;
  label: string;
};

type FormVariable = {
  id: string;
  type: FormVariableType;
  name: string;
  label: string;
  maxLength?: number;
  required: boolean;
  options?: SelectOption[];
};

const createId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const isValidVarName = (name: string) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);

function coerceFormVariables(input: unknown): FormVariable[] {
  if (!Array.isArray(input) || input.length === 0) return [];
  return input
    .map((raw, idx): FormVariable | null => {
      const item = raw as any;
      const name = typeof item?.name === "string" ? item.name.trim() : "";
      const label = typeof item?.label === "string" ? item.label.trim() : "";
      if (!name && !label) return null;

      const type: FormVariableType =
        item?.type === "text" ||
        item?.type === "paragraph" ||
        item?.type === "select" ||
        item?.type === "number"
          ? item.type
          : "text";

      const id =
        typeof item?.id === "string" && item.id.trim()
          ? item.id.trim()
          : name
            ? `name:${name}`
            : `idx:${idx}-${createId()}`;

      const required = !!item?.required;
      const maxLength =
        (type === "text" || type === "paragraph") &&
        typeof item?.maxLength === "number" &&
        Number.isFinite(item.maxLength)
          ? item.maxLength
          : undefined;

      const options =
        type === "select" && Array.isArray(item?.options)
          ? (item.options as any[])
              .map((opt, optIdx): SelectOption | null => {
                if (typeof opt === "string") {
                  const t = opt.trim();
                  if (!t) return null;
                  return { id: `opt:${id}:${optIdx}`, label: t };
                }
                const optLabel = typeof opt?.label === "string" ? opt.label.trim() : "";
                if (!optLabel) return null;
                const optId =
                  typeof opt?.id === "string" && opt.id.trim()
                    ? opt.id.trim()
                    : `opt:${id}:${optIdx}`;
                return { id: optId, label: optLabel };
              })
              .filter((x): x is SelectOption => Boolean(x))
          : undefined;

      return { id, type, name, label, required, maxLength, options };
    })
    .filter((x): x is FormVariable => Boolean(x));
}

const SelectOptionItem = memo(
  ({
    item,
    onChange,
    onDelete,
  }: {
    item: SelectOption;
    onChange: (id: string, label: string) => void;
    onDelete: (id: string) => void;
  }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: item.id,
    });

    return (
      <div
        ref={setNodeRef}
        style={{
          transform: CSS.Transform.toString(transform),
          transition,
        }}
        className={
          isDragging
            ? "bg-background/70 flex items-center gap-2 rounded-md border px-2"
            : "bg-background flex items-center gap-2 rounded-md border px-2"
        }
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </Button>
        <Input
          value={item.label}
          placeholder="选项标签"
          className={cn("border-0 pr-9 pl-0 shadow-none focus-visible:ring-0")}
          onChange={(e) => onChange(item.id, e.target.value)}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="hover:bg-destructive/10 hover:text-destructive h-8 w-8"
          onClick={() => onDelete(item.id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    );
  },
);

SelectOptionItem.displayName = "SelectOptionItem";

export const FormVariables = memo(
  ({ value, onChange }: { value: any[]; onChange: (value: any[]) => void }) => {
    const { confirm } = useAlertDialog();
    const sensors = useSensors(useSensor(PointerSensor));

    const [formVariables, setFormVariables] = useState<FormVariable[]>(() => {
      return coerceFormVariables(value);
    });
    const [formVariableDialogOpen, setFormVariableDialogOpen] = useState(false);
    const [editingFormVariableId, setEditingFormVariableId] = useState<string | null>(null);
    const [formVariableDraft, setFormVariableDraft] = useState<FormVariable | null>(null);

    useEffect(() => {
      setFormVariables(coerceFormVariables(value));
    }, [value]);

    const openCreateFormVariable = useCallback(() => {
      const id = createId();
      setEditingFormVariableId(null);
      setFormVariableDraft({
        id,
        type: "text",
        name: "",
        label: "",
        maxLength: undefined,
        required: false,
        options: undefined,
      });
      setFormVariableDialogOpen(true);
    }, []);

    const openEditFormVariable = useCallback((item: FormVariable) => {
      setEditingFormVariableId(item.id);
      setFormVariableDraft({
        ...item,
        options: item.type === "select" ? (item.options?.map((x) => ({ ...x })) ?? []) : undefined,
        maxLength: item.type === "text" || item.type === "paragraph" ? item.maxLength : undefined,
      });
      setFormVariableDialogOpen(true);
    }, []);

    const changeDraftType = useCallback((type: FormVariableType) => {
      setFormVariableDraft((prev) => {
        if (!prev) return prev;
        if (type === "select") {
          return {
            ...prev,
            type,
            options: prev.options?.length ? prev.options : [{ id: createId(), label: "" }],
          };
        }
        if (type === "number") {
          return { ...prev, type, maxLength: undefined, options: undefined };
        }
        return { ...prev, type, options: undefined };
      });
    }, []);

    const addSelectOption = useCallback(() => {
      setFormVariableDraft((prev) => {
        if (!prev || prev.type !== "select") return prev;
        const next = prev.options ?? [];
        return { ...prev, options: [...next, { id: createId(), label: "" }] };
      });
    }, []);

    const updateSelectOption = useCallback((id: string, label: string) => {
      setFormVariableDraft((prev) => {
        if (!prev || prev.type !== "select") return prev;
        return {
          ...prev,
          options: (prev.options ?? []).map((x) => (x.id === id ? { ...x, label } : x)),
        };
      });
    }, []);

    const deleteSelectOption = useCallback((id: string) => {
      setFormVariableDraft((prev) => {
        if (!prev || prev.type !== "select") return prev;
        return { ...prev, options: (prev.options ?? []).filter((x) => x.id !== id) };
      });
    }, []);

    const handleOptionDragEnd = useCallback((event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      setFormVariableDraft((prev) => {
        if (!prev || prev.type !== "select") return prev;
        const items = prev.options ?? [];
        const oldIndex = items.findIndex((x) => x.id === active.id);
        const newIndex = items.findIndex((x) => x.id === over.id);
        if (oldIndex < 0 || newIndex < 0) return prev;
        return { ...prev, options: arrayMove(items, oldIndex, newIndex) };
      });
    }, []);

    const canSubmitFormVariable = useMemo(() => {
      if (!formVariableDraft) return false;
      const name = formVariableDraft.name.trim();
      const label = formVariableDraft.label.trim();
      if (!name || !label) return false;
      if (!isValidVarName(name)) return false;
      if (formVariableDraft.maxLength !== undefined && Number.isNaN(formVariableDraft.maxLength)) {
        return false;
      }
      if (formVariableDraft.maxLength !== undefined) {
        if (!Number.isInteger(formVariableDraft.maxLength) || formVariableDraft.maxLength <= 0)
          return false;
      }
      if (formVariableDraft.type === "select") {
        const opts = (formVariableDraft.options ?? []).map((x) => x.label.trim()).filter(Boolean);
        if (opts.length === 0) return false;
      }
      return true;
    }, [formVariableDraft]);

    const submitFormVariable = useCallback(() => {
      if (!formVariableDraft) return;
      const normalized: FormVariable = {
        ...formVariableDraft,
        name: formVariableDraft.name.trim(),
        label: formVariableDraft.label.trim(),
        maxLength:
          formVariableDraft.type === "text" || formVariableDraft.type === "paragraph"
            ? formVariableDraft.maxLength === undefined || Number.isNaN(formVariableDraft.maxLength)
              ? undefined
              : formVariableDraft.maxLength
            : undefined,
        options:
          formVariableDraft.type === "select"
            ? (formVariableDraft.options ?? [])
                .map((x) => ({ ...x, label: x.label.trim() }))
                .filter((x) => x.label)
            : undefined,
      };

      setFormVariables((prev) => {
        const next = !editingFormVariableId
          ? [...prev, normalized]
          : prev.map((x) => (x.id === editingFormVariableId ? normalized : x));
        onChange(next);
        return next;
      });
      setFormVariableDialogOpen(false);
    }, [editingFormVariableId, formVariableDraft, onChange]);

    const deleteFormVariable = useCallback(
      async (item: FormVariable) => {
        try {
          await confirm({
            title: "删除表单变量",
            description: "确定要删除该表单变量吗？",
            confirmText: "删除",
            confirmVariant: "destructive",
          });
        } catch {
          return;
        }
        setFormVariables((prev) => {
          const next = prev.filter((x) => x.id !== item.id);
          onChange(next);
          return next;
        });
      },
      [confirm, onChange],
    );

    const typeLabel = useCallback((type: FormVariableType) => {
      if (type === "text") return "文本输入";
      if (type === "paragraph") return "段落";
      if (type === "select") return "下拉选项";
      return "数字";
    }, []);

    const valueTypeLabel = useCallback(
      (type: FormVariableType) => (type === "number" ? "number" : "string"),
      [],
    );

    return (
      <div className="bg-secondary rounded-lg px-3 py-2.5">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <div className="flex items-center gap-1">
              <h3 className="text-sm font-medium">表单变量</h3>
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="text-muted-foreground h-4 w-4" />
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-background text-xs">
                    变量将以表单形式让用户在对话前填写 <br />
                    用户填写的表单内容将自动替换角色设定中的变量。
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>
            <p className="text-muted-foreground mt-0.5 text-xs">
              变量是智能体的临时记忆，让对话有上下文。
            </p>
          </div>
          <Button
            variant="ghost"
            size="xs"
            className="hover:bg-primary/10 hover:text-primary"
            onClick={openCreateFormVariable}
          >
            <Plus className="h-4 w-4" />
            <span>添加</span>
          </Button>
        </div>

        {formVariables.length > 0 && (
          <div className="mt-3 space-y-2">
            {formVariables.map((item) => (
              <div
                key={item.id}
                className="group/form-variable bg-background relative flex items-center gap-2 rounded-md py-2 pr-2 pl-3"
              >
                <div className="flex min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="min-w-0 truncate text-sm font-medium">{item.label}</div>
                    <div className="text-muted-foreground truncate text-xs">{item.name}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 group-hover/form-variable:opacity-0">
                  {item.required && <Badge variant="secondary">REQUIRED</Badge>}
                  <Badge variant="outline">{valueTypeLabel(item.type)}</Badge>
                  <Badge variant="outline">{typeLabel(item.type)}</Badge>
                </div>
                <div className="absolute right-1 flex items-center opacity-0 transition-opacity group-hover/form-variable:opacity-100">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openEditFormVariable(item)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="hover:bg-destructive/10 hover:text-destructive h-8 w-8"
                    onClick={() => deleteFormVariable(item)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog
          open={formVariableDialogOpen}
          onOpenChange={(open) => {
            setFormVariableDialogOpen(open);
            if (!open) {
              setEditingFormVariableId(null);
              setFormVariableDraft(null);
            }
          }}
        >
          <DialogContent className="flex max-h-[70vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
            <DialogHeader className="shrink-0 px-4 pt-4">
              <DialogTitle>{editingFormVariableId ? "编辑表单变量" : "添加表单变量"}</DialogTitle>
              <div className="text-muted-foreground mt-1 text-sm">
                配置表单字段，用户填写后将自动替换角色设定中的变量{"{{变量名}}"}
              </div>
            </DialogHeader>

            <div className="min-h-0 flex-1 px-4 pt-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm">
                    字段类型<span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formVariableDraft?.type ?? "text"}
                    onValueChange={(v) => changeDraftType(v as FormVariableType)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="选择字段类型" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">
                        <span className="flex w-full items-center justify-between">
                          <span className="flex items-center gap-2">
                            <Type className="h-4 w-4" />
                            <span>文本</span>
                          </span>
                          <Badge variant="outline">string</Badge>
                        </span>
                      </SelectItem>
                      <SelectItem value="paragraph">
                        <span className="flex w-full items-center justify-between">
                          <span className="flex items-center gap-2">
                            <AlignLeft className="h-4 w-4" />
                            <span>段落</span>
                          </span>
                          <Badge variant="outline">string</Badge>
                        </span>
                      </SelectItem>
                      <SelectItem value="select">
                        <span className="flex w-full items-center justify-between">
                          <span className="flex items-center gap-2">
                            <List className="h-4 w-4" />
                            <span>下拉选项</span>
                          </span>
                          <Badge variant="outline">string</Badge>
                        </span>
                      </SelectItem>
                      <SelectItem value="number">
                        <span className="flex w-full items-center justify-between">
                          <span className="flex items-center gap-2">
                            <Hash className="h-4 w-4" />
                            <span>数字</span>
                          </span>
                          <Badge variant="outline">number</Badge>
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">
                    变量名<span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={formVariableDraft?.name ?? ""}
                    placeholder="请输入变量名，只可以设置为英文、数字下划线等"
                    onChange={(e) =>
                      setFormVariableDraft((prev) =>
                        prev ? { ...prev, name: e.target.value } : prev,
                      )
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">
                    显示名称<span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={formVariableDraft?.label ?? ""}
                    placeholder="请输入显示名称"
                    onChange={(e) =>
                      setFormVariableDraft((prev) =>
                        prev ? { ...prev, label: e.target.value } : prev,
                      )
                    }
                  />
                </div>

                {(formVariableDraft?.type === "text" ||
                  formVariableDraft?.type === "paragraph") && (
                  <div className="space-y-2">
                    <Label className="text-sm">最大长度</Label>
                    <Input
                      inputMode="numeric"
                      value={
                        formVariableDraft?.maxLength === undefined
                          ? ""
                          : String(formVariableDraft.maxLength)
                      }
                      placeholder="请输入最大长度限制"
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === "") {
                          setFormVariableDraft((prev) =>
                            prev ? { ...prev, maxLength: undefined } : prev,
                          );
                          return;
                        }
                        const num = Number(raw);
                        setFormVariableDraft((prev) =>
                          prev
                            ? {
                                ...prev,
                                maxLength: Number.isFinite(num) ? num : prev.maxLength,
                              }
                            : prev,
                        );
                      }}
                    />
                  </div>
                )}

                {formVariableDraft?.type === "select" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">选项列表</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        className="hover:bg-primary/10 hover:text-primary"
                        onClick={addSelectOption}
                      >
                        <Plus className="h-4 w-4" />
                        <span>添加选项</span>
                      </Button>
                    </div>
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleOptionDragEnd}
                    >
                      <SortableContext
                        items={(formVariableDraft.options ?? []).map((x) => x.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-2">
                          {(formVariableDraft.options ?? []).map((opt) => (
                            <SelectOptionItem
                              key={opt.id}
                              item={opt}
                              onChange={updateSelectOption}
                              onDelete={deleteSelectOption}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <FieldGroup className="mb-1">
                    <Field orientation="horizontal" className="items-center gap-2">
                      <Checkbox
                        id="required-checkbox"
                        checked={!!formVariableDraft?.required}
                        onCheckedChange={(v) =>
                          setFormVariableDraft((prev) => (prev ? { ...prev, required: !!v } : prev))
                        }
                      />
                      <Label htmlFor="required-checkbox">必填</Label>
                    </Field>
                  </FieldGroup>
                </div>

                {formVariableDraft?.name.trim() &&
                  !isValidVarName(formVariableDraft.name.trim()) && (
                    <div className="text-destructive text-sm">
                      变量名仅支持英文、数字、下划线，且不能以数字开头
                    </div>
                  )}
              </div>
            </div>

            <DialogFooter className="shrink-0 px-4 py-4">
              <DialogClose asChild>
                <Button variant="outline">取消</Button>
              </DialogClose>
              <Button onClick={submitFormVariable} disabled={!canSubmitFormVariable}>
                保存
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  },
);

FormVariables.displayName = "FormVariables";
