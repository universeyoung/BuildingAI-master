"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@buildingai/ui/components/ui/sidebar";
import * as React from "react";

import type { ExtensionMenuItem } from "../types";
import { ConsoleLogo } from "./console-logo";
import { NavMain } from "./nav-main";
import { NavUser } from "./nav-user";

export function AppSidebar({
  menus,
  identifier,
  ...props
}: { menus: ExtensionMenuItem[]; identifier?: string } & React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar variant="inset" collapsible="icon" {...props}>
      <SidebarHeader>
        <ConsoleLogo identifier={identifier} />
      </SidebarHeader>
      <SidebarContent className="gap-0">
        <NavMain menus={menus} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
