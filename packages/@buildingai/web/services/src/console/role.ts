import type {
    MutationOptionsUtil,
    PaginatedQueryOptionsUtil,
    PaginatedResponse,
    QueryOptionsUtil,
} from "@buildingai/web-types";
import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { consoleHttpClient } from "../base";
import type { Permission } from "./permission";
import type { User } from "./user";

/**
 * 角色实体类型
 */
export interface RoleEntity {
    id: string;
    name: string;
    description?: string;
    isDisabled: boolean;
    users?: User[];
    userCount: number;
    createdAt: string;
    updatedAt: string;
}

/**
 * 查询角色参数
 */
export interface QueryRoleParams {
    page?: number;
    pageSize?: number;
    name?: string;
    description?: string;
    isDisabled?: boolean;
}

/**
 * 创建角色DTO
 */
export interface CreateRoleDto {
    name: string;
    description?: string;
    permissionIds?: string[];
    isDisabled?: boolean;
}

/**
 * 更新角色DTO
 */
export interface UpdateRoleDto {
    id: string;
    name?: string;
    description?: string;
    permissionIds?: string[];
    isDisabled?: boolean;
}

/**
 * 分配权限DTO
 */
export interface AssignPermissionsDto {
    id: string;
    permissionIds: string[];
}

export type RoleUser = Pick<
    User,
    "id" | "nickname" | "realName" | "avatar" | "lastLoginAt" | "status" | "isRoot" | "role"
> & {
    manageStatus?: number;
    department: string[];
};

export type RolePermissionChecklistItem = Permission & { checked: boolean };

export type RolePermissionChecklistGroup = {
    code: string;
    name: string;
    permissions: RolePermissionChecklistItem[];
};

/**
 * 分页查询角色列表
 * @description 获取角色列表，支持分页和搜索
 * @param params 查询参数
 * @param options React Query 配置选项
 * @returns 分页角色列表
 */
export function useRoleListQuery(
    params?: QueryRoleParams,
    options?: PaginatedQueryOptionsUtil<RoleEntity>,
): UseQueryResult<PaginatedResponse<RoleEntity>, Error> {
    return useQuery<PaginatedResponse<RoleEntity>>({
        queryKey: ["roles", params],
        queryFn: () =>
            consoleHttpClient.get<PaginatedResponse<RoleEntity>>("/role", {
                params,
            }),
        ...options,
    });
}

/**
 * 查询全部角色列表（不分页）
 * @description 获取所有角色，用于下拉选择等场景
 * @param options React Query 配置选项
 * @returns 全部角色列表
 */
export function useAllRolesQuery(
    options?: QueryOptionsUtil<RoleEntity[]>,
): UseQueryResult<RoleEntity[], Error> {
    return useQuery<RoleEntity[]>({
        queryKey: ["roles", "all"],
        queryFn: () => consoleHttpClient.get<RoleEntity[]>("/role/all"),
        ...options,
    });
}

/**
 * 查询角色详情
 * @description 根据ID获取角色详细信息
 * @param id 角色ID
 * @param options React Query 配置选项
 * @returns 角色详情
 */
export function useRoleDetailQuery(
    id: string,
    options?: QueryOptionsUtil<RoleEntity>,
): UseQueryResult<RoleEntity, Error> {
    return useQuery<RoleEntity>({
        queryKey: ["roles", id],
        queryFn: () => consoleHttpClient.get<RoleEntity>(`/role/${id}`),
        enabled: !!id,
        ...options,
    });
}

/**
 * 创建角色
 * @description 创建新的角色
 * @param options Mutation 配置选项
 * @returns Mutation 对象
 */
export function useCreateRoleMutation(
    options?: MutationOptionsUtil<RoleEntity, CreateRoleDto>,
): UseMutationResult<RoleEntity, Error, CreateRoleDto, unknown> {
    const queryClient = useQueryClient();
    return useMutation<RoleEntity, Error, CreateRoleDto>({
        mutationFn: (data) => consoleHttpClient.post<RoleEntity>("/role", data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["roles"] });
        },
        ...options,
    });
}

/**
 * 更新角色
 * @description 更新角色信息
 * @param options Mutation 配置选项
 * @returns Mutation 对象
 */
export function useUpdateRoleMutation(
    options?: MutationOptionsUtil<RoleEntity, UpdateRoleDto>,
): UseMutationResult<RoleEntity, Error, UpdateRoleDto, unknown> {
    const queryClient = useQueryClient();
    return useMutation<RoleEntity, Error, UpdateRoleDto>({
        mutationFn: (data) => consoleHttpClient.put<RoleEntity>("/role", data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["roles"] });
        },
        ...options,
    });
}

/**
 * 删除角色
 * @description 删除指定角色
 * @param options Mutation 配置选项
 * @returns Mutation 对象
 */
export function useDeleteRoleMutation(
    options?: MutationOptionsUtil<void, string>,
): UseMutationResult<void, Error, string, unknown> {
    const queryClient = useQueryClient();
    return useMutation<void, Error, string>({
        mutationFn: (id) => consoleHttpClient.delete<void>(`/role/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["roles"] });
        },
        ...options,
    });
}

/**
 * 批量删除角色
 * @description 批量删除多个角色
 * @param options Mutation 配置选项
 * @returns Mutation 对象
 */
export function useBatchDeleteRolesMutation(
    options?: MutationOptionsUtil<void, string[]>,
): UseMutationResult<void, Error, string[], unknown> {
    const queryClient = useQueryClient();
    return useMutation<void, Error, string[]>({
        mutationFn: async (ids) => {
            await Promise.all(ids.map((id) => consoleHttpClient.delete<void>(`/role/${id}`)));
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["roles"] });
        },
        ...options,
    });
}

/**
 * 分配角色权限
 * @description 为角色分配权限
 * @param options Mutation 配置选项
 * @returns Mutation 对象
 */
export function useAssignPermissionsMutation(
    options?: MutationOptionsUtil<RoleEntity, AssignPermissionsDto>,
): UseMutationResult<RoleEntity, Error, AssignPermissionsDto, unknown> {
    const queryClient = useQueryClient();
    return useMutation<RoleEntity, Error, AssignPermissionsDto>({
        mutationFn: (data) => consoleHttpClient.put<RoleEntity>("/role/permissions", data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["roles"] });
        },
        ...options,
    });
}

export function useRolePermissionsChecklistQuery(
    roleId: string,
    params?: { isDeprecated?: boolean; isGrouped?: boolean },
    options?: QueryOptionsUtil<RolePermissionChecklistItem[] | RolePermissionChecklistGroup[]>,
): UseQueryResult<RolePermissionChecklistItem[] | RolePermissionChecklistGroup[], Error> {
    return useQuery<RolePermissionChecklistItem[] | RolePermissionChecklistGroup[]>({
        queryKey: ["roles", "permissions-checklist", roleId, params],
        queryFn: () =>
            consoleHttpClient.get<RolePermissionChecklistItem[] | RolePermissionChecklistGroup[]>(
                `/role/permissions/${roleId}`,
                { params },
            ),
        enabled: !!roleId && options?.enabled !== false,
        ...options,
    });
}

export function useRoleUsersQuery(
    roleId: string,
    options?: QueryOptionsUtil<RoleUser[]>,
): UseQueryResult<RoleUser[], Error> {
    return useQuery<RoleUser[]>({
        queryKey: ["roles", "users", roleId],
        queryFn: () => consoleHttpClient.get<RoleUser[]>(`/role/user/${roleId}`),
        enabled: !!roleId && options?.enabled !== false,
        ...options,
    });
}
