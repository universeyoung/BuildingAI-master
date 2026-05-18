import { useParams } from "react-router-dom";

import Monitoring from "../_components/monitoring";
import OrchestrationLayout from "../_layouts";

const AgentMonitoringPage = () => {
  const { id } = useParams();
  const agentId = id ?? "";

  return (
    <div className="relative h-dvh w-dvw overflow-hidden">
      <OrchestrationLayout>
        <Monitoring agentId={agentId} />
      </OrchestrationLayout>
    </div>
  );
};

export default AgentMonitoringPage;
