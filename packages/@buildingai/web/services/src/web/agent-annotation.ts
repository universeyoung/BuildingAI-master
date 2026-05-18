import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiHttpClient } from "../base";

export type AgentAnnotationRecord = {
    id: string;
    agentId: string;
    question: string;
    answer: string;
    hitCount: number;
    enabled: boolean;
    createdBy?: string | null;
    anonymousIdentifier?: string | null;
    createdAt: string;
    updatedAt: string;
    user?: { id: string; nickname?: string | null; avatar?: string | null } | null;
};

export type ListAgentAnnotationsParams = {
    page?: number;
    pageSize?: number;
    keyword?: string;
    enabled?: boolean;
};

export type ListAgentAnnotationsResult = {
    items: AgentAnnotationRecord[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
};

export type CreateAgentAnnotationParams = {
    question: string;
    answer: string;
    enabled?: boolean;
    messageId?: string;
};

export type UpdateAgentAnnotationParams = {
    question?: string;
    answer?: string;
    enabled?: boolean;
    messageId?: string;
};

export async function listAgentAnnotations(
    agentId: string,
    params?: ListAgentAnnotationsParams,
): Promise<ListAgentAnnotationsResult> {
    const search = new URLSearchParams();
    if (params?.page != null) search.set("page", String(params.page));
    if (params?.pageSize != null) search.set("pageSize", String(params.pageSize));
    if (params?.keyword?.trim()) search.set("keyword", params.keyword.trim());
    if (params?.enabled !== undefined) search.set("enabled", String(params.enabled));
    const qs = search.toString();
    return apiHttpClient.get<ListAgentAnnotationsResult>(
        qs ? `/ai-agents/${agentId}/annotations?${qs}` : `/ai-agents/${agentId}/annotations`,
    );
}

export async function createAgentAnnotation(
    agentId: string,
    params: CreateAgentAnnotationParams,
): Promise<AgentAnnotationRecord> {
    return apiHttpClient.post<AgentAnnotationRecord>(`/ai-agents/${agentId}/annotations`, params);
}

export async function getAgentAnnotation(
    agentId: string,
    annotationId: string,
): Promise<AgentAnnotationRecord> {
    return apiHttpClient.get<AgentAnnotationRecord>(
        `/ai-agents/${agentId}/annotations/${annotationId}`,
    );
}

export async function updateAgentAnnotation(
    agentId: string,
    annotationId: string,
    params: UpdateAgentAnnotationParams,
): Promise<AgentAnnotationRecord> {
    return apiHttpClient.patch<AgentAnnotationRecord>(
        `/ai-agents/${agentId}/annotations/${annotationId}`,
        params,
    );
}

export async function deleteAgentAnnotation(agentId: string, annotationId: string): Promise<void> {
    return apiHttpClient.delete<void>(`/ai-agents/${agentId}/annotations/${annotationId}`);
}

export async function deleteAllAgentAnnotations(agentId: string): Promise<{ deleted: number }> {
    return apiHttpClient.delete<{ deleted: number }>(`/ai-agents/${agentId}/annotations`);
}

export async function importAgentAnnotationsFromCsv(
    agentId: string,
    file: File,
): Promise<{ imported: number }> {
    const form = new FormData();
    form.append("file", file);
    return apiHttpClient.upload<{ imported: number }>(
        `/ai-agents/${agentId}/annotations/import`,
        form,
    );
}

const ANNOTATIONS_LIST_KEY = ["agents", "annotations"] as const;

export function useAgentAnnotationsQuery(
    agentId: string | undefined,
    params?: ListAgentAnnotationsParams,
    options?: { enabled?: boolean },
) {
    return useQuery({
        queryKey: [
            ...ANNOTATIONS_LIST_KEY,
            agentId ?? "",
            params?.page,
            params?.pageSize,
            params?.keyword,
            params?.enabled,
        ],
        queryFn: () => listAgentAnnotations(agentId!, params),
        enabled: !!agentId && options?.enabled !== false,
    });
}

export function useAgentAnnotationDetailQuery(
    agentId: string | undefined,
    annotationId: string | undefined,
    options?: { enabled?: boolean },
) {
    return useQuery({
        queryKey: [...ANNOTATIONS_LIST_KEY, agentId ?? "", "detail", annotationId ?? ""],
        queryFn: () => getAgentAnnotation(agentId!, annotationId!),
        enabled: !!agentId && !!annotationId && options?.enabled !== false,
    });
}

export function useCreateAgentAnnotationMutation(agentId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (params: CreateAgentAnnotationParams) => createAgentAnnotation(agentId, params),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [...ANNOTATIONS_LIST_KEY, agentId] });
        },
    });
}

export function useUpdateAgentAnnotationMutation(agentId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({
            annotationId,
            params,
        }: {
            annotationId: string;
            params: UpdateAgentAnnotationParams;
        }) => updateAgentAnnotation(agentId, annotationId, params),
        onSuccess: (_, { annotationId }) => {
            queryClient.invalidateQueries({ queryKey: [...ANNOTATIONS_LIST_KEY, agentId] });
            queryClient.invalidateQueries({
                queryKey: [...ANNOTATIONS_LIST_KEY, agentId, "detail", annotationId],
            });
        },
    });
}

export function useDeleteAgentAnnotationMutation(agentId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (annotationId: string) => deleteAgentAnnotation(agentId, annotationId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [...ANNOTATIONS_LIST_KEY, agentId] });
        },
    });
}

export function useDeleteAllAgentAnnotationsMutation(agentId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => deleteAllAgentAnnotations(agentId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [...ANNOTATIONS_LIST_KEY, agentId] });
        },
    });
}

export function useImportAgentAnnotationsMutation(agentId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (file: File) => importAgentAnnotationsFromCsv(agentId, file),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [...ANNOTATIONS_LIST_KEY, agentId] });
        },
    });
}
