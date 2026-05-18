import type { MutationOptionsUtil, QueryOptionsUtil } from "@buildingai/web-types";
import { useMutation, useQuery } from "@tanstack/react-query";

import { consoleHttpClient } from "../base";
import type {
    Category,
    CreateCategoryParams,
    QueryCategoryParams,
    UpdateCategoryParams,
} from "../types/category";
import type { OperationResult } from "../types/common";

export type { Category, CreateCategoryParams, QueryCategoryParams, UpdateCategoryParams };
export type { OperationResult } from "../types/common";

export function useCategoryListQuery(
    params?: QueryCategoryParams,
    options?: QueryOptionsUtil<Category[]>,
) {
    return useQuery<Category[]>({
        queryKey: ["categories", "list", params],
        queryFn: () => consoleHttpClient.get<Category[]>("/category", { params }),
        ...options,
    });
}

export function useCategoryDetailQuery(id: string, options?: QueryOptionsUtil<Category>) {
    return useQuery<Category>({
        queryKey: ["categories", "detail", id],
        queryFn: () => consoleHttpClient.get<Category>(`/category/${id}`),
        enabled: !!id && options?.enabled !== false,
        ...options,
    });
}

export function useCreateCategoryMutation(
    options?: MutationOptionsUtil<Partial<Category>, CreateCategoryParams>,
) {
    return useMutation<Partial<Category>, Error, CreateCategoryParams>({
        mutationFn: (data) => consoleHttpClient.post<Partial<Category>>("/category", data),
        ...options,
    });
}

export function useUpdateCategoryMutation(
    options?: MutationOptionsUtil<Category, { id: string; data: UpdateCategoryParams }>,
) {
    return useMutation<Category, Error, { id: string; data: UpdateCategoryParams }>({
        mutationFn: ({ id, data }) => consoleHttpClient.patch<Category>(`/category/${id}`, data),
        ...options,
    });
}

export function useDeleteCategoryMutation(options?: MutationOptionsUtil<OperationResult, string>) {
    return useMutation<OperationResult, Error, string>({
        mutationFn: (id) => consoleHttpClient.delete<OperationResult>(`/category/${id}`),
        ...options,
    });
}

export function useBatchDeleteCategoriesMutation(
    options?: MutationOptionsUtil<OperationResult, string[]>,
) {
    return useMutation<OperationResult, Error, string[]>({
        mutationFn: (ids) =>
            consoleHttpClient.post<OperationResult>("/category/batch-delete", { ids }),
        ...options,
    });
}
