import type { PaginatedQueryOptionsUtil, QueryOptionsUtil,PaginatedResponse } from "@buildingai/web-types";
import { useQuery } from "@tanstack/react-query";

import { apiHttpClient } from "../base";
import type { Article, ArticleStatus, QueryArticleParams } from "../types/article";

export type { Article, ArticleStatus, QueryArticleParams };

export function useWebArticleListQuery(
    params?: QueryArticleParams,
    options?: PaginatedQueryOptionsUtil<Article>,
) {
    return useQuery({
        queryKey: ["web", "articles", "list", params],
        queryFn: () => apiHttpClient.get<PaginatedResponse<Article>>("/article", { params }),
        ...options,
    });
}

export function useWebPublishedArticlesQuery(
    categoryId?: string,
    options?: QueryOptionsUtil<Article[]>,
) {
    return useQuery<Article[]>({
        queryKey: ["web", "articles", "published", categoryId],
        queryFn: () => apiHttpClient.get<Article[]>("/article/published", { params: { categoryId } }),
        ...options,
    });
}

export function useWebArticleDetailQuery(id: string, options?: QueryOptionsUtil<Article>) {
    return useQuery<Article>({
        queryKey: ["web", "articles", "detail", id],
        queryFn: () => apiHttpClient.get<Article>(`/article/${id}`),
        enabled: !!id && options?.enabled !== false,
        ...options,
    });
}
