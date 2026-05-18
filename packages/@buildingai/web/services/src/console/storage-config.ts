import type { MutationOptionsUtil, QueryOptionsUtil } from "@buildingai/web-types";
import { useMutation, useQuery } from "@tanstack/react-query";

import { consoleHttpClient } from "../base";

export type StorageConfigListItem = {
    id: string;
    isActive: boolean;
    storageType: string;
};

/**
 * 获取存储配置列表（用于生成存储配置页面的 Tabs）
 */
export function useStorageConfigListQuery(options?: QueryOptionsUtil<StorageConfigListItem[]>) {
    return useQuery<StorageConfigListItem[]>({
        queryKey: ["system-storage-config", "list"],
        queryFn: () => consoleHttpClient.get<StorageConfigListItem[]>("/system-storage-config"),
        ...options,
    });
}

export type StorageConfigDetail = {
    id: string;
    isActive: boolean;
    storageType: string;
    config: {
        localStorage?: string;
        domain?: string;
        [key: string]: any;
    } | null;
};

export type AliyunOssConfig = {
    bucket: string;
    accessKey: string;
    secretKey: string;
    domain: string;
    region: string;
    arn: string;
};

export type UpdateStorageConfigDto = {
    isActive: boolean;
    storageType: string;
    config: AliyunOssConfig | null;
};

/**
 * 获取单条存储配置详情
 */
export function useStorageConfigDetailQuery(
    id?: string,
    options?: QueryOptionsUtil<StorageConfigDetail>,
) {
    return useQuery<StorageConfigDetail>({
        queryKey: ["system-storage-config", "detail", id],
        enabled: !!id && (options?.enabled ?? true),
        queryFn: () => consoleHttpClient.get<StorageConfigDetail>(`/system-storage-config/${id}`),
        ...options,
    });
}

/**
 * 更新存储配置（用于 OSS 等云存储配置）
 */
export function useUpdateStorageConfigMutation(
    options?: MutationOptionsUtil<void, { id: string; dto: UpdateStorageConfigDto }>,
) {
    return useMutation<void, Error, { id: string; dto: UpdateStorageConfigDto }>({
        mutationFn: ({ id, dto }) =>
            consoleHttpClient.patch<void>(`/system-storage-config/${id}`, dto),
        ...options,
    });
}
