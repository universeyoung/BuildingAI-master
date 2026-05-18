import { useAuthStore } from "@buildingai/stores";
import { Avatar, AvatarFallback, AvatarImage } from "@buildingai/ui/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@buildingai/ui/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@buildingai/ui/components/ui/sidebar";
import { useAlertDialog } from "@buildingai/ui/hooks/use-alert-dialog";
import { isEnabled } from "@buildingai/utils/is";
import { ChevronsUpDown, LogOut, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

export function NavUser() {
  const { isMobile } = useSidebar();
  const { userInfo } = useAuthStore((state) => state.auth);
  const { logout, isLogin } = useAuthStore((state) => state.authActions);

  const location = useLocation();
  const navigate = useNavigate();
  const { confirm } = useAlertDialog();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg after:rounded-lg">
                {isLogin() && (
                  <AvatarImage
                    className="rounded-lg"
                    src={userInfo?.avatar}
                    alt={userInfo?.nickname}
                  />
                )}
                <AvatarFallback className="rounded-lg">
                  {isLogin() ? userInfo?.nickname?.slice(0, 1) : <User />}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{userInfo?.nickname || "未登录"}</span>
                <span className="text-muted-foreground truncate text-xs">
                  {isLogin()
                    ? isEnabled(userInfo?.isRoot)
                      ? "超级管理员"
                      : userInfo?.role?.name || "未设置角色"
                    : "请先登录后使用"}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuItem
              onClick={async () => {
                await confirm({
                  title: "退出确认",
                  description: "确定要退出登录吗？",
                });
                await logout();
                const redirect = encodeURIComponent(location.pathname + location.search);
                navigate(`/login?redirect=${redirect}`, {
                  replace: true,
                  state: { redirect: location.pathname },
                });
              }}
            >
              <LogOut />
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
