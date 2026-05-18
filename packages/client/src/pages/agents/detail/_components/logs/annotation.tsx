import type { AgentAnnotationRecord } from "@buildingai/services/web";
import {
  listAgentAnnotations,
  updateAgentConfig,
  useAgentAnnotationsQuery,
  useAgentDetailQuery,
  useCreateAgentAnnotationMutation,
  useDeleteAgentAnnotationMutation,
  useDeleteAllAgentAnnotationsMutation,
  useImportAgentAnnotationsMutation,
  useUpdateAgentAnnotationMutation,
} from "@buildingai/services/web";
import type { AnnotationConfig } from "@buildingai/types";
import { Button } from "@buildingai/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@buildingai/ui/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@buildingai/ui/components/ui/dropdown-menu";
import { Input } from "@buildingai/ui/components/ui/input";
import { Label } from "@buildingai/ui/components/ui/label";
import { Slider } from "@buildingai/ui/components/ui/slider";
import { Switch } from "@buildingai/ui/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@buildingai/ui/components/ui/table";
import { Textarea } from "@buildingai/ui/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@buildingai/ui/components/ui/tooltip";
import { useAlertDialog } from "@buildingai/ui/hooks/use-alert-dialog";
import { usePagination } from "@buildingai/ui/hooks/use-pagination";
import { cn } from "@buildingai/ui/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import {
  Download,
  FileUp,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  Settings2,
  Trash2,
  User,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { ModelSelector } from "@/components/ask-assistant-ui";
import { FileFormatIcon } from "@/components/file-fomat-icons";
import { RightFloatingPanel } from "@/components/right-floating-panel";

const ANNOTATION_THRESHOLD_MIN = 0.85;
const ANNOTATION_THRESHOLD_MAX = 1;
const ANNOTATION_THRESHOLD_DEFAULT = 0.9;

const CSV_TEMPLATE = ["问题,回答", "问题 1,回答 1", "问题 2,回答 2"].join("\n");

function clampThreshold(v: number): number {
  return Math.min(ANNOTATION_THRESHOLD_MAX, Math.max(ANNOTATION_THRESHOLD_MIN, v));
}

function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type AnnotationProps = { agentId: string };

const TABLE_PAGE_SIZE = 25;

function formatDateTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function Annotation({ agentId }: AnnotationProps) {
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importDragOver, setImportDragOver] = useState(false);
  const [threshold, setThreshold] = useState(ANNOTATION_THRESHOLD_DEFAULT);
  const [vectorModelId, setVectorModelId] = useState("");
  const [editing, setEditing] = useState<AgentAnnotationRecord | null>(null);
  const [formQuestion, setFormQuestion] = useState("");
  const [formAnswer, setFormAnswer] = useState("");
  const importInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { confirm: alertConfirm } = useAlertDialog();

  const { data: agent } = useAgentDetailQuery(agentId, { enabled: !!agentId });
  const annotationConfig = agent?.annotationConfig ?? null;
  const annotationEnabled = annotationConfig?.enabled ?? false;

  const queryParams = useMemo(
    () => ({
      page,
      pageSize: TABLE_PAGE_SIZE,
      keyword: keyword.trim() || undefined,
    }),
    [page, keyword],
  );

  const { data, isLoading } = useAgentAnnotationsQuery(agentId || undefined, queryParams, {
    enabled: !!agentId,
  });
  const createMutation = useCreateAgentAnnotationMutation(agentId);
  const updateMutation = useUpdateAgentAnnotationMutation(agentId);
  const deleteMutation = useDeleteAgentAnnotationMutation(agentId);
  const deleteAllMutation = useDeleteAllAgentAnnotationsMutation(agentId);
  const importMutation = useImportAgentAnnotationsMutation(agentId);

  const openSettings = useCallback(() => {
    setThreshold(clampThreshold(annotationConfig?.threshold ?? ANNOTATION_THRESHOLD_DEFAULT));
    setVectorModelId(annotationConfig?.vectorModelId ?? "");
    setSettingsOpen(true);
  }, [annotationConfig?.threshold, annotationConfig?.vectorModelId]);

  const saveAnnotationSettings = useCallback(async () => {
    if (!agentId) return;
    const next: AnnotationConfig = {
      ...annotationConfig,
      enabled: annotationConfig?.enabled ?? false,
      threshold: clampThreshold(threshold),
      vectorModelId: vectorModelId?.trim() || undefined,
    };
    try {
      await updateAgentConfig(agentId, { annotationConfig: next });
      queryClient.invalidateQueries({ queryKey: ["agents", "detail", agentId] });
      toast.success("已保存");
      setSettingsOpen(false);
    } catch {
      toast.error("保存失败");
    }
  }, [agentId, annotationConfig, threshold, vectorModelId, queryClient]);

  const handleAnnotationEnabledChange = useCallback(
    async (checked: boolean) => {
      if (!agentId) return;
      if (checked && !annotationConfig?.vectorModelId) {
        toast.info("请先配置向量模型后再开启标注回复");
        openSettings();
        return;
      }
      const next: AnnotationConfig = {
        ...annotationConfig,
        enabled: checked,
        threshold: annotationConfig?.threshold ?? ANNOTATION_THRESHOLD_DEFAULT,
        vectorModelId: annotationConfig?.vectorModelId,
      };
      try {
        await updateAgentConfig(agentId, { annotationConfig: next });
        queryClient.invalidateQueries({ queryKey: ["agents", "detail", agentId] });
        toast.success(checked ? "已开启标注回复" : "已关闭标注回复");
      } catch {
        toast.error("操作失败");
      }
    },
    [agentId, annotationConfig, queryClient, openSettings],
  );

  const handleDeleteAll = useCallback(async () => {
    try {
      await alertConfirm({
        title: "删除全部标注",
        description: "确定要删除该智能体下的全部标注吗？此操作不可恢复。",
        confirmText: "删除全部",
        confirmVariant: "destructive",
      });
    } catch {
      return;
    }
    try {
      const { deleted } = await deleteAllMutation.mutateAsync();
      toast.success(`已删除 ${deleted} 条标注`);
    } catch {
      toast.error("删除失败");
    }
  }, [alertConfirm, deleteAllMutation]);

  const handleExport = useCallback(async () => {
    if (!agentId) return;
    try {
      const res = await listAgentAnnotations(agentId, { page: 1, pageSize: 10000 });
      const rows = (res.items ?? []).map((a) => [
        escapeCsvField(a.question ?? ""),
        escapeCsvField(a.answer ?? ""),
      ]);
      const header = "问题,回答";
      const content = [header, ...rows.map((r) => r.join(","))].join("\n");
      downloadCsv(`标注导出-${Date.now()}.csv`, content);
      toast.success("导出成功");
    } catch {
      toast.error("导出失败");
    }
  }, [agentId]);

  const handleDownloadTemplate = useCallback(() => {
    downloadCsv("标注导入模板.csv", CSV_TEMPLATE);
  }, []);

  const handleImportClick = useCallback(() => {
    setImportDialogOpen(true);
    setImportFile(null);
  }, []);

  const onImportFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file && (file.name.endsWith(".csv") || file.type === "text/csv")) {
      setImportFile(file);
    } else if (file) {
      toast.error("请选择 CSV 文件");
    }
  }, []);

  const handleImportSubmit = useCallback(async () => {
    if (!importFile || !agentId) {
      toast.error("请先选择 CSV 文件");
      return;
    }
    try {
      const { imported } = await importMutation.mutateAsync(importFile);
      if (imported > 0) {
        toast.success(`已导入 ${imported} 条标注`);
        setImportDialogOpen(false);
        setImportFile(null);
      } else {
        toast.warning(
          "导入 0 条。请确认 CSV 表头为「问题」「回答」，数据行非空；若问题已存在则会跳过。可查看服务端日志排查。",
        );
      }
    } catch {
      toast.error("导入失败，请检查文件格式或网络");
    }
  }, [agentId, importFile, importMutation]);

  const onImportDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setImportDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith(".csv") || file.type === "text/csv")) {
      setImportFile(file);
    } else if (file) {
      toast.error("请选择 CSV 文件");
    }
  }, []);

  const onImportDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setImportDragOver(true);
  }, []);

  const onImportDragLeave = useCallback(() => {
    setImportDragOver(false);
  }, []);

  const openCreate = useCallback(() => {
    setEditing(null);
    setFormQuestion("");
    setFormAnswer("");
    setPanelOpen(true);
  }, []);

  const openEdit = useCallback((row: AgentAnnotationRecord) => {
    setEditing(row);
    setFormQuestion(row.question ?? "");
    setFormAnswer(row.answer ?? "");
    setPanelOpen(true);
  }, []);

  const handleSubmit = useCallback(async () => {
    const q = formQuestion.trim();
    if (!q || !formAnswer.trim()) {
      toast.error("请填写问题和答案");
      return;
    }
    try {
      if (editing) {
        await updateMutation.mutateAsync({
          annotationId: editing.id,
          params: { question: q, answer: formAnswer, enabled: true },
        });
        toast.success("已更新");
      } else {
        await createMutation.mutateAsync({
          question: q,
          answer: formAnswer,
          enabled: true,
        });
        toast.success("已创建");
      }
      setPanelOpen(false);
    } catch {
      toast.error(editing ? "更新失败" : "创建失败");
    }
  }, [editing, formQuestion, formAnswer, updateMutation, createMutation]);

  const handleDelete = useCallback(
    async (row: AgentAnnotationRecord) => {
      try {
        await alertConfirm({
          title: "删除标注",
          description: "确定要删除这条标注吗？",
          confirmText: "删除",
          confirmVariant: "destructive",
        });
      } catch {
        return;
      }
      try {
        await deleteMutation.mutateAsync(row.id);
        toast.success("已删除");
      } catch {
        toast.error("删除失败");
      }
    },
    [alertConfirm, deleteMutation],
  );

  const handleDeleteFromPanel = useCallback(async () => {
    if (!editing) return;
    try {
      await alertConfirm({
        title: "删除标注",
        description: "确定要删除此标注吗？",
        confirmText: "删除",
        confirmVariant: "destructive",
      });
    } catch {
      return;
    }
    try {
      await deleteMutation.mutateAsync(editing.id);
      toast.success("已删除");
      setPanelOpen(false);
      setEditing(null);
    } catch {
      toast.error("删除失败");
    }
  }, [editing, alertConfirm, deleteMutation]);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const { PaginationComponent, totalPages } = usePagination({
    total,
    pageSize: TABLE_PAGE_SIZE,
    page,
    onPageChange: setPage,
  });
  const showPagination = totalPages > 1;

  return (
    <>
      <div className="flex h-full min-h-0 flex-col rounded-lg">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 pb-3">
          <Input
            type="text"
            placeholder="搜索"
            value={keyword}
            className="w-70"
            onChange={(e) => {
              setKeyword(e.target.value);
              setPage(1);
            }}
          />
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">标注回复</span>
            <Switch
              checked={annotationEnabled}
              onCheckedChange={handleAnnotationEnabledChange}
              disabled={!agentId}
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={openSettings}
                  disabled={!agentId}
                >
                  <Settings2 className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>问答标注设置</TooltipContent>
            </Tooltip>
            <Button className="h-8" size="sm" onClick={openCreate} disabled={!agentId}>
              <Plus className="mr-1 size-4" />
              添加标注
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="size-8" disabled={!agentId}>
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleImportClick}>
                  <FileUp className="mr-2 size-4" />
                  批量导入
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExport}>
                  <Download className="mr-2 size-4" />
                  批量导出
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDeleteAll} className="text-destructive">
                  <Trash2 className="mr-2 size-4" />
                  删除全部
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-0!">
                <TableHead
                  className="bg-muted w-[24%]"
                  style={{ borderRadius: "var(--radius) 0 0 var(--radius)" }}
                >
                  问题
                </TableHead>
                <TableHead className="bg-muted w-[28%]">答案</TableHead>
                <TableHead className="bg-muted w-18">命中</TableHead>
                <TableHead className="bg-muted w-18">启用</TableHead>
                <TableHead className="bg-muted w-32">更新时间</TableHead>
                <TableHead className="bg-muted w-32">创建时间</TableHead>
                <TableHead className="bg-muted w-16 rounded-r-lg text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((row) => (
                <TableRow key={row.id}>
                  <TableCell
                    className="max-w-[280px] truncate font-medium"
                    title={row.question ?? undefined}
                  >
                    {row.question?.trim() || "—"}
                  </TableCell>
                  <TableCell
                    className="text-muted-foreground max-w-[360px] truncate text-sm"
                    title={row.answer ?? undefined}
                  >
                    {row.answer?.trim() || "—"}
                  </TableCell>
                  <TableCell>{row.hitCount ?? 0}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {row.enabled ? "是" : "否"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDateTime(row.updatedAt)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDateTime(row.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(row)}>
                          <Pencil className="mr-2 size-4" />
                          编辑
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDelete(row)}
                        >
                          <Trash2 className="mr-2 size-4" />
                          删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {isLoading && items.length === 0 && (
            <div className="flex h-full w-full flex-col items-center justify-center text-center">
              <Loader2 className="text-muted-foreground size-6 animate-spin" />
            </div>
          )}
          {items.length === 0 && !isLoading && (
            <div className="flex h-full w-full flex-col items-center justify-center text-center">
              <p className="text-muted-foreground">暂无数据</p>
            </div>
          )}
        </div>
        {showPagination && (
          <div className="bg-background sticky bottom-0 z-2 flex shrink-0 py-2">
            <PaginationComponent className="mx-0 w-fit" />
          </div>
        )}
      </div>
      <RightFloatingPanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        title={editing ? "编辑标注回复" : "添加标注回复"}
        footer={
          <div className="flex items-center justify-between gap-2">
            {editing ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={handleDeleteFromPanel}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="mr-1.5 size-4" />
                删除此标注
              </Button>
            ) : (
              <div />
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setPanelOpen(false)}>
                取消
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={
                  createMutation.isPending ||
                  updateMutation.isPending ||
                  !formQuestion.trim() ||
                  !formAnswer.trim()
                }
                loading={createMutation.isPending || updateMutation.isPending}
              >
                {editing ? "保存" : "添加"}
              </Button>
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-5 px-4 py-4">
          <div className="grid gap-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <User className="size-4" />
              提问
            </Label>
            <Textarea
              value={formQuestion}
              onChange={(e) => setFormQuestion(e.target.value)}
              placeholder="输入提问"
              className="bg-muted/30 min-h-[120px] resize-y rounded-lg border"
              rows={5}
            />
          </div>
          <div className="grid gap-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <MessageSquare className="size-4" />
              回复
            </Label>
            <Textarea
              value={formAnswer}
              onChange={(e) => setFormAnswer(e.target.value)}
              placeholder="输入回复"
              className="bg-muted/30 min-h-[160px] resize-y rounded-lg border"
              rows={6}
            />
          </div>
        </div>
      </RightFloatingPanel>
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>问答标注设置</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>相似度阈值（{threshold.toFixed(2)}）</Label>
              <Slider
                value={[threshold]}
                onValueChange={([v]) =>
                  setThreshold(clampThreshold(v ?? ANNOTATION_THRESHOLD_DEFAULT))
                }
                min={ANNOTATION_THRESHOLD_MIN}
                max={ANNOTATION_THRESHOLD_MAX}
                step={0.01}
              />
              <p className="text-muted-foreground text-xs">
                仅当相似度 ≥ 阈值时命中标注，范围 0.85～1
              </p>
            </div>
            <div className="grid gap-2">
              <Label>向量模型</Label>
              <ModelSelector
                modelType="text-embedding"
                value={vectorModelId || undefined}
                onSelect={setVectorModelId}
                placeholder="选择向量模型（用于语义匹配）"
                triggerVariant="button"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSettingsOpen(false)}>
              取消
            </Button>
            <Button type="button" onClick={saveAnnotationSettings}>
              确定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={importDialogOpen}
        onOpenChange={(open) => {
          setImportDialogOpen(open);
          if (!open) setImportFile(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>批量导入</DialogTitle>
          </DialogHeader>
          <div
            className={cn(
              "bg-muted flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg py-10 transition-colors",
              importDragOver
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/30 bg-muted hover:bg-muted/80",
            )}
            onDrop={onImportDrop}
            onDragOver={onImportDragOver}
            onDragLeave={onImportDragLeave}
            onClick={() => importInputRef.current?.click()}
          >
            <input
              ref={importInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={onImportFileSelect}
            />
            <FileFormatIcon format="csv" className="text-primary size-10" />
            <p className="text-muted-foreground text-sm">
              {importFile ? importFile.name : "将您的 CSV 文件拖放到此处，或选择文件"}
            </p>
          </div>
          <p className="text-muted-foreground text-sm">CSV 文件必须符合以下结构:</p>
          <div className="w-full rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50%]">问题</TableHead>
                  <TableHead>回答</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>问题 1</TableCell>
                  <TableCell>回答 1</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>问题 2</TableCell>
                  <TableCell>回答 2</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <div className="flex w-full justify-start">
            <Button
              type="button"
              variant="link"
              className="text-primary h-auto p-0"
              onClick={handleDownloadTemplate}
            >
              <Download className="size-4" />
              下载模板
            </Button>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setImportDialogOpen(false)}>
              取消
            </Button>
            <Button
              type="button"
              onClick={handleImportSubmit}
              disabled={!importFile || importMutation.isPending}
              loading={importMutation.isPending}
            >
              导入
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
