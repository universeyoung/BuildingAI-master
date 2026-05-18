import {
  type McpServer,
  useCheckMcpServerConnection,
  useDeleteMcpServer,
  useMcpServersQuery,
  useToggleMcpServerStatus,
} from "@buildingai/services/web";
import { Avatar, AvatarFallback, AvatarImage } from "@buildingai/ui/components/ui/avatar";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@buildingai/ui/components/ui/dropdown-menu";
import { Skeleton } from "@buildingai/ui/components/ui/skeleton";
import { StatusBadge } from "@buildingai/ui/components/ui/status-badge";
import { Switch } from "@buildingai/ui/components/ui/switch";
import { useAlertDialog } from "@buildingai/ui/hooks/use-alert-dialog";
import { ChevronRight, Hammer, Plus, RefreshCw, Settings2, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SettingItem, SettingItemAction, SettingItemGroup } from "../../setting-item";
import { McpFormDialog } from "./_components/mcp-form-dialog";
import { McpImportDialog } from "./_components/mcp-import-dialog";
import { McpToolsDialog } from "./_components/mcp-tools-dialog";

type ConnectionStatusBadgeProps = {
  server: McpServer;
  isChecking?: boolean;
};

const ConnectionStatusBadge = ({ server, isChecking }: ConnectionStatusBadgeProps) => {
  if (isChecking) {
    return (
      <Badge variant="outline" className="text-muted-foreground pr-1.5 pl-1">
        <RefreshCw className="size-3.5 animate-spin" />
        测试中...
      </Badge>
    );
  }

  return <StatusBadge active={server.connectable} activeText="可连通" inactiveText="不可连通" />;
};

