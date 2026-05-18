import type { PaginatedResponse, QueryOptionsUtil } from "@buildingai/web-types";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { apiHttpClient } from "../base";

export type AgentDecoratePublicItem = {
    id: string;
    name: string;
    description?: string | null;
    avatar?: string | null;
    updatedAt: string;
    userCount: number;
    messageCount: number;
    creator: { id: string; nickname: string | null; avatar: string | null } | null;
    primaryModel: {
        id: string;
        name: string;
        iconUrl: string | null;
        provider: string | null;
    } | null;
    tags?: { id: string; name: string }[];
};

export type AgentDecorateLinkItem = {
    type?: string;
    name?: string;
    path?: string;
    query?: Record<string, unknown>;
};

export type AgentDecorateBannerItem = {
    imageUrl: string;
    linkUrl?: string;
    linkType?: "system" | "custom";
};

export type AgentDecorateConfig = {
    enabled: boolean;
    title: string;
    description: string;
    banners?: AgentDecorateBannerItem[];
    link?: AgentDecorateLinkItem;
    heroImageUrl?: string;
    overlayTitle: string;
    overlayDescription: string;
    overlayIconUrl: string;
    sortAgentIds: string[];
};

export function useWebAgentDecorateQuery(options?: QueryOptionsUtil<AgentDecorateConfig>) {
    return useQuery<AgentDecorateConfig>({
        queryKey: ["web", "agent-decorate", "config"],
        queryFn: () => apiHttpClient.get<AgentDecorateConfig>("/agent-decorate"),
        ...options,
    });
}

export function useWebAgentDecorateItemsInfiniteQuery(
    params?: { keyword?: string; tagId?: string; pageSize?: number },
    options?: { enabled?: boolean },
) {
    const pageSize = params?.pageSize ?? 20;
    return useInfiniteQuery<PaginatedResponse<AgentDecoratePublicItem>>({
        queryKey: ["web", "agent-decorate", "items-infinite", params],
        queryFn: ({ pageParam }) =>
            apiHttpClient.get<PaginatedResponse<AgentDecoratePublicItem>>("/agent-decorate/items", {
                params: {
                    page: pageParam,
                    pageSize,
                    keyword: params?.keyword,
                    tagId: params?.tagId,
                },
            }),
        getNextPageParam: (lastPage) =>
            lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
        initialPageParam: 1,
        ...options,
    });
}
