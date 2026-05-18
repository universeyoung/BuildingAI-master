import { SidebarInset, SidebarProvider } from "@buildingai/ui/components/ui/sidebar";

import { OrchestrationSidebar } from "./sidebar";

export default function OrchestrationLayout({ children }: { children?: React.ReactNode }) {
  return (
    <SidebarProvider storageKey="__orchestration_workspace_sidebar__">
      <OrchestrationSidebar />
      <SidebarInset className="flex h-dvh flex-col overflow-hidden">{children}</SidebarInset>
    </SidebarProvider>
  );
}
