import { definePageMeta, useDocumentHead } from "@buildingai/hooks";
import { useAgentTags, useWebAgentDecorateItemsInfiniteQuery, teamApi } from "@buildingai/services/web";
import { uploadFilesAuto } from "@buildingai/services/shared";
import { InfiniteScroll } from "@buildingai/ui/components/infinite-scroll";
import { Avatar, AvatarFallback, AvatarImage } from "@buildingai/ui/components/ui/avatar";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@buildingai/ui/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@buildingai/ui/components/ui/dialog";
import { Input } from "@buildingai/ui/components/ui/input";
import { Label } from "@buildingai/ui/components/ui/label";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@buildingai/ui/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@buildingai/ui/components/ui/select";
import { ScrollArea } from "@buildingai/ui/components/ui/scroll-area";
import { SidebarTrigger } from "@buildingai/ui/components/ui/sidebar";
import { toast } from "sonner";
import { cn } from "@buildingai/ui/lib/utils";
import {
  Bot,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MessageSquare,
  Plus,
  Search,
  Users,
  AlertCircle,
  FolderOpen,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDebounceValue } from "usehooks-ts";

const PAGE_SIZE = 20;

export const meta = definePageMeta({
  title: "团队协作",
  description: "组建团队，分配任务，智能协作",
  icon: "users",
  order: 3,
  inLinkSelector: true,
});

interface Team {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

interface AddToTeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: any;
  teams: Team[];
  onSuccess: () => void;
}

