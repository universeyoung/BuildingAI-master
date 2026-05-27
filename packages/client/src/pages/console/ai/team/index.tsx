import { definePageMeta, useDocumentHead } from "@buildingai/hooks";
import { PageContainer } from "@/layouts/console/_components/page-container";
import { Button } from "@buildingai/ui/components/ui/button";
import { Users, Plus, Loader2 } from "lucide-react";
import { useState } from "react";

export const meta = definePageMeta({
  title: "团队管理",
  description: "管理团队",
  icon: "users",
});

const TeamIndexPage = () => {
  const [isLoading, setIsLoading] = useState(false);

  useDocumentHead({
    title: "团队管理",
  });

  return (
    <PageContainer>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <h1 className="text-xl font-semibold">团队管理</h1>
            <p className="text-muted-foreground text-sm">管理团队和协作</p>
          </div>
          <Button>
            <Plus />
            创建团队
          </Button>
        </div>

        <div className="mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="text-muted-foreground size-8 animate-spin" />
            </div>
          ) : (
            <p className="text-muted-foreground py-12 text-center text-sm">暂无团队</p>
          )}
        </div>
      </div>
    </PageContainer>
  );
};

export default TeamIndexPage;
