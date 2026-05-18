import { ScrollArea } from "@buildingai/ui/components/ui/scroll-area";
import { SidebarInset, SidebarProvider } from "@buildingai/ui/components/ui/sidebar";
import { ReactNode } from "react";
import { Outlet } from "react-router-dom";

import AppNavbar from "./_components/app-navbar";
import { AppSidebar } from "./_components/app-sidebar";
import type { ExtensionMenuItem } from "./types";

const ExtensionConsoleLayout = ({
  menus = [],
  identifier,
  children,
}: {
  menus?: ExtensionMenuItem[];
  identifier?: string;
  children?: ReactNode;
}) => {
  return (
    <SidebarProvider
      storageKey="layout-ext-console-sidebar"
      className="bd-ext-console-layout h-dvh"
    >
      <AppSidebar menus={menus} identifier={identifier} />
      <SidebarInset className="flex h-full flex-col overflow-x-hidden md:h-[calc(100%-1rem)] md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-0">
        <AppNavbar menus={menus} />
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full" viewportClassName="[&>div]:block!">
            <div className="min-h-inset m-4 mt-1 flex flex-col">
              {children ? children : <Outlet />}
            </div>
          </ScrollArea>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default ExtensionConsoleLayout;
