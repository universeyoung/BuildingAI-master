import type { MutationOptionsUtil, QueryOptionsUtil } from "@buildingai/web-types";
import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { consoleHttpClient } from "../base";

export interface DepartmentMember {
    id: string;
    joinAt?: string | null;
    username?: string;
    nickname?: string;
    realName?: string;
    avatar?: string;
    email?: string;
    phone?: string;
    manageStatus?: number;
    isRoot?: number;
    isPrincipal?: boolean;
    department?: string[];
    role?: {
        id: string;
        name: string;
    } | null;
}

export interface DepartmentItem {
    id: string;
    name: string;
    parentId?: string;
    level: number;
    system?: number;
    memberCount?: number;
    members?: DepartmentMember[];
    subDepartments?: DepartmentItem[];
}

export interface QueryDepartmentParams {
    keyword?: string;
}

export interface QueryDepartmentMembersParams {
    departmentId: string;
    keyword?: string;
    department?: string;
    role?: string;
    status?: "enabled" | "disabled";
}

export interface CreateDepartmentDto {
    name: string;
    parentId?: string;
}

export interface UpdateDepartmentNameDto {
    id: string;
    name: string;
}

export interface SetDepartmentPrincipalsDto {
    id: string;
    userIds: string[];
}

export interface SetDepartmentMembersDto {
    id: string;
    userIds: string[];
}

export interface UpdateDepartmentMemberDto {
    id: string;
    userId: string;
    targetDepartmentId?: string;
    departmentIds?: string[];
    roleId?: string;
    realName?: string;
    manageStatus?: number;
    isPrincipal?: boolean;
}

export interface BatchMoveDepartmentMembersDto {
    id: string;
    userIds: string[];
    targetDepartmentIds: string[];
}

export interface DepartmentFilterOptions {
    departments: Array<Pick<DepartmentItem, "id" | "name" | "parentId" | "level">>;
    roles: Array<{ id: string; name: string }>;
}

const DEPARTMENT_QUERY_KEY = "departments";
const DEPARTMENT_FILTER_OPTIONS_QUERY_KEY = "department-filter-options";
const DEPARTMENT_MEMBERS_QUERY_KEY = "department-members";

export function useDepartmentListQuery(
    params?: QueryDepartmentParams,
    options?: QueryOptionsUtil<DepartmentItem[]>,
): UseQueryResult<DepartmentItem[], Error> {
    return useQuery<DepartmentItem[]>({
        queryKey: [DEPARTMENT_QUERY_KEY, params],
        queryFn: () =>
            consoleHttpClient.get<DepartmentItem[]>("/department", {
                params,
            }),
        ...options,
    });
}

export function useDepartmentFilterOptionsQuery(
    options?: QueryOptionsUtil<DepartmentFilterOptions>,
): UseQueryResult<DepartmentFilterOptions, Error> {
    return useQuery<DepartmentFilterOptions>({
        queryKey: [DEPARTMENT_FILTER_OPTIONS_QUERY_KEY],
        queryFn: () => consoleHttpClient.get<DepartmentFilterOptions>("/department/filter-options"),
        ...options,
    });
}

export function useDepartmentMembersQuery(
    params: QueryDepartmentMembersParams,
    options?: QueryOptionsUtil<DepartmentMember[]>,
): UseQueryResult<DepartmentMember[], Error> {
    return useQuery<DepartmentMember[]>({
        queryKey: [DEPARTMENT_MEMBERS_QUERY_KEY, params],
        queryFn: () =>
            consoleHttpClient.get<DepartmentMember[]>("/department/members", {
                params,
            }),
        enabled: !!params.departmentId && options?.enabled !== false,
        ...options,
    });
}

export function useCreateDepartmentMutation(
    options?: MutationOptionsUtil<DepartmentItem, CreateDepartmentDto>,
): UseMutationResult<DepartmentItem, Error, CreateDepartmentDto, unknown> {
    const queryClient = useQueryClient();
    return useMutation<DepartmentItem, Error, CreateDepartmentDto>({
        mutationFn: (data) => consoleHttpClient.post<DepartmentItem>("/department", data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [DEPARTMENT_QUERY_KEY] });
            queryClient.invalidateQueries({ queryKey: [DEPARTMENT_FILTER_OPTIONS_QUERY_KEY] });
            queryClient.invalidateQueries({ queryKey: [DEPARTMENT_MEMBERS_QUERY_KEY] });
        },
        ...options,
    });
}

