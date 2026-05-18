import OrchestrationLayout from "./_layouts";

const OrchestrationDetailPage = () => {
  return (
    <div className="relative h-dvh w-dvw overflow-hidden">
      <OrchestrationLayout>
        <div className="flex h-full items-center justify-center">
          <div className="text-muted-foreground text-center">
            <p className="text-lg font-medium">智能体编排页面</p>
            <p className="text-sm">拖拽节点来编排智能体工作流</p>
          </div>
        </div>
        <div className="bg-background absolute bottom-4 left-1/2 z-10 w-3xl -translate-x-1/2 rounded-xl border p-4">
          toolbar
        </div>
      </OrchestrationLayout>
    </div>
  );
};

export default OrchestrationDetailPage;