const ToolsSetting = () => {
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [toolsDialogOpen, setToolsDialogOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<McpServer | null>(null);
  const [viewingToolsServer, setViewingToolsServer] = useState<McpServer | null>(null);
  const [checkingServerId, setCheckingServerId] = useState<string | null>(null);

  const {
    data: userServersData,
    isLoading: isUserLoading,
    refetch: refetchUser,
  } = useMcpServersQuery({ type: "user", pageSize: 9999 });
  const {
    data: systemServersData,
    isLoading: isSystemLoading,
    refetch: refetchSystem,
  } = useMcpServersQuery({ type: "system", pageSize: 9999 });

  const userServers = userServersData?.items ?? [];
  const systemServers = systemServersData?.items ?? [];
  const isLoading = isUserLoading || isSystemLoading;
  const refetch = () => {
    refetchUser();
    refetchSystem();
  };
  const { confirm } = useAlertDialog();

  const toggleStatusMutation = useToggleMcpServerStatus();
  const deleteMutation = useDeleteMcpServer();
  const checkConnectionMutation = useCheckMcpServerConnection();

  const handleCreate = () => {
    setEditingServer(null);
    setFormDialogOpen(true);
  };

  const handleEdit = (server: McpServer) => {
    setEditingServer(server);
    setFormDialogOpen(true);
  };

  const handleViewTools = (server: McpServer) => {
    setViewingToolsServer(server);
    setToolsDialogOpen(true);
  };

  const handleToggleStatus = async (server: McpServer) => {
    toggleStatusMutation.mutate(
      { id: server.id, status: !server.isDisabled },
      {
        onSuccess: () => {
          toast.success(server.isDisabled ? "已启用" : "已禁用");
          refetch();
        },
      },
    );
  };

  const handleDelete = async (server: McpServer) => {
    await confirm({
      title: "删除MCP服务",
      description: "确定要删除该MCP服务吗？此操作不可恢复。",
    });
    deleteMutation.mutate(server.id, {
      onSuccess: () => {
        toast.success("MCP服务已删除");
        refetch();
      },
      onError: (error) => {
        toast.error(`删除失败: ${(error as Error).message}`);
      },
    });
  };

  const handleCheckConnection = (server: McpServer) => {
    setCheckingServerId(server.id);
    checkConnectionMutation.mutate(server.id, {
      onSuccess: (data) => {
        if (data.connectable) {
          toast.success("连接正常");
        } else {
          toast.error(`连接异常: ${data.message}`);
        }
        refetch();
        setCheckingServerId(null);
      },
      onError: (error) => {
        toast.error(`检测失败: ${(error as Error).message}`);
        setCheckingServerId(null);
      },
    });
  };

  if (isLoading) {
    return (
      <div className="bg-muted flex flex-col gap-1 rounded-lg p-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3 p-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="ml-auto h-5 w-10" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <SettingItemGroup label="我的MCP">
        <SettingItem title="添加MCP" description="添加我的MCP服务">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SettingItemAction onClick={handleCreate}>
                <Plus />
              </SettingItemAction>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => setImportDialogOpen(true)}>
                  从JSON导入
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleCreate}>快速创建</DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </SettingItem>

        {userServers.map((server) => (
          <SettingItem
            key={server.id}
            contentClassName="gap-1"
            title={server.name}
            icon={
              <Avatar className="rounded-lg">
                <AvatarImage className="rounded-lg" src={server.icon} />
                <AvatarFallback className="rounded-lg">{server.name.slice(0, 1)}</AvatarFallback>
              </Avatar>
            }
            description={
              <div className="flex gap-2">
                <ConnectionStatusBadge
                  server={server}
                  isChecking={checkingServerId === server.id}
                />
                <Badge
                  variant="outline"
                  className="text-muted-foreground group/tool-badge hover:bg-accent cursor-pointer px-1.5"
                  onClick={() => handleViewTools(server)}
                >
                  <Hammer />
                  {server.tools?.length || 0}个工具
                  <ChevronRight className="hidden group-hover/tool-badge:block" />
                </Badge>
              </div>
            }
          >
            <div className="flex items-center">
              <Button
                size="icon-sm"
                className="hover:bg-destructive/10 dark:hover:bg-destructive/15 opacity-0 group-hover/setting-item:opacity-100"
                variant="ghost"
                onClick={() => handleDelete(server)}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="text-destructive" />
              </Button>

              <SettingItemAction onClick={() => handleEdit(server)}>
                <Settings2 />
              </SettingItemAction>

              <SettingItemAction
                onClick={() => handleCheckConnection(server)}
                disabled={checkingServerId === server.id}
              >
                <RefreshCw className={checkingServerId === server.id ? "animate-spin" : ""} />
              </SettingItemAction>
              <Switch
                className="ml-1"
                checked={!server.isDisabled}
                onCheckedChange={() => handleToggleStatus(server)}
                disabled={toggleStatusMutation.isPending}
              />
            </div>
          </SettingItem>
        ))}
      </SettingItemGroup>

      <SettingItemGroup label="系统MCP">
        {systemServers.length > 0 ? (
          systemServers.map((server) => (
            <SettingItem
              key={server.id}
              contentClassName="gap-1"
              title={server.name}
              icon={
                <Avatar className="rounded-lg after:rounded-lg">
                  <AvatarImage className="rounded-lg" src={server.icon} />
                  <AvatarFallback className="rounded-lg">{server.name.slice(0, 1)}</AvatarFallback>
                </Avatar>
              }
              description={
                <div className="flex gap-2">
                  <ConnectionStatusBadge
                    server={server}
                    isChecking={checkingServerId === server.id}
                  />
                  <Badge
                    variant="outline"
                    className="text-muted-foreground group/tool-badge hover:bg-accent cursor-pointer px-1.5"
                    onClick={() => handleViewTools(server)}
                  >
                    <Hammer />
                    {server.tools?.length || 0}个工具
                    <ChevronRight className="hidden group-hover/tool-badge:block" />
                  </Badge>
                </div>
              }
            >
              <Switch
                checked={!server.isDisabled}
                onCheckedChange={() => handleToggleStatus(server)}
                disabled={toggleStatusMutation.isPending}
              />
            </SettingItem>
          ))
        ) : (
          <div className="center p-4">
            <span className="text-muted-foreground text-xs">暂无系统MCP</span>
          </div>
        )}
      </SettingItemGroup>

      <McpFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        server={editingServer}
        onSuccess={refetch}
      />

      <McpImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onSuccess={refetch}
      />

      <McpToolsDialog
        open={toolsDialogOpen}
        onOpenChange={setToolsDialogOpen}
        server={viewingToolsServer}
      />
    </div>
  );
};

export { ToolsSetting };
