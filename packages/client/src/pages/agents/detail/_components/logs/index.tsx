import { Tabs, TabsContent, TabsList, TabsTrigger } from "@buildingai/ui/components/ui/tabs";
import { useParams } from "react-router-dom";

import Annotation from "./annotation";
import Messages from "./messages";

export default function Logs() {
  const { id } = useParams();
  const agentId = id ?? "";

  return (
    <Tabs defaultValue="messages" className="flex h-full min-h-0 flex-col gap-0">
      <div className="flex items-center gap-4 px-6 py-4">
        <h1 className="text-lg font-semibold">日志与标注</h1>
        <TabsList className="shrink-0">
          <TabsTrigger value="messages">对话记录</TabsTrigger>
          <TabsTrigger value="annotation">标注管理</TabsTrigger>
        </TabsList>
      </div>
      <div className="min-h-0 flex-1 px-6 pb-2">
        <TabsContent value="messages" className="mt-0 h-full">
          <Messages agentId={agentId} />
        </TabsContent>
        <TabsContent value="annotation" className="mt-0 h-full">
          <Annotation agentId={agentId} />
        </TabsContent>
      </div>
    </Tabs>
  );
}
