"use client";

import { LucideIcon } from "@buildingai/ui/components/lucide-icon";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@buildingai/ui/components/ui/collapsible";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@buildingai/ui/components/ui/hover-card";
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@buildingai/ui/components/ui/sidebar";
import { ChevronRight } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import type { ExtensionMenuItem } from "../types";

/**
 * Normalize path by removing trailing slash
 */
const normalizePath = (path: string) => {
  return path.endsWith("/") && path.length > 1 ? path.slice(0, -1) : path;
};

function NavMenuItem({ menu }: { menu: ExtensionMenuItem }) {
  const location = useLocation();
  const { state, setOpenMobile, isMobile } = useSidebar();
  const isCollapsed = state === "collapsed";

  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const fullPath = normalizePath(`/console/${menu.path}`.replace(/\/+/g, "/"));
  const hasChildren = menu.children && menu.children.length > 0;
  const normalizedPathname = normalizePath(location.pathname);
  const isActive = normalizedPathname.startsWith(fullPath);

  if (hasChildren) {
    if (isCollapsed) {
      return (
        <SidebarMenuItem>
          <HoverCard openDelay={0} closeDelay={0}>
            <HoverCardTrigger asChild>
              <SidebarMenuButton isActive={isActive}>
                {menu.icon && <LucideIcon name={menu.icon} />}
                <span>{menu.title}</span>
              </SidebarMenuButton>
            </HoverCardTrigger>
            <HoverCardContent side="right" align="start" className="w-48 p-1">
              <div className="flex flex-col gap-0.5">
                {menu.children!.map((child) => {
                  const childPath = normalizePath(`/console/${child.path}`.replace(/\/+/g, "/"));
                  const isChildActive = normalizedPathname === childPath;
                  return (
                    <Link
                      key={child.path}
                      to={childPath}
                      onClick={handleLinkClick}
                      className={`hover:bg-accent hover:text-accent-foreground rounded-md px-2 py-1.5 text-sm transition-colors ${
                        isChildActive ? "bg-accent text-accent-foreground" : ""
                      }`}
                    >
                      {child.title}
                    </Link>
                  );
                })}
              </div>
            </HoverCardContent>
          </HoverCard>
        </SidebarMenuItem>
      );
    }

    return (
      <Collapsible asChild defaultOpen={isActive}>
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton tooltip={menu.title}>
              {menu.icon && <LucideIcon name={menu.icon} />}
              <span>{menu.title}</span>
              <SidebarMenuAction asChild className="[[data-state=open]_>_&]:rotate-90">
                <div>
                  <ChevronRight />
                  <span className="sr-only">Toggle</span>
                </div>
              </SidebarMenuAction>
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub>
              {menu.children!.map((child) => {
                const childPath = normalizePath(`/console/${child.path}`.replace(/\/+/g, "/"));
                return (
                  <SidebarMenuSubItem key={child.path}>
                    <SidebarMenuSubButton asChild isActive={normalizedPathname === childPath}>
                      <Link to={childPath} onClick={handleLinkClick}>
                        <span>{child.title}</span>
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                );
              })}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild tooltip={menu.title} isActive={normalizedPathname === fullPath}>
        <Link to={fullPath} onClick={handleLinkClick}>
          {menu.icon && <LucideIcon name={menu.icon} />}
          <span>{menu.title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function NavMain({ menus }: { menus: ExtensionMenuItem[] }) {
  return (
    <SidebarGroup>
      <SidebarMenu>
        {menus.map((menu) => (
          <NavMenuItem key={menu.path} menu={menu} />
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
