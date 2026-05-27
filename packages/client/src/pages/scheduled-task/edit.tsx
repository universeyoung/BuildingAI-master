import { useParams } from "react-router-dom";
import { useScheduledTaskDetailQuery } from "@buildingai/services/web";
import { TaskForm } from "./components/task-form";
 
export default function ScheduledTaskEditPage() {
  const { id } = useParams<{ id: string }>();
  const { data: task, isLoading } = useScheduledTaskDetailQuery(id ?? "");
 
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }
 
  if (!task) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-muted-foreground">任务不存在</p>
      </div>
    );
  }
 
  return <TaskForm mode="edit" defaultValues={task} taskId={task.id} />;
}
