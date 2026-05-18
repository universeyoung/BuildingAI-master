import type { MutationOptionsUtil, QueryOptionsUtil } from "@buildingai/web-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiHttpClient } from "../base";

export type UserMemoryItem = {
    id: string;
    userId: string;
    content: string;
    category: string;
    source?: string | null;
    sourceAgentId?: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
};

export function useUserMemoriesQuery(
    options?: QueryOptionsUtil<UserMemoryItem[]> & { limit?: number },
) {
    const { limit = 100, ...rest } = options ?? {};
    return useQuery<UserMemoryItem[]>({
        queryKey: ["ai-memories", limit],
        queryFn: () => apiHttpClient.get<UserMemoryItem[]>("/ai-memories", { params: { limit } }),
        ...rest,
    });
}

export function useDeactivateUserMemoryMutation(options?: MutationOptionsUtil<void, string>) {
    const queryClient = useQueryClient();
    return useMutation<void, Error, string>({
        mutationFn: (id) => apiHttpClient.delete(`/ai-memories/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["ai-memories"] });
        },
        ...options,
    });
}
