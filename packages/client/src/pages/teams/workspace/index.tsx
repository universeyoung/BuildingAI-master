import { definePageMeta, useDocumentHead } from "@buildingai/hooks";
import {
  type ChatConfig,
  useAiProvidersQuery,
  useChatConfigQuery,
  teamApi,
} from "@buildingai/services/web";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@buildingai/ui/components/ui/dropdown-menu";
import { Input } from "@buildingai/ui/components/ui/input";
import { Label } from "@buildingai/ui/components/ui/label";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@buildingai/ui/components/ui/input-group";
import { ScrollArea } from "@buildingai/ui/components/ui/scroll-area";
import { SidebarTrigger } from "@buildingai/ui/components/ui/sidebar";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@buildingai/ui/components/ui/tabs";
import {
  Bot,
  ChevronRight,
  Loader2,
  MoreVertical,
  Plus,
  Search,
  Trash2,
  Users,
  Pencil,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import type { Suggestion } from "@/components/ask-assistant-ui";
import { AssistantProvider, Chat, useAssistant } from "@/components/ask-assistant-ui";

const DEFAULT_SUGGESTIONS: Suggestion[] = [
  { id: "1", text: "分析这份数据报告" },
  { id: "2", text: "制定本周工作计划" },
  { id: "3", text: "协助我完成这篇文章" },
];

export const meta = definePageMeta({
  title: "我的团队",
  description: "管理您的团队和协作任务",
  icon: "users",
  order: 4,
  inLinkSelector: true,
});

interface Team {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

interface TeamMember {
  id: string;
  agentId: string;
  agentName: string;
  role: string;
}

interface CreateTeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTeamCreated: (team: Team) => void;
  isLoading?: boolean;
}

const CreateTeamDialog = ({ open, onOpenChange, onTeamCreated, isLoading }: CreateTeamDialogProps) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setName("");
      setDescription("");
      setError(null);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    try {
      const payload = {
        name: name.trim() || "新建团队",
        description: description.trim() || "通过团队协作完成任务",
        leadType: "human",
      };
      
      const newTeam = await teamApi.create(payload);
      
      if (!newTeam) {
        throw new Error("创建团队失败：服务器返回空数据");
      }
      
      const teamId = newTeam.id;
      if (!teamId) {
        throw new Error("创建团队失败：返回数据中没有 id");
      }
      
      onTeamCreated(newTeam);
      setName("");
      setDescription("");
      setError(null);
      onOpenChange(false);
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.message || "创建失败，请重试";
      setError(errorMessage);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>创建新团队</DialogTitle>
            <DialogDescription>
              创建一个团队，开始智能协作之旅
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                {error}
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="name">团队名称</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="输入团队名称"
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">团队描述</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="简单描述一下这个团队"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              取消
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  创建中...
                </>
              ) : (
                "创建团队"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

interface EditTeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team: Team;
  onTeamUpdated: (team: Team) => void;
  isLoading?: boolean;
}

const EditTeamDialog = ({ open, onOpenChange, team, onTeamUpdated, isLoading }: EditTeamDialogProps) => {
  const [name, setName] = useState(team.name);
  const [description, setDescription] = useState(team.description);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const updatedTeam = await teamApi.update(team.id, {
        name: name || team.name,
        description: description || team.description,
      });
      onTeamUpdated(updatedTeam);
      onOpenChange(false);
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.message || "更新失败，请重试";
      setError(errorMessage);
      console.error("更新团队失败:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>编辑团队</DialogTitle>
            <DialogDescription>
              修改团队的基本信息
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                {error}
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="name">团队名称</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="输入团队名称"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">团队描述</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="简单描述一下这个团队"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              取消
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  保存中...
                </>
              ) : (
                "保存更改"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const TeamsWorkspacePage = () => {
  const [activeTab, setActiveTab] = useState<"chat" | "manage">("chat");
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamMembers, setTeamMembers] = useState<Map<string, TeamMember[]>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [teamToEdit, setTeamToEdit] = useState<Team | null>(null);
  const navigate = useNavigate();

  useDocumentHead({
    title: "我的团队",
  });

  const { data: providers = [] } = useAiProvidersQuery({ supportedModelTypes: "llm" });
  const { data: rawChatConfig } = useChatConfigQuery();
  const chatConfig = rawChatConfig as ChatConfig | undefined;

  const suggestions: Suggestion[] = useMemo(() => {
    if (!chatConfig) return DEFAULT_SUGGESTIONS;
    if (!chatConfig.suggestionsEnabled) return [];
    const list = Array.isArray(chatConfig.suggestions) ? chatConfig.suggestions : [];
    return list
      .filter((item): item is { icon?: string; text: string } => Boolean(item?.text))
      .map((item, index) => ({ id: String(index), text: item.text }));
  }, [chatConfig]);

  const welcomeInfo = chatConfig?.welcomeInfo;
  const assistant = useAssistant({ providers, suggestions });

  useEffect(() => {
    const loadTeams = async () => {
      setIsLoading(true);
      try {
        console.log("[workspace/loadTeams] 开始加载团队列表...");
        const result = await teamApi.getAll();
        console.log("[workspace/loadTeams] 团队列表响应:", result);
        
        if (!result) {
          console.error("[workspace/loadTeams] 加载团队列表失败: 服务器返回空数据");
          setTeams([]);
          return;
        }
        
        const items = result.items || [];
        console.log("[workspace/loadTeams] 团队数据:", items);
        setTeams(items);
        
        const membersMap = new Map<string, TeamMember[]>();
        for (const team of items) {
          try {
            console.log(`[workspace/loadTeams] 加载团队 ${team.id} 成员...`);
            const members = await teamApi.getMembers(team.id);
            console.log(`[workspace/loadTeams] 团队 ${team.id} 成员:`, members);
            membersMap.set(team.id, (members || []).map(m => ({
              id: m.id,
              agentId: m.agentId,
              agentName: m.agentId || "未知智能体",
              role: m.role || "member"
            })));
          } catch (error) {
            console.error(`加载团队 ${team.id} 成员失败:`, error);
            membersMap.set(team.id, []);
          }
        }
        setTeamMembers(membersMap);
        
        if (items.length > 0) {
          setSelectedTeamId(items[0].id);
        }
      } catch (error) {
        console.error("[workspace/loadTeams] 加载团队列表失败:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTeams();
  }, []);

  const filteredTeams = useMemo(() => {
    if (!searchKeyword) return teams;
    return teams.filter(
      (team) =>
        team.name.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        team.description.toLowerCase().includes(searchKeyword.toLowerCase()),
    );
  }, [searchKeyword, teams]);

  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === selectedTeamId) || filteredTeams[0],
    [selectedTeamId, filteredTeams, teams],
  );

  const members = useMemo(() => {
    if (!selectedTeam?.id) return [];
    return teamMembers.get(selectedTeam.id) || [];
  }, [selectedTeam, teamMembers]);

  const getMembersForTeam = (teamId: string) => {
    return teamMembers.get(teamId) || [];
  };

  const handleCreateTeam = async (newTeam: Team) => {
    setTeams(prev => [...prev, newTeam]);
    setTeamMembers(prev => new Map(prev).set(newTeam.id, []));
    setSelectedTeamId(newTeam.id);
  };

  const handleEditTeam = async (updatedTeam: Team) => {
    setTeams(prev => prev.map(t => t.id === updatedTeam.id ? updatedTeam : t));
  };

  const removeMember = async (memberId: string) => {
    if (!selectedTeam?.id) return;
    try {
      await teamApi.removeMember(selectedTeam.id, memberId);
      setTeamMembers(prev => {
        const newMembers = new Map(prev);
        const currentMembers = newMembers.get(selectedTeam.id) || [];
        newMembers.set(selectedTeam.id, currentMembers.filter(m => m.id !== memberId));
        return newMembers;
      });
    } catch (error) {
      console.error("移除成员失败:", error);
    }
  };

  const deleteTeam = async () => {
    if (!selectedTeam?.id) return;
    setIsDeleting(true);
    try {
      await teamApi.delete(selectedTeam.id);
      const newTeams = teams.filter(t => t.id !== selectedTeam.id);
      setTeams(newTeams);
      setTeamMembers(prev => {
        const newMap = new Map(prev);
        newMap.delete(selectedTeam.id);
        return newMap;
      });
      setSelectedTeamId(newTeams.length > 0 ? newTeams[0].id : null);
    } catch (error) {
      console.error("删除团队失败:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const openEditDialog = (team: Team) => {
    setTeamToEdit(team);
    setEditDialogOpen(true);
  };

  return (
    <div className="flex h-dvh flex-col">
      <div className="bg-background sticky top-0 z-20 flex h-13 w-full items-center px-2 border-b">
        <SidebarTrigger className="md:hidden" />
        <div className="ml-auto">
          <Button variant="ghost" size="sm" className="ml-auto" asChild>
            <Link to="/teams">
              <ChevronRight className="rotate-180" />
              团队广场
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-80 border-r flex flex-col bg-card/50">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">我的团队</h2>
              <Button 
                size="sm" 
                onClick={() => setCreateDialogOpen(true)}
                className="gap-1"
              >
                <Plus className="size-4" />
                新建
              </Button>
            </div>
            <InputGroup>
              <InputGroupInput
                placeholder="搜索团队"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
              />
              <InputGroupAddon>
                <Search className="size-4" />
              </InputGroupAddon>
            </InputGroup>
          </div>

          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="text-muted-foreground size-8 animate-spin" />
              </div>
            ) : (
              <div className="p-2 space-y-2">
                {filteredTeams.map((team) => {
                  const teamMemberList = getMembersForTeam(team.id);
                  return (
                    <div
                      key={team.id}
                      className={`p-3 rounded-lg cursor-pointer transition-all ${
                        selectedTeam?.id === team.id
                          ? "bg-accent border border-accent-foreground/10"
                          : "hover:bg-accent/50 border border-transparent"
                      }`}
                      onClick={() => setSelectedTeamId(team.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="flex -space-x-2 shrink-0">
                            {teamMemberList.slice(0, 3).map((member, index) => (
                              <Avatar 
                                key={member.id} 
                                className="size-8 border-2 border-background"
                                style={{ zIndex: teamMemberList.length - index }}
                              >
                                <AvatarImage src="" />
                                <AvatarFallback>
                                  <Bot className="size-4" />
                                </AvatarFallback>
                              </Avatar>
                            ))}
                            {teamMemberList.length === 0 && (
                              <Avatar className="size-8 border-2 border-background">
                                <AvatarFallback>
                                  <Users className="size-4" />
                                </AvatarFallback>
                              </Avatar>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-sm truncate">{team.name}</h3>
                            <p className="text-xs text-muted-foreground truncate">
                              {teamMemberList.length} 名成员
                            </p>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon-xs" 
                              className="size-8 shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem 
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditDialog(team);
                              }}
                            >
                              <Pencil className="size-4 mr-2" />
                              编辑团队
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-destructive" 
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteTeam();
                              }}
                              disabled={isDeleting}
                            >
                              <Trash2 className="size-4 mr-2" />
                              {isDeleting ? "删除中..." : "删除团队"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })}
                {filteredTeams.length === 0 && !isLoading && (
                  <div className="text-center py-12">
                    <Users className="mx-auto text-muted-foreground size-12 mb-3" />
                    <p className="text-muted-foreground text-sm">还没有团队</p>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedTeam ? (
            <Tabs
              defaultValue="chat"
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as "chat" | "manage")}
              className="flex-1 flex flex-col"
            >
              <div className="px-6 py-4 border-b bg-card/30">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-4">
                    <div className="flex -space-x-2">
                      {members.slice(0, 4).map((member, index) => (
                        <Avatar
                          key={member.id}
                          className="size-10 border-2 border-background"
                          style={{ zIndex: members.length - index }}
                        >
                          <AvatarImage src="" />
                          <AvatarFallback>
                            <Bot className="size-5" />
                          </AvatarFallback>
                        </Avatar>
                      ))}
                      {members.length === 0 && (
                        <Avatar className="size-10 border-2 border-background">
                          <AvatarFallback>
                            <Users className="size-5" />
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                    <div>
                      <h1 className="text-xl font-semibold">{selectedTeam.name}</h1>
                      <p className="text-sm text-muted-foreground">
                        {selectedTeam.description}
                      </p>
                    </div>
                  </div>
                  <TabsList>
                    <TabsTrigger value="chat">团队对话</TabsTrigger>
                    <TabsTrigger value="manage">成员管理</TabsTrigger>
                  </TabsList>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {members.length > 0 ? (
                    members.map((member) => (
                      <Badge key={member.id} variant="secondary" className="gap-1">
                        <Bot className="size-3" />
                        {member.agentName} · {member.role}
                      </Badge>
                    ))
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      暂无成员
                    </Badge>
                  )}
                </div>
              </div>

              <TabsContent value="chat" className="flex-1 m-0 p-0 overflow-hidden">
                <AssistantProvider {...assistant}>
                  <Chat
                    title={selectedTeam.name}
                    welcomeTitle={welcomeInfo?.title}
                    welcomeDescription={`正在与 ${selectedTeam.name} 团队进行协作对话`}
                    footerText={welcomeInfo?.footer}
                  />
                </AssistantProvider>
              </TabsContent>

              <TabsContent value="manage" className="flex-1 m-0 p-0 overflow-hidden">
                <ScrollArea className="h-full">
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-lg font-semibold">团队成员</h2>
                      <Button asChild>
                        <Link to="/teams">
                          <Plus className="size-4 mr-2" />
                          添加成员
                        </Link>
                      </Button>
                    </div>

                    {members.length > 0 ? (
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {members.map((member) => (
                          <Card key={member.id} className="overflow-hidden hover:shadow-md transition-shadow">
                            <CardHeader className="pb-4">
                              <div className="flex items-start gap-4">
                                <Avatar className="size-12">
                                  <AvatarImage src="" />
                                  <AvatarFallback>
                                    <Bot className="size-6" />
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <CardTitle className="text-base truncate">
                                    {member.agentName}
                                  </CardTitle>
                                  <CardDescription>{member.role}</CardDescription>
                                </div>
                              </div>
                            </CardHeader>
                            <CardFooter className="flex gap-2">
                              <Button variant="ghost" className="flex-1">
                                查看详情
                              </Button>
                              <Button 
                                variant="destructive" 
                                className="flex-1" 
                                onClick={() => removeMember(member.id)}
                              >
                                <Trash2 className="size-4 mr-2" />
                                移除
                              </Button>
                            </CardFooter>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-16">
                        <Users className="mx-auto text-muted-foreground size-16 mb-4" />
                        <h3 className="text-lg font-medium mb-2">还没有成员</h3>
                        <p className="text-muted-foreground mb-6">
                          去团队广场添加一些智能体到团队吧
                        </p>
                        <Button asChild>
                          <Link to="/teams">
                            <Plus className="size-4 mr-2" />
                            去添加成员
                          </Link>
                        </Button>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Users className="mx-auto text-muted-foreground size-20 mb-4" />
                <h2 className="text-2xl font-semibold mb-2">还没有团队</h2>
                <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                  创建一个团队，开始智能协作。您可以在团队中添加多个智能体，共同完成任务。
                </p>
                <Button 
                  size="lg" 
                  onClick={() => setCreateDialogOpen(true)}
                  className="gap-2"
                >
                  <Plus className="size-5" />
                  创建第一个团队
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <CreateTeamDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onTeamCreated={handleCreateTeam}
        isLoading={isCreating}
      />

      {teamToEdit && (
        <EditTeamDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          team={teamToEdit}
          onTeamUpdated={handleEditTeam}
          isLoading={isEditing}
        />
      )}
    </div>
  );
};

export default TeamsWorkspacePage;
