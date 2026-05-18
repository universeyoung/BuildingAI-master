import type { MenuItem, UserInfo } from "@buildingai/web-types";

export const CONSOLE_HOME_PATH = "/console/dashboard";
export const WEB_HOME_PATH = "/";

function isEnabled(status: number | string | boolean | undefined | null): boolean {
    if (typeof status === "boolean") return status;
    if (typeof status === "number") return status === 1;
    if (typeof status === "string") {
        return ["1", "true", "yes", "y", "on", "enabled", "enable", "active"].includes(
            status.toLowerCase().trim(),
        );
    }
    return false;
}

export function hasConsoleAccess(userInfo?: Pick<UserInfo, "permissions" | "isRoot"> | null) {
    return !!userInfo && (isEnabled(userInfo.permissions) || isEnabled(userInfo.isRoot));
}

function normalizePath(path: string) {
    return path.replace(/\/+/g, "/").replace(/\/$/, "") || "/";
}

function collectConsoleMenuPaths(items: MenuItem[], parentPath = "", out: string[] = []) {
    for (const item of items) {
        const currentPath = item.path
            ? [parentPath, item.path].filter(Boolean).join("/")
            : parentPath;

        if (item.type === 2 && item.path && item.path !== "#") {
            out.push(normalizePath(`/console/${currentPath}`));
        }

        if (item.children?.length) {
            collectConsoleMenuPaths(item.children, currentPath, out);
        }
    }

    return out;
}

export function getConsoleMenuPaths(menus: MenuItem[] = []) {
    return collectConsoleMenuPaths(menus);
}

export function getFirstConsoleMenuPath(menus: MenuItem[] = []) {
    const paths = getConsoleMenuPaths(menus);
    return paths.find((path) => path === CONSOLE_HOME_PATH) ?? paths[0] ?? CONSOLE_HOME_PATH;
}

export function hasConsoleRouteAccess(
    userInfo: Pick<UserInfo, "menus" | "isRoot"> | null | undefined,
    pathname: string,
) {
    if (!userInfo) return false;
    if (isEnabled(userInfo.isRoot)) return true;

    const currentPath = normalizePath(pathname);
    return getConsoleMenuPaths(userInfo.menus ?? []).some(
        (menuPath) => currentPath === menuPath || currentPath.startsWith(`${menuPath}/`),
    );
}
