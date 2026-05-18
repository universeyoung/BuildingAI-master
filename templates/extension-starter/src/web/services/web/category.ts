import type { QueryOptionsUtil } from "@buildingai/web-types";
import { useQuery } from "@tanstack/react-query";

import { apiHttpClient } from "../base";
import type { Category, QueryCategoryParams } from "../types/category";

export type { Category, QueryCategoryParams };

export function useWebCategoryListQuery(
    params?: QueryCategoryParams,
    options?: QueryOptionsUtil<Category[]>,
) {
    return useQuery<Category[]>({
        queryKey: ["web", "categories", "list", params],
        queryFn: () => apiHttpClient.get<Category[]>("/category", { params }),
        ...options,
    });
}

export function useWebCategoryDetailQuery(id: string, options?: QueryOptionsUtil<Category>) {
    return useQuery<Category>({
        queryKey: ["web", "categories", "detail", id],
        queryFn: () => apiHttpClient.get<Category>(`/category/${id}`),
        enabled: !!id && options?.enabled !== false,
        ...options,
    });
}
