import type { AgentPublishConfig } from "@buildingai/types";
import type {
    MutationOptionsUtil,
    PaginatedResponse,
    QueryOptionsUtil,
} from "@buildingai/web-types";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";

import { consoleHttpClient } from "../base";

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
    link: AgentDecorateLinkItem;
    heroImageUrl: string;
    overlayTitle: string;
    overlayDescription: string;
    overlayIconUrl: string;
    sortAgentIds: string[];
};

export type SetAgentDecorateDto = Partial<AgentDecorateConfig>;
export type AgentDecorateItem = {
    id: string;
    name: string;
    description?: string | null;
    avatar?: string | null;
    publishConfig?: AgentPublishConfig | null;
    tags?: Array<{ id: string; name: string }>;
    creator?: { id: string; nickname: string | null; avatar: string | null } | null;
    updatedAt: string;
};

export type DecorateBatchSortItem = {
    id: string;
    sort: number;
};

export function useAgentDecorateQuery(options?: QueryOptionsUtil<AgentDecorateConfig>) {
    return useQuery<AgentDecorateConfig>({
        queryKey: ["agent-decorate", "config"],
        queryFn: () => consoleHttpClient.get<AgentDecorateConfig>("/agent-decorate"),
        ...options,
    });
}

export function useSetAgentDecorateMutation(
    options?: MutationOptionsUtil<AgentDecorateConfig, SetAgentDecorateDto>,
) {
    return useMutation<AgentDecorateConfig, Error, SetAgentDecorateDto>({
        mutationFn: (dto) => consoleHttpClient.post<AgentDecorateConfig>("/agent-decorate", dto),
        ...options,
    });
}

export function useAgentDecorateItemsInfiniteQuery(
    params?: { keyword?: string; tagId?: string; pageSize?: number },
    options?: { enabled?: boolean },
) {
    const pageSize = params?.pageSize ?? 20;
    return useInfiniteQuery<PaginatedResponse<AgentDecorateItem>>({
        queryKey: ["agent-decorate", "items-infinite", params],
        queryFn: ({ pageParam }) =>
            consoleHttpClient.get<PaginatedResponse<AgentDecorateItem>>("/agent-decorate/items", {
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

export function useBatchUpdateAgentDecorateSortMutation(
    options?: MutationOptionsUtil<{ success: boolean }, { items: DecorateBatchSortItem[] }>,
) {
    return useMutation<{ success: boolean }, Error, { items: DecorateBatchSortItem[] }>({
        mutationFn: (dto) =>
            consoleHttpClient.post<{ success: boolean }>("/agent-decorate/items/sort", dto),
        ...options,
    });
}
