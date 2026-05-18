import Logs from "../_components/logs";
import OrchestrationLayout from "../_layouts";

const AgentLogsPage = () => {
  return (
    <div className="relative h-dvh w-dvw overflow-hidden">
      <OrchestrationLayout>
        <Logs />
      </OrchestrationLayout>
    </div>
  );
};

export default AgentLogsPage;
