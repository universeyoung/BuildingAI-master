import {
  useHeadRenderer,
  useRefreshUser,
  useRefreshUserConfig,
  useRefreshWebsiteConfig,
} from "@buildingai/hooks";
import { useCheckInitializeStatus } from "@buildingai/services/shared";
import { useConfigStore, useUserConfigStore } from "@buildingai/stores";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Navigate, Outlet, useLocation, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

const GOOGLE_BIND_MESSAGES: Record<string, string> = {
  success: "谷歌账号绑定成功",
  expired: "绑定已过期，请重新操作",
  already_used: "该谷歌账号已绑定其他账号",
  missing: "授权参数缺失",
  config: "系统未配置谷歌登录",
  token_exchange: "授权验证失败，请重试",
  no_access_token: "授权验证失败，请重试",
  userinfo: "获取谷歌信息失败，请重试",
};

const MainLayout = () => {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { data } = useCheckInitializeStatus();
  const { websiteConfig } = useRefreshWebsiteConfig();
  const { initAppearance } = useUserConfigStore((s) => s.userConfigActions);
  const { setIsInitialized } = useConfigStore((s) => s.configActions);

  useEffect(() => {
    if (data?.isInitialized !== undefined) {
      setIsInitialized(data.isInitialized);
    }
  }, [data?.isInitialized, setIsInitialized]);

  useHeadRenderer({
    title: websiteConfig?.webinfo.name || "BuildingAI",
    titleTemplate: `%s - ${websiteConfig?.webinfo.name || "BuildingAI"}`,
    description: websiteConfig?.webinfo.description,
    icon: websiteConfig?.webinfo.icon || `/buildingai-favicon.ico?t=${new Date().getTime()}`,
  });
  useRefreshUser();
  useRefreshUserConfig();

  useEffect(() => {
    const googleBind = searchParams.get("google_bind");
    if (googleBind) {
      const msg = GOOGLE_BIND_MESSAGES[googleBind] || "绑定失败，请重试";
      if (googleBind === "success") {
        toast.success(msg);
        queryClient.invalidateQueries({ queryKey: ["user", "info"] });
      } else {
        toast.error(msg);
      }
      searchParams.delete("google_bind");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, queryClient]);

  useEffect(() => {
    initAppearance();
  }, [initAppearance]);

  if (location.pathname === "/install") {
    return <Outlet />;
  }

  if (data?.isInitialized === false) {
    return <Navigate to="/install" />;
  }

  return (
    <>
      <Outlet />
    </>
  );
};

export default MainLayout;
