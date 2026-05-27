import { useAuthStore } from "@buildingai/stores";
import type {
    PaginatedQueryOptionsUtil,
    PaginatedResponse,
    QueryOptionsUtil,
} from "@buildingai/web-types";
import type {
    UseMutationOptions,
    UseMutationResult,
    UseQueryResult,
} from "@tanstack/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
 
import { apiHttpClient } from "../base";
import type { MessageRecord } from "./chat";
 
export type PaginationParams = {
    page?: number;
    pageSize?: number;
};
 
export type ScheduledTask = {
    id: string;
    name: string;
    prompt: string | null;
    agentId: string;
    agent?: { id: string; name: string; avatar?: string };
    conversationMode: "new" | "continue";
    conversationId?: string | null;
    cronExpression: string;
    isEnabled: boolean;
    advancedSettings: Record<string, any> | null;
    lastRunAt: string | null;
    nextRunAt: string | null;
    totalRunCount: number;
    failCount: number;
    userId: string;
    createdAt: string;
    updatedAt: string;
    deletedAt: string | null;
};
 
export type ScheduledTaskRun = {
    id: string;
    taskId: string;
    task?: ScheduledTask;
    chatConversationId: string;
    status: "pending" | "running" | "success" | "failed";
    errorMessage: string | null;
    tokenUsed: number;
    startedAt: string | null;
    finishedAt: string | null;
    createdAt: string;
};
 
export type ScheduledTaskListParams = PaginationParams & {
    agentId?: string;
    isEnabled?: boolean;
    keyword?: string;
};
 
export function useScheduledTaskListQuery(
    params: ScheduledTaskListParams,
    options?: PaginatedQueryOptionsUtil<ScheduledTask>,
): UseQueryResult<PaginatedResponse<ScheduledTask>, unknown> {
    const { isLogin } = useAuthStore((state) => state.authActions);
 
    return useQuery<PaginatedResponse<ScheduledTask>>({
        queryKey: ["scheduled-tasks", params],
        queryFn: () =>
            apiHttpClient.get<PaginatedResponse<ScheduledTask>>("/scheduled-tasks", {
                params,
            }),
        enabled: isLogin() && options?.enabled !== false,
        ...options,
    });
}
 
export function useScheduledTaskDetailQuery(
    id: string,
    options?: QueryOptionsUtil<ScheduledTask>,
): UseQueryResult<ScheduledTask, unknown> {
    return useQuery<ScheduledTask>({
        queryKey: ["scheduled-task", id],
        queryFn: () => apiHttpClient.get<ScheduledTask>(`/scheduled-tasks/${id}`),
        enabled: !!id,
        ...options,
    });
}
 
export function useScheduledTaskRunsQuery(
    taskId: string,
    params: PaginationParams,
    options?: PaginatedQueryOptionsUtil<ScheduledTaskRun>,
): UseQueryResult<PaginatedResponse<ScheduledTaskRun>, unknown> {
    return useQuery<PaginatedResponse<ScheduledTaskRun>>({
        queryKey: ["scheduled-task-runs", taskId, params],
        queryFn: () =>
            apiHttpClient.get<PaginatedResponse<ScheduledTaskRun>>(
                `/scheduled-tasks/${taskId}/runs`,
                { params },
            ),
        enabled: !!taskId && options?.enabled !== false,
        ...options,
    });
}
 
export function useScheduledTaskRunMessagesQuery(
    runId: string,
    options?: PaginatedQueryOptionsUtil<MessageRecord>,
): UseQueryResult<PaginatedResponse<MessageRecord>, unknown> {
    return useQuery<PaginatedResponse<MessageRecord>>({
        queryKey: ["scheduled-task-run-messages", runId],
        queryFn: () =>
            apiHttpClient.get<PaginatedResponse<MessageRecord>>(
                `/scheduled-tasks/runs/${runId}/messages`,
            ),
        enabled: !!runId && options?.enabled !== false,
        ...options,
    });
}
 
export function useCreateScheduledTaskMutation(
    options?: UseMutationOptions<ScheduledTask, unknown, Partial<ScheduledTask>, unknown>,
): UseMutationResult<ScheduledTask, unknown, Partial<ScheduledTask>, unknown> {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: Partial<ScheduledTask>) =>
            apiHttpClient.post<ScheduledTask>("/scheduled-tasks", data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["scheduled-tasks"] });
        },
        ...options,
    });
}
 
export function useUpdateScheduledTaskMutation(
    options?: UseMutationOptions<
        ScheduledTask,
        unknown,
        { id: string; data: Partial<ScheduledTask> },
        unknown
    >,
): UseMutationResult<
    ScheduledTask,
    unknown,
    { id: string; data: Partial<ScheduledTask> },
    unknown
> {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<ScheduledTask> }) =>
            apiHttpClient.patch<ScheduledTask>(`/scheduled-tasks/${id}`, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["scheduled-tasks"] });
            queryClient.invalidateQueries({ queryKey: ["scheduled-task", variables.id] });
        },
        ...options,
    });
}
 
export function useDeleteScheduledTaskMutation(
    options?: UseMutationOptions<unknown, unknown, string, unknown>,
): UseMutationResult<unknown, unknown, string, unknown> {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => apiHttpClient.delete(`/scheduled-tasks/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["scheduled-tasks"] });
        },
        ...options,
    });
}
 
export function useToggleScheduledTaskMutation(
    options?: UseMutationOptions<ScheduledTask, unknown, string, unknown>,
): UseMutationResult<ScheduledTask, unknown, string, unknown> {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => apiHttpClient.post<ScheduledTask>(`/scheduled-tasks/${id}/toggle`),
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: ["scheduled-tasks"] });
            queryClient.invalidateQueries({ queryKey: ["scheduled-task", id] });
        },
        ...options,
    });
}
 
export function useRunScheduledTaskMutation(
    options?: UseMutationOptions<ScheduledTaskRun, unknown, string, unknown>,
): UseMutationResult<ScheduledTaskRun, unknown, string, unknown> {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) =>
            apiHttpClient.post<ScheduledTaskRun>(`/scheduled-tasks/${id}/run`),
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: ["scheduled-tasks"] });
            queryClient.invalidateQueries({ queryKey: ["scheduled-task", id] });
            queryClient.invalidateQueries({ queryKey: ["scheduled-task-runs"] });
        },
        ...options,
    });
}