export function useUpdateDepartmentNameMutation(
    options?: MutationOptionsUtil<DepartmentItem, UpdateDepartmentNameDto>,
): UseMutationResult<DepartmentItem, Error, UpdateDepartmentNameDto, unknown> {
    const queryClient = useQueryClient();
    return useMutation<DepartmentItem, Error, UpdateDepartmentNameDto>({
        mutationFn: (body) => consoleHttpClient.put<DepartmentItem>("/department/updateName", body),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [DEPARTMENT_QUERY_KEY] });
            queryClient.invalidateQueries({ queryKey: [DEPARTMENT_FILTER_OPTIONS_QUERY_KEY] });
            queryClient.invalidateQueries({ queryKey: [DEPARTMENT_MEMBERS_QUERY_KEY] });
        },
        ...options,
    });
}

export function useDeleteDepartmentMutation(
    options?: MutationOptionsUtil<boolean, string>,
): UseMutationResult<boolean, Error, string, unknown> {
    const queryClient = useQueryClient();
    return useMutation<boolean, Error, string>({
        mutationFn: (id) => consoleHttpClient.delete<boolean>(`/department/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [DEPARTMENT_QUERY_KEY] });
            queryClient.invalidateQueries({ queryKey: [DEPARTMENT_FILTER_OPTIONS_QUERY_KEY] });
            queryClient.invalidateQueries({ queryKey: [DEPARTMENT_MEMBERS_QUERY_KEY] });
        },
        ...options,
    });
}

export function useSetDepartmentPrincipalsMutation(
    options?: MutationOptionsUtil<boolean, SetDepartmentPrincipalsDto>,
): UseMutationResult<boolean, Error, SetDepartmentPrincipalsDto, unknown> {
    const queryClient = useQueryClient();
    return useMutation<boolean, Error, SetDepartmentPrincipalsDto>({
        mutationFn: (body) => consoleHttpClient.put<boolean>("/department/setPrincipals", body),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [DEPARTMENT_QUERY_KEY] });
            queryClient.invalidateQueries({ queryKey: [DEPARTMENT_MEMBERS_QUERY_KEY] });
        },
        ...options,
    });
}

export function useAddDepartmentMembersMutation(
    options?: MutationOptionsUtil<boolean, SetDepartmentMembersDto>,
): UseMutationResult<boolean, Error, SetDepartmentMembersDto, unknown> {
    const queryClient = useQueryClient();
    return useMutation<boolean, Error, SetDepartmentMembersDto>({
        mutationFn: (body) => consoleHttpClient.post<boolean>("/department/addMembers", body),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [DEPARTMENT_QUERY_KEY] });
            queryClient.invalidateQueries({ queryKey: [DEPARTMENT_MEMBERS_QUERY_KEY] });
        },
        ...options,
    });
}

export function useRemoveDepartmentMembersMutation(
    options?: MutationOptionsUtil<boolean, SetDepartmentMembersDto>,
): UseMutationResult<boolean, Error, SetDepartmentMembersDto, unknown> {
    const queryClient = useQueryClient();
    return useMutation<boolean, Error, SetDepartmentMembersDto>({
        mutationFn: (body) => consoleHttpClient.post<boolean>("/department/removeMembers", body),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [DEPARTMENT_QUERY_KEY] });
            queryClient.invalidateQueries({ queryKey: [DEPARTMENT_MEMBERS_QUERY_KEY] });
        },
        ...options,
    });
}

export function useBatchMoveDepartmentMembersMutation(
    options?: MutationOptionsUtil<boolean, BatchMoveDepartmentMembersDto>,
): UseMutationResult<boolean, Error, BatchMoveDepartmentMembersDto, unknown> {
    const queryClient = useQueryClient();
    return useMutation<boolean, Error, BatchMoveDepartmentMembersDto>({
        mutationFn: (body) => consoleHttpClient.post<boolean>("/department/batchMoveMembers", body),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [DEPARTMENT_QUERY_KEY] });
            queryClient.invalidateQueries({ queryKey: [DEPARTMENT_MEMBERS_QUERY_KEY] });
        },
        ...options,
    });
}

export function useUpdateDepartmentMemberMutation(
    options?: MutationOptionsUtil<boolean, UpdateDepartmentMemberDto>,
): UseMutationResult<boolean, Error, UpdateDepartmentMemberDto, unknown> {
    const queryClient = useQueryClient();
    return useMutation<boolean, Error, UpdateDepartmentMemberDto>({
        mutationFn: (body) => consoleHttpClient.post<boolean>("/department/updateMember", body),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [DEPARTMENT_QUERY_KEY] });
            queryClient.invalidateQueries({ queryKey: [DEPARTMENT_MEMBERS_QUERY_KEY] });
        },
        ...options,
    });
}
