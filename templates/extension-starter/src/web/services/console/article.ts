import type {
    MutationOptionsUtil,
    PaginatedQueryOptionsUtil,
    PaginatedResponse,
    QueryOptionsUtil,
} from "@buildingai/web-types";
import { useMutation, useQuery } from "@tanstack/react-query";

import { consoleHttpClient } from "../base";
import type {
    Article,
    CreateArticleParams,
    QueryArticleParams,
    UpdateArticleParams,
} from "../types/article";
import { ArticleStatus } from "../types/article";
import type { OperationResult } from "../types/common";

export type { Article, CreateArticleParams, QueryArticleParams, UpdateArticleParams };
export { ArticleStatus };
export type { OperationResult } from "../types/common";

export function useArticleListQuery(
    params?: QueryArticleParams,
    options?: PaginatedQueryOptionsUtil<Article>,
) {
    return useQuery({
        queryKey: ["articles", "list", params],
        queryFn: () => consoleHttpClient.get<PaginatedResponse<Article>>("/article", { params }),
        ...options,
    });
}

export function useArticleDetailQuery(id: string, options?: QueryOptionsUtil<Article>) {
    return useQuery<Article>({
        queryKey: ["articles", "detail", id],
        queryFn: () => consoleHttpClient.get<Article>(`/article/${id}`),
        enabled: !!id && options?.enabled !== false,
        ...options,
    });
}

export function useCreateArticleMutation(
    options?: MutationOptionsUtil<Partial<Article>, CreateArticleParams>,
) {
    return useMutation<Partial<Article>, Error, CreateArticleParams>({
        mutationFn: (data) => consoleHttpClient.post<Partial<Article>>("/article", data),
        ...options,
    });
}

export function useUpdateArticleMutation(
    options?: MutationOptionsUtil<Article, { id: string; data: UpdateArticleParams }>,
) {
    return useMutation<Article, Error, { id: string; data: UpdateArticleParams }>({
        mutationFn: ({ id, data }) => consoleHttpClient.patch<Article>(`/article/${id}`, data),
        ...options,
    });
}

export function useDeleteArticleMutation(options?: MutationOptionsUtil<OperationResult, string>) {
    return useMutation<OperationResult, Error, string>({
        mutationFn: (id) => consoleHttpClient.delete<OperationResult>(`/article/${id}`),
        ...options,
    });
}

export function useBatchDeleteArticlesMutation(
    options?: MutationOptionsUtil<OperationResult, string[]>,
) {
    return useMutation<OperationResult, Error, string[]>({
        mutationFn: (ids) =>
            consoleHttpClient.post<OperationResult>("/article/batch-delete", { ids }),
        ...options,
    });
}

export function usePublishArticleMutation(options?: MutationOptionsUtil<OperationResult, string>) {
    return useMutation<OperationResult, Error, string>({
        mutationFn: (id) => consoleHttpClient.post<OperationResult>(`/article/${id}/publish`),
        ...options,
    });
}

export function useUnpublishArticleMutation(
    options?: MutationOptionsUtil<OperationResult, string>,
) {
    return useMutation<OperationResult, Error, string>({
        mutationFn: (id) => consoleHttpClient.post<OperationResult>(`/article/${id}/unpublish`),
        ...options,
    });
}
