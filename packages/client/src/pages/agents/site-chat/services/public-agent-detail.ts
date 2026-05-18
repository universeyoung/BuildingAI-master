import type { PublishedAgentDetail } from "@buildingai/types";
import { useQuery } from "@tanstack/react-query";

import { getApiBaseUrl } from "@/utils/api";

import { fetchPublicJson } from "./public-http";

export async function getPublicAgentDetail(args: {
  agentId: string;
  accessToken: string;
  anonymousIdentifier?: string;
}): Promise<PublishedAgentDetail> {
  return fetchPublicJson<PublishedAgentDetail>(
    `${getApiBaseUrl()}/api/ai-agents/${args.agentId}/publish/detail`,
    args.accessToken,
    args.anonymousIdentifier,
  );
}

export function usePublicAgentDetail(
  agentId: string | undefined,
  accessToken: string | undefined,
  anonymousIdentifier?: string,
  options?: { enabled?: boolean },
) {
  return useQuery<PublishedAgentDetail>({
    queryKey: ["public-agent-detail", agentId ?? "", accessToken ?? "", anonymousIdentifier ?? ""],
    enabled: Boolean(agentId && accessToken) && options?.enabled !== false,
    refetchOnWindowFocus: false,
    queryFn: () =>
      getPublicAgentDetail({
        agentId: agentId!,
        accessToken: accessToken!,
        anonymousIdentifier,
      }),
  });
}