const AddToTeamDialog = ({ open, onOpenChange, agent, teams, onSuccess }: AddToTeamDialogProps) => {
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newTeamName, setNewTeamName] = useState("");

  useEffect(() => {
    if (open) {
      setSelectedTeamId(teams.length > 0 ? teams[0].id : null);
      setIsAdding(false);
      setIsCreating(false);
      setError(null);
      setNewTeamName("");
    }
  }, [open, teams]);

  const handleAddToTeam = async () => {
    if (!selectedTeamId) {
      setError("请选择一个团队");
      return;
    }
    
    setIsAdding(true);
    setError(null);
    try {
      await teamApi.addMembers(selectedTeamId, { agentIds: [agent.id], roles: ["member"] });
      toast({
        title: "添加成功",
        description: "智能体已成功添加到团队",
      });
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.message || "添加失败，请重试";
      setError(errorMessage);
      console.error("添加智能体到团队失败:", error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleCreateNewTeam = async () => {
    const teamName = newTeamName.trim() || "我的新团队";
    
    setIsCreating(true);
    setError(null);
    try {
      const payload = {
        name: teamName,
        description: "通过团队协作完成任务",
        leadType: "human",
      };
      
      console.log("[handleCreateNewTeam] 创建团队请求参数:", payload);
      const newTeam = await teamApi.create(payload);
      console.log("[handleCreateNewTeam] 创建团队响应:", newTeam);
      console.log("[handleCreateNewTeam] 响应类型:", typeof newTeam);
      
      if (!newTeam) {
        throw new Error("创建团队失败：服务器返回空数据");
      }
      
      const teamId = newTeam.id;
      if (!teamId) {
        throw new Error("创建团队失败：返回数据中没有 id");
      }
      
      await teamApi.addMembers(teamId, { agentIds: [agent.id], roles: ["member"] });
      
      toast({
        title: "创建成功",
        description: `团队"${teamName}"已创建并添加了智能体`,
      });
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.message || "创建失败，请重试";
      setError(errorMessage);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>添加到团队</DialogTitle>
          <DialogDescription>
            选择一个团队将智能体添加进去，或者创建一个新团队
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="flex items-center gap-3 p-3 bg-accent/30 rounded-lg">
            <Avatar className="size-10">
              <AvatarImage src={agent.avatar ?? agent.creator?.avatar ?? undefined} />
              <AvatarFallback>
                <Bot className="size-5" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{agent.name}</p>
              <p className="text-sm text-muted-foreground truncate">
                {agent.description?.toString().trim() || "暂无描述"}
              </p>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {teams.length > 0 ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">选择团队</label>
                <Select 
                  value={selectedTeamId || ""} 
                  onValueChange={setSelectedTeamId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择一个团队" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">或者创建新团队</label>
                <Input
                  placeholder="输入新团队名称（可选）"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                />
              </div>

              <DialogFooter className="gap-2 sm:gap-0 flex-col sm:flex-row">
                <Button 
                  variant="outline"
                  onClick={handleCreateNewTeam}
                  disabled={isCreating}
                  className="w-full sm:w-auto"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="size-4 mr-2 animate-spin" />
                      创建中...
                    </>
                  ) : (
                    <>
                      <Plus className="size-4 mr-2" />
                      创建新团队
                    </>
                  )}
                </Button>
                <Button 
                  onClick={handleAddToTeam}
                  disabled={isAdding || !selectedTeamId}
                  className="w-full sm:w-auto"
                >
                  {isAdding ? (
                    <>
                      <Loader2 className="size-4 mr-2 animate-spin" />
                      添加中...

                    </>
                  ) : (
                    "添加到所选团队"
                  )}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newTeamName">新团队名称</Label>
                <Input
                  id="newTeamName"
                  placeholder="输入新团队名称"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                />
              </div>
              <Button 
                onClick={handleCreateNewTeam}
                disabled={isCreating}
                className="w-full"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    创建中...
                  </>
                ) : (
                  <>
                    <Plus className="size-4 mr-2" />
                    创建团队并添加
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

interface UploadAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const UploadAgentDialog = ({ open, onOpenChange, onSuccess }: UploadAgentDialogProps) => {
  const [agentPath, setAgentPath] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  useEffect(() => {
    if (!open) {
      setAgentPath("");
      setError(null);
      setSuccess(null);
      setUploadProgress(0);
    }
  }, [open]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    setIsScanning(true);
    setError(null);
    setSuccess(null);
    setUploadProgress(0);

    try {
      console.log("[handleFileUpload] 开始上传文件，数量:", files.length);
      
      // 使用 uploadFilesAuto 上传文件
      const uploadResults = await uploadFilesAuto(Array.from(files), {
        description: "智能体上传"
      }, {
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percentCompleted);
          }
        }
      });

      console.log("[handleFileUpload] 文件上传成功:", uploadResults);

      // 通知后端处理上传的智能体文件
      const fileUrls = uploadResults.map(r => r.url);
      console.log("[handleFileUpload] 文件 URLs:", fileUrls);

      const response = await fetch("/api/teams/agents/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          files: fileUrls,
          fileNames: Array.from(files).map(f => f.name)
        }),
      });

      const result = await response.json();
      console.log("[handleFileUpload] 后端处理结果:", result);

      if (result.loaded && result.loaded.length > 0) {
        setSuccess(`成功上传 ${result.loaded.length} 个智能体`);
        toast({
          title: "上传成功",
          description: `成功加载 ${result.loaded.length} 个智能体`,
        });
        onOpenChange(false);
        onSuccess?.();
      } else if (result.warnings && result.warnings.length > 0) {
        setError(result.warnings.join("\n"));
      } else {
        setSuccess("文件上传成功");
        toast({
          title: "上传成功",
          description: "文件已成功上传",
        });
        onOpenChange(false);
        onSuccess?.();
      }
    } catch (error: any) {
      console.error("[handleFileUpload] 上传失败:", error);
      const errorMessage = error?.message || "上传失败，请重试";
      setError(errorMessage);
      toast({
        title: "上传失败",
        description: errorMessage,
      });
    } finally {
      setIsScanning(false);
      setUploadProgress(0);
      // 清空文件选择
      event.target.value = "";
    }
  };

  const handleScanDirectory = async () => {
    if (!agentPath.trim()) {
      setError("请输入智能体目录路径");
      return;
    }

    setIsScanning(true);
    setError(null);
    setSuccess(null);

    try {
      console.log("[handleScanDirectory] 开始扫描目录:", agentPath.trim());
      const response = await fetch("/api/teams/agents/scan-directory", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ path: agentPath.trim() }),
      });

      console.log("[handleScanDirectory] 响应状态:", response.status);
      const data = await response.json();
      console.log("[handleScanDirectory] 响应数据:", data);

      if (data.warnings && data.warnings.length > 0) {
        // 确保 warnings 是字符串数组
        const warningStrings = data.warnings.map((w: any) => 
          typeof w === "string" ? w : (w.message || w.reason || JSON.stringify(w))
        );
        setError(warningStrings.join("\n"));
        return;
      }

      if (data.loaded) {
        setSuccess(`成功加载智能体: ${data.loaded.name || "未知智能体"}`);
        toast({
          title: "上传成功",
          description: `智能体 "${data.loaded.name || "未知智能体"}" 已成功上传`,
        });
        onOpenChange(false);
        onSuccess?.();
      } else {
        setError("上传失败，请检查目录路径是否正确");
      }
    } catch (error: any) {
      console.error("[handleScanDirectory] 扫描目录失败:", error);
      const errorMessage = error?.message || "扫描目录失败，请重试";
      setError(errorMessage);
    } finally {
      setIsScanning(false);
    }
  };

  const handleScanDefaultDirectories = async () => {
    setIsScanning(true);
    setError(null);
    setSuccess(null);

    try {
      console.log("[handleScanDefaultDirectories] 开始扫描默认目录");
      const response = await fetch("/api/teams/agents/scan", {
        method: "POST",
      });

      console.log("[handleScanDefaultDirectories] 响应状态:", response.status);
      const data = await response.json();
      console.log("[handleScanDefaultDirectories] 响应数据:", data);

      if (data.loaded && data.loaded.length > 0) {
        setSuccess(`成功扫描并加载 ${data.loaded.length} 个智能体`);
        toast({
          title: "扫描完成",
          description: `成功加载 ${data.loaded.length} 个智能体`,
        });
        onOpenChange(false);
        onSuccess?.();
      } else {
        setSuccess("未发现新的智能体");
        toast({
          title: "扫描完成",
          description: "未发现新的智能体",
        });
      }
    } catch (error: any) {
      console.error("[handleScanDefaultDirectories] 扫描失败:", error);
      const errorMessage = error?.message || "扫描失败，请重试";
      setError(errorMessage);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>上传本地智能体</DialogTitle>
          <DialogDescription>
            选择包含智能体代码的文件进行上传，或扫描服务器端默认目录
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* 文件上传选项 */}
          <div className="space-y-2">
            <Label>上传智能体文件</Label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
              <input
                type="file"
                id="agentFileUpload"
                multiple
                accept=".zip,.json,.yaml,.yml,.js,.ts"
                onChange={handleFileUpload}
                className="hidden"
              />
              <label htmlFor="agentFileUpload" className="cursor-pointer">
                <Upload className="size-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-600">
                  点击选择文件或拖拽文件到此处
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  支持 .zip, .json, .yaml, .js, .ts 等格式
                </p>
              </label>
            </div>
            {isScanning && uploadProgress > 0 && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span>上传进度</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">或者</span>
            </div>
          </div>

          <Button 
            variant="outline" 
            className="w-full"
            onClick={handleScanDefaultDirectories}
            disabled={isScanning}
          >
            {isScanning ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                扫描中...
              </>
            ) : (
              <>
                <FolderOpen className="size-4 mr-2" />
                扫描服务器默认目录
              </>
            )}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">或者</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="agentPath">服务器端目录路径（仅服务器可访问）</Label>
            <div className="flex gap-2">
              <Input
                id="agentPath"
                placeholder="/path/to/server/agent"
                value={agentPath}
                onChange={(e) => setAgentPath(e.target.value)}
                className="flex-1"
              />
              <Button 
                onClick={handleScanDirectory}
                disabled={isScanning || !agentPath.trim()}
              >
                {isScanning ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Search className="size-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              输入服务器上的智能体目录路径（必须是绝对路径）
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <pre className="whitespace-pre-wrap text-xs">{error}</pre>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-600 text-sm">
              <Bot className="size-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const TeamsIndexPage = () => {
  const [keyword, setKeyword] = useState("");
  const [debouncedKeyword] = useDebounceValue(keyword.trim(), 300);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [isAddingAgent, setIsAddingAgent] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoadingTeams, setIsLoadingTeams] = useState(false);
  const tagScrollRef = useRef<HTMLDivElement | null>(null);
  const [canScrollTagsLeft, setCanScrollTagsLeft] = useState(false);
  const [canScrollTagsRight, setCanScrollTagsRight] = useState(false);
  const navigate = useNavigate();

  useDocumentHead({
    title: "团队协作",
  });

  const { data: tagsData } = useAgentTags();
  const tags = tagsData ?? [];

  const squareQuery = useWebAgentDecorateItemsInfiniteQuery(
    {
      pageSize: PAGE_SIZE,
      keyword: debouncedKeyword || undefined,
      tagId: selectedTagId || undefined,
    },
    { enabled: true },
  );

  const items = useMemo(
    () => squareQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [squareQuery.data?.pages],
  );
  const hasNextPage = squareQuery.hasNextPage ?? false;
  const isFetchingNextPage = squareQuery.isFetchingNextPage;

  useEffect(() => {
    const loadTeams = async () => {
      setIsLoadingTeams(true);
      try {
        console.log("[loadTeams] 开始加载团队列表...");
        const result = await teamApi.getAll();
        console.log("[loadTeams] 团队列表响应:", result);
        
        if (!result) {
          console.error("[loadTeams] 加载团队列表失败: 服务器返回空数据");
          setTeams([]);
          return;
        }
        
        const teamsData = result.items || [];
        console.log("[loadTeams] 团队数据:", teamsData);
        setTeams(teamsData);
      } catch (error) {
        console.error("[loadTeams] 加载团队列表失败:", error);
      } finally {
        setIsLoadingTeams(false);
      }
    };

    loadTeams();
  }, []);

  const selectTag = (tagId: string) => {
    setSelectedTagId((prev) => (prev === tagId ? null : tagId));
  };

  const updateTagScrollState = useCallback(() => {
    const container = tagScrollRef.current;
    if (!container) {
      setCanScrollTagsLeft(false);
      setCanScrollTagsRight(false);
      return;
    }

    const maxScrollLeft = container.scrollWidth - container.clientWidth;
    setCanScrollTagsLeft(container.scrollLeft > 4);
    setCanScrollTagsRight(maxScrollLeft - container.scrollLeft > 4);
  }, []);

  const scrollTagsBy = useCallback((direction: "left" | "right") => {
    const container = tagScrollRef.current;
    if (!container) return;

    const offset = Math.max(container.clientWidth * 0.75, 160);
    container.scrollBy({
      left: direction === "left" ? -offset : offset,
      behavior: "smooth",
    });
  }, []);

  useEffect(() => {
    const container = tagScrollRef.current;
    if (!container) return;

    const handleScroll = () => {
      updateTagScrollState();
    };

    handleScroll();
    container.addEventListener("scroll", handleScroll, { passive: true });

    const resizeObserver = new ResizeObserver(handleScroll);
    resizeObserver.observe(container);
    if (container.firstElementChild instanceof HTMLElement) {
      resizeObserver.observe(container.firstElementChild);
    }

    window.addEventListener("resize", handleScroll);

    return () => {
      container.removeEventListener("scroll", handleScroll);
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleScroll);
    };
  }, [updateTagScrollState, tags.length]);

  useEffect(() => {
    updateTagScrollState();
  }, [tags, updateTagScrollState]);

  const isTagSelected = (tagId: string) => selectedTagId === tagId;
  const badgeClass = (selected: boolean) =>
    cn(
      "h-9 cursor-pointer px-4 font-medium text-nowrap sm:font-normal",
      selected ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground",
    );

  const handleAddToTeam = (agent: any) => {
    setSelectedAgent(agent);
    setDialogOpen(true);
  };

  const handleSuccess = () => {
    setTimeout(() => {
      navigate("/teams/workspace");
    }, 500);
  };

  const handleUploadSuccess = () => {
    window.location.reload();
  };

  return (
    <ScrollArea className="h-dvh" viewportClassName="[&_>div]:block!">
      <div className="flex w-full flex-col items-center">
        <div className="bg-background sticky top-0 z-20 flex h-13 w-full items-center px-2">
          <SidebarTrigger className="md:hidden" />
          <div className="ml-auto flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setUploadDialogOpen(true)}
            >
              <Upload className="size-4 mr-2" />
              上传智能体
            </Button>
            <Button variant="ghost" size="sm" className="ml-auto" asChild>
              <Link to="/teams/workspace">
                <Users />
                我的团队
              </Link>
            </Button>
          </div>
        </div>

        <div className="w-full max-w-4xl px-4 py-8 pt-12 sm:pt-20 md:px-6">
          <div className="bg-background sticky top-12 z-20 pb-4">
            <div className="flex flex-col items-center justify-between gap-4 max-sm:items-start sm:flex-row sm:px-3">
              <div className="flex flex-col gap-2">
                <h1 className="text-2xl">团队协作</h1>
                <p className="text-muted-foreground text-sm">
                  选择智能体作为团队成员，用对话完成任务
                </p>
              </div>
              <div className="max-sm:w-full">
                <InputGroup className="rounded-full">
                  <InputGroupInput
                    placeholder="搜索智能体加入团队"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                  />
                  <InputGroupAddon>
                    <Search />
                  </InputGroupAddon>
                </InputGroup>
              </div>
            </div>

            <div className="group relative mt-8 sm:px-3">
              <div
                className={cn(
                  "from-background via-background/80 pointer-events-none absolute inset-y-0 left-0 z-10 flex w-24 items-center bg-linear-to-r to-transparent transition-opacity duration-300",
                  canScrollTagsLeft ? "opacity-100" : "opacity-0",
                )}
              >
                <Button
                  type="button"
                  size="icon-xs"
                  className="border-border bg-background text-muted-foreground hover:bg-background hover:text-primary pointer-events-auto ml-2 flex size-8 items-center justify-center rounded-full border shadow-[0_10px_25px_-5px_rgba(0,0,0,0.08),0_8px_10px_-6px_rgba(0,0,0,0.05)] transition-all duration-200 hover:scale-110 active:scale-95"
                  onClick={() => scrollTagsBy("left")}
                >
                  <ChevronLeft className="size-3.5 stroke-3" />
                </Button>
              </div>

              <div
                className={cn(
                  "from-background via-background/80 pointer-events-none absolute inset-y-0 right-0 z-10 flex w-24 items-center justify-end bg-linear-to-l to-transparent transition-opacity duration-300",
                  canScrollTagsRight ? "opacity-100" : "opacity-0",
                )}
              >
                <Button
                  type="button"
                  size="icon-xs"
                  className="border-border bg-background text-muted-foreground hover:bg-background hover:text-primary pointer-events-auto mr-2 flex size-8 items-center justify-center rounded-full border shadow-[0_10px_25px_-5px_rgba(0,0,0,0.08),0_8px_10px_-6px_rgba(0,0,0,0.05)] transition-all duration-200 hover:scale-110 active:scale-95"
                  onClick={() => scrollTagsBy("right")}
                >
                  <ChevronRight className="size-3.5 stroke-3" />
                </Button>
              </div>

              <div ref={tagScrollRef} className="no-scrollbar overflow-x-auto scroll-smooth py-2">
                <div className="flex min-w-max flex-nowrap gap-2">
                  <Badge
                    className={badgeClass(selectedTagId === null)}
                    onClick={() => setSelectedTagId(null)}
                  >
                    全部
                  </Badge>
                  {tags.map((tag) => (
                    <Badge
                      key={tag.id}
                      className={badgeClass(isTagSelected(tag.id))}
                      onClick={() => selectTag(tag.id)}
                    >
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 sm:px-3">
            {squareQuery.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="text-muted-foreground size-8 animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Users className="text-muted-foreground size-16 mb-4" />
                <p className="text-muted-foreground text-center text-sm mb-2">
                  暂无智能体可加入团队
                </p>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setUploadDialogOpen(true)}
                  >
                    <Upload className="size-4 mr-2" />
                    上传智能体
                  </Button>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/agents/workspace">
                      <Plus className="size-4 mr-2" />
                      创建智能体
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <InfiniteScroll
                loading={isFetchingNextPage}
                hasMore={hasNextPage}
                onLoadMore={() => squareQuery.fetchNextPage()}
                emptyText=""
                showEmptyText={!hasNextPage}
              >
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((agent) => {
                    const creator = agent.creator;
                    const displayName = creator?.nickname ?? "智能体";
                    const initial = displayName.slice(0, 1).toUpperCase();

                    return (
                      <Card key={agent.id} className="overflow-hidden transition-all hover:shadow-md">
                        <CardHeader className="pb-4">
                          <div className="flex items-start gap-4">
                            <Avatar className="size-12">
                              <AvatarImage
                                src={agent.avatar ?? creator?.avatar ?? undefined}
                              />
                              <AvatarFallback>
                                {initial || <Bot />}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-base truncate">
                                {agent.name}
                              </CardTitle>
                              <CardDescription className="truncate">
                                {agent.description?.toString().trim() || "暂无描述"}
                              </CardDescription>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="pb-3">
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <MessageSquare className="size-3.5 shrink-0 opacity-70" />
                              {agent.messageCount}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Users className="size-3.5 shrink-0 opacity-70" />
                              {agent.userCount}
                            </span>
                          </div>
                        </CardContent>
                        <CardFooter>
                          <Button
                            className="w-full"
                            onClick={() => handleAddToTeam(agent)}
                            disabled={isAddingAgent || isLoadingTeams}
                          >
                            {isAddingAgent ? (
                              <>
                                <Loader2 className="size-4 mr-2 animate-spin" />
                                加入中...

                              </>
                            ) : (
                              <>
                                <Plus className="size-4 mr-2" />
                                加入团队
                              </>
                            )}
                          </Button>
                        </CardFooter>
                      </Card>
                    );
                  })}
                </div>
              </InfiniteScroll>
            )}
          </div>
        </div>
      </div>

      {selectedAgent && (
        <AddToTeamDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          agent={selectedAgent}
          teams={teams}
          onSuccess={handleSuccess}
        />
      )}

      <UploadAgentDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onSuccess={handleUploadSuccess}
      />
    </ScrollArea>
  );
};

export default TeamsIndexPage;
