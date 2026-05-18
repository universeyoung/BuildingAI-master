import { RETRIEVAL_MODE } from "@buildingai/constants/shared/datasets.constants";
import {
  getDatasetDetail,
  useMyCreatedDatasetsInfiniteQuery,
  useTeamDatasetsInfiniteQuery,
} from "@buildingai/services/web";
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
import { Input } from "@buildingai/ui/components/ui/input";
import { ScrollArea } from "@buildingai/ui/components/ui/scroll-area";
import { Spinner } from "@buildingai/ui/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@buildingai/ui/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@buildingai/ui/components/ui/tooltip";
import { cn } from "@buildingai/ui/lib/utils";
import { useQueries } from "@tanstack/react-query";
import { HelpCircle, Plus, Trash2, X } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

type KnowledgeBaseProps = {
  value: string[];
  onChange: (value: string[]) => void;
};

type KnowledgeBaseTab = "my" | "team";

const RETRIEVAL_MODE_LABEL: Record<string, string> = {
  [RETRIEVAL_MODE.VECTOR]: "向量检索",
  [RETRIEVAL_MODE.FULL_TEXT]: "全文检索",
  [RETRIEVAL_MODE.HYBRID]: "混合检索",
};

export const KnowledgeBase = memo(({ value, onChange }: KnowledgeBaseProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<KnowledgeBaseTab>("my");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>(() => value ?? []);
  const [displayCache, setDisplayCache] = useState<
    Map<string, { name: string; retrievalMode?: string }>
  >(new Map());

  const pageSize = 20;
  const leftViewportMyRef = useRef<HTMLDivElement | null>(null);
  const leftViewportTeamRef = useRef<HTMLDivElement | null>(null);
  const sentinelMyRef = useRef<HTMLDivElement | null>(null);
  const sentinelTeamRef = useRef<HTMLDivElement | null>(null);

  const myQuery = useMyCreatedDatasetsInfiniteQuery(pageSize, {
    enabled: dialogOpen && activeTab === "my",
  });
  const teamQuery = useTeamDatasetsInfiniteQuery(pageSize, {
    enabled: dialogOpen && activeTab === "team",
  });

  useEffect(() => {
    setSelectedIds(value ?? []);
  }, [value]);

  const myDatasets = useMemo(
    () => myQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [myQuery.data?.pages],
  );

  const teamDatasets = useMemo(
    () => teamQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [teamQuery.data?.pages],
  );

  const allDatasetsMap = useMemo(() => {
    const map = new Map<string, { id: string; name: string; retrievalMode?: string }>();
    for (const d of myDatasets) {
      map.set(d.id, { id: d.id, name: d.name, retrievalMode: d.retrievalMode });
    }
    for (const d of teamDatasets) {
      if (!map.has(d.id)) {
        map.set(d.id, {
          id: d.id,
          name: d.name,
          retrievalMode: d.retrievalMode,
        });
      }
    }
    return map;
  }, [myDatasets, teamDatasets]);

  const idsToFetch = useMemo(
    () => (value ?? []).filter((id) => !displayCache.has(id)),
    [value, displayCache],
  );
  const selectedDetailsQueries = useQueries({
    queries: idsToFetch.map((id) => ({
      queryKey: ["datasets", id] as const,
      queryFn: () => getDatasetDetail(id),
      enabled: true,
    })),
  });
  const selectedDetailsList = useMemo(() => {
    const queryResultById = new Map<string, { name: string; retrievalMode?: string }>();
    idsToFetch.forEach((id, index) => {
      const res = selectedDetailsQueries[index]?.data;
      if (res) queryResultById.set(id, { name: res.name, retrievalMode: res.retrievalMode });
    });
    return (value ?? []).map((id) => {
      const cached = displayCache.get(id);
      if (cached) return { id, name: cached.name, retrievalMode: cached.retrievalMode };
      const res = queryResultById.get(id);
      const queryIndex = idsToFetch.indexOf(id);
      const isLoading = selectedDetailsQueries[queryIndex]?.isLoading;
      return {
        id,
        name: res?.name ?? (isLoading ? "加载中..." : `ID: ${id}`),
        retrievalMode: res?.retrievalMode,
      };
    });
  }, [value, displayCache, idsToFetch, selectedDetailsQueries]);

  const availableDatasets = useMemo(() => {
    const base = activeTab === "my" ? myDatasets : teamDatasets;
    const keyword = searchKeyword.trim().toLowerCase();
    if (!keyword) return base;
    return base.filter((d) => d.name.toLowerCase().includes(keyword));
  }, [activeTab, myDatasets, teamDatasets, searchKeyword]);

  const hasMore = activeTab === "my" ? myQuery.hasNextPage : teamQuery.hasNextPage;
  const loadingMore =
    activeTab === "my" ? myQuery.isFetchingNextPage : teamQuery.isFetchingNextPage;

  const handleOpenDialog = useCallback(() => {
    setSelectedIds(value ?? []);
    setSearchKeyword("");
    setActiveTab("my");
    setDialogOpen(true);
  }, [value]);

  const handleConfirm = useCallback(() => {
    setDisplayCache((prev) => {
      const next = new Map(prev);
      for (const id of selectedIds) {
        const meta = allDatasetsMap.get(id);
        if (meta) next.set(id, { name: meta.name, retrievalMode: meta.retrievalMode });
      }
      return next;
    });
    onChange(selectedIds);
    setDialogOpen(false);
  }, [onChange, selectedIds, allDatasetsMap]);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  }, []);

  const handleRemoveSelected = useCallback((id: string) => {
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  }, []);

  const handleClearSelected = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const handleLoadMore = useCallback(() => {
    if (activeTab === "my") {
      if (myQuery.hasNextPage && !myQuery.isFetchingNextPage) {
        void myQuery.fetchNextPage();
      }
    } else if (teamQuery.hasNextPage && !teamQuery.isFetchingNextPage) {
      void teamQuery.fetchNextPage();
    }
  }, [
    activeTab,
    myQuery.hasNextPage,
    myQuery.isFetchingNextPage,
    myQuery.fetchNextPage,
    teamQuery.hasNextPage,
    teamQuery.isFetchingNextPage,
    teamQuery.fetchNextPage,
  ]);

  useEffect(() => {
    const root = activeTab === "my" ? leftViewportMyRef.current : leftViewportTeamRef.current;
    const sentinel = activeTab === "my" ? sentinelMyRef.current : sentinelTeamRef.current;
    if (!root || !sentinel || !hasMore || loadingMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) handleLoadMore();
      },
      { root, rootMargin: "100px", threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [activeTab, hasMore, loadingMore, handleLoadMore]);

  const selectedDatasets = useMemo(
    () =>
      selectedIds.map((id) => {
        const meta = allDatasetsMap.get(id);
        return {
          id,
          name: meta?.name ?? `未加载的知识库（ID: ${id}）`,
          retrievalMode: meta?.retrievalMode,
        };
      }),
    [allDatasetsMap, selectedIds],
  );

  return (
    <div className="bg-secondary rounded-lg px-3 py-2.5">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <div className="flex items-center gap-1">
            <h3 className="text-sm font-medium">关联知识库</h3>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="text-muted-foreground h-4 w-4" />
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-background text-xs">
                  选择智能体可以访问的知识库 <br />
                  智能体将根据这些知识库的内容回答用户问题。
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
          <p className="text-muted-foreground mt-0.5 text-xs">
            您可以选择一个或多个知识库作为上下文来源
          </p>
        </div>
        <Button
          variant="ghost"
          size="xs"
          className="hover:bg-primary/10 hover:text-primary"
          onClick={handleOpenDialog}
        >
          <Plus className="h-4 w-4" />
          <span>{value.length ? `已选 ${value.length} 个` : "添加"}</span>
        </Button>
      </div>

      {value.length > 0 && (
        <div className="mt-3 space-y-2">
          {selectedDetailsList.map((item) => (
            <div
              key={item.id}
              className="group/kb-item bg-background relative flex items-center justify-between gap-2 rounded-md py-1.5 pr-1.5 pl-3"
            >
              <div className="min-w-0 truncate text-sm font-medium">{item.name}</div>

              <div className="relative flex items-center gap-1">
                {item.retrievalMode && (
                  <Badge
                    variant="outline"
                    className="shrink-0 text-xs group-hover/kb-item:opacity-0"
                  >
                    {RETRIEVAL_MODE_LABEL[item.retrievalMode] ?? item.retrievalMode}
                  </Badge>
                )}
                <div className="absolute right-0 flex items-center opacity-0 transition-opacity group-hover/kb-item:opacity-100">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => onChange(value.filter((id) => id !== item.id))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="gap-0 p-0 sm:max-w-3xl">
          <DialogHeader className="px-4 pt-4">
            <DialogTitle>选择关联知识库</DialogTitle>
          </DialogHeader>
          <div className="mt-3 px-4 pb-4">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <div className="flex min-h-0 flex-col">
                <Tabs
                  value={activeTab}
                  onValueChange={(val) => setActiveTab(val as KnowledgeBaseTab)}
                  className="w-full"
                >
                  <TabsList className="bg-muted/60 w-full rounded-lg p-[3px]">
                    <TabsTrigger value="my" className="flex-1 rounded-md text-xs sm:text-sm">
                      我的知识库
                    </TabsTrigger>
                    <TabsTrigger value="team" className="flex-1 rounded-md text-xs sm:text-sm">
                      团队知识库
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="my" className="outline-none">
                    <ScrollArea
                      className="bg-background h-90 rounded-md border"
                      viewportRef={leftViewportMyRef}
                    >
                      <div className="px-2 pb-1.5">
                        <Input
                          placeholder="搜索我的知识库..."
                          value={searchKeyword}
                          onChange={(e) => setSearchKeyword(e.target.value)}
                          className="bg-muted! supports-backdrop-filter:bg-background/80 sticky top-2 z-10 my-2 h-9 border-0 text-xs shadow-none backdrop-blur sm:text-sm"
                        />
                        {activeTab === "my" && (
                          <>
                            {availableDatasets.length === 0 ? (
                              <div className="text-muted-foreground py-6 text-center text-xs sm:text-sm">
                                暂无知识库
                              </div>
                            ) : (
                              <>
                                {availableDatasets.map((dataset) => {
                                  const isSelected = selectedIds.includes(dataset.id);
                                  return (
                                    <div
                                      key={dataset.id}
                                      role="button"
                                      tabIndex={0}
                                      className={cn(
                                        "hover:bg-background mb-2 flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left",
                                        isSelected && "bg-background text-primary",
                                      )}
                                      onClick={() => handleToggleSelect(dataset.id)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                          e.preventDefault();
                                          handleToggleSelect(dataset.id);
                                        }
                                      }}
                                    >
                                      <div
                                        className="shrink-0"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <Checkbox
                                          checked={isSelected}
                                          onCheckedChange={() => handleToggleSelect(dataset.id)}
                                        />
                                      </div>
                                      <div className="min-w-0 flex-1 truncate text-sm font-medium">
                                        {dataset.name}
                                      </div>
                                      {dataset.retrievalMode && (
                                        <Badge variant="outline" className="shrink-0">
                                          {RETRIEVAL_MODE_LABEL[dataset.retrievalMode] ??
                                            dataset.retrievalMode}
                                        </Badge>
                                      )}
                                    </div>
                                  );
                                })}
                                <div ref={sentinelMyRef} className="h-8 w-full" />
                                {loadingMore && (
                                  <div className="flex h-8 w-full items-center justify-center">
                                    <Spinner className="text-muted-foreground size-6" />
                                  </div>
                                )}
                                {!hasMore && availableDatasets.length > 0 && (
                                  <div className="text-muted-foreground py-2 text-center text-xs">
                                    没有更多了
                                  </div>
                                )}
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </ScrollArea>
                  </TabsContent>
                  <TabsContent value="team" className="outline-none">
                    <ScrollArea
                      className="bg-background h-90 rounded-md border"
                      viewportRef={leftViewportTeamRef}
                    >
                      <div className="px-2 pb-1.5">
                        <Input
                          placeholder="搜索团队知识库..."
                          value={searchKeyword}
                          onChange={(e) => setSearchKeyword(e.target.value)}
                          className="bg-muted! supports-backdrop-filter:bg-background/80 sticky top-2 z-10 my-2 h-9 border-0 text-xs shadow-none backdrop-blur sm:text-sm"
                        />
                        {activeTab === "team" && (
                          <>
                            {availableDatasets.length === 0 ? (
                              <div className="text-muted-foreground py-6 text-center text-xs sm:text-sm">
                                暂无知识库
                              </div>
                            ) : (
                              <>
                                {availableDatasets.map((dataset) => {
                                  const isSelected = selectedIds.includes(dataset.id);
                                  return (
                                    <div
                                      key={dataset.id}
                                      role="button"
                                      tabIndex={0}
                                      className={cn(
                                        "hover:bg-background mb-2 flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left",
                                        isSelected && "bg-background text-primary",
                                      )}
                                      onClick={() => handleToggleSelect(dataset.id)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                          e.preventDefault();
                                          handleToggleSelect(dataset.id);
                                        }
                                      }}
                                    >
                                      <div
                                        className="shrink-0"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <Checkbox
                                          checked={isSelected}
                                          onCheckedChange={() => handleToggleSelect(dataset.id)}
                                        />
                                      </div>
                                      <div className="min-w-0 flex-1 truncate text-sm font-medium">
                                        {dataset.name}
                                      </div>
                                      {dataset.retrievalMode && (
                                        <Badge variant="outline" className="shrink-0">
                                          {RETRIEVAL_MODE_LABEL[dataset.retrievalMode] ??
                                            dataset.retrievalMode}
                                        </Badge>
                                      )}
                                    </div>
                                  );
                                })}
                                <div ref={sentinelTeamRef} className="h-8 w-full" />
                                {loadingMore && (
                                  <div className="flex h-8 w-full items-center justify-center">
                                    <Spinner className="text-muted-foreground size-6" />
                                  </div>
                                )}
                                {!hasMore && availableDatasets.length > 0 && (
                                  <div className="text-muted-foreground py-2 text-center text-xs">
                                    没有更多了
                                  </div>
                                )}
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              </div>

              <div className="bg-background flex min-h-0 flex-col rounded-md border px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-medium sm:text-sm">
                    已选择的知识库（{selectedIds.length}）
                  </div>
                  {selectedIds.length > 0 && (
                    <Button variant="ghost" size="xs" type="button" onClick={handleClearSelected}>
                      <X className="h-3 w-3" />
                      清空
                    </Button>
                  )}
                </div>
                <ScrollArea className="mt-2 max-h-88 pr-1">
                  {selectedDatasets.length === 0 ? (
                    <div className="text-muted-foreground py-6 text-center text-xs sm:text-sm">
                      暂未选择知识库
                    </div>
                  ) : (
                    selectedDatasets.map((dataset) => (
                      <div
                        key={dataset.id}
                        className="group bg-background mt-2 flex items-center justify-between gap-2 rounded-md px-2 py-1.5"
                      >
                        <div className="min-w-0 truncate text-sm font-medium">{dataset.name}</div>

                        <div className="flex items-center gap-1">
                          {dataset.retrievalMode && (
                            <Badge variant="outline">
                              {RETRIEVAL_MODE_LABEL[dataset.retrievalMode] ?? dataset.retrievalMode}
                            </Badge>
                          )}
                          <Button
                            size="icon-xs"
                            className="hover:bg-destructive/10 hover:text-destructive p-0"
                            variant="ghost"
                            onClick={() => handleRemoveSelected(dataset.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </ScrollArea>
              </div>
            </div>
          </div>
          <DialogFooter className="px-4 pb-3">
            <DialogClose asChild>
              <Button variant="outline" size="sm">
                取消
              </Button>
            </DialogClose>
            <Button size="sm" onClick={handleConfirm}>
              确定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});

KnowledgeBase.displayName = "KnowledgeBase";
