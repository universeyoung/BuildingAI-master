import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiHttpClient } from "../base";

export type AgentMessageFeedbackType = "like" | "dislike";

export type AgentMessageFeedbackRecord = {
    id: string;
    messageId: string;
    conversationId: string;
    userId?: string | null;
    type: AgentMessageFeedbackType;
    dislikeReason?: string | null;
    confidenceScore: number;
    createdAt: string;
    updatedAt: string;
};

export type AddAgentMessageFeedbackParams = {
    type: AgentMessageFeedbackType;
    dislikeReason?: string;
};

export async function addAgentMessageFeedback(
    agentId: string,
    conversationId: string,
    messageId: string,
    params: AddAgentMessageFeedbackParams,
): Promise<AgentMessageFeedbackRecord> {
    return apiHttpClient.post<AgentMessageFeedbackRecord>(
        `/ai-agents/${agentId}/chat/conversations/${conversationId}/messages/${messageId}/feedback`,
        params,
    );
}

export async function removeAgentMessageLikeDislike(
    agentId: string,
    conversationId: string,
    messageId: string,
    type: "like" | "dislike",
): Promise<void> {
    const search = new URLSearchParams({ type });
    return apiHttpClient.delete<void>(
        `/ai-agents/${agentId}/chat/conversations/${conversationId}/messages/${messageId}/feedback?${search.toString()}`,
    );
}

export async function listAgentMessageFeedbacks(
    agentId: string,
    conversationId: string,
    messageId: string,
): Promise<AgentMessageFeedbackRecord[]> {
    return apiHttpClient.get<AgentMessageFeedbackRecord[]>(
        `/ai-agents/${agentId}/chat/conversations/${conversationId}/messages/${messageId}/feedbacks`,
    );
}

const MESSAGE_FEEDBACKS_KEY = ["agents", "chat", "messages", "feedbacks"] as const;

export function useAgentMessageFeedbacksQuery(
    agentId: string | undefined,
    conversationId: string | undefined,
    messageId: string | undefined,
    options?: { enabled?: boolean },
) {
    return useQuery({
        queryKey: [...MESSAGE_FEEDBACKS_KEY, agentId ?? "", conversationId ?? "", messageId ?? ""],
        queryFn: () => listAgentMessageFeedbacks(agentId!, conversationId!, messageId!),
        enabled: !!agentId && !!conversationId && !!messageId && options?.enabled !== false,
    });
}

export function useAddAgentMessageFeedbackMutation(
    agentId: string,
    conversationId: string,
    messageId: string,
) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (params: AddAgentMessageFeedbackParams) =>
            addAgentMessageFeedback(agentId, conversationId, messageId, params),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: [...MESSAGE_FEEDBACKS_KEY, agentId, conversationId, messageId],
            });
        },
    });
}

export function useRemoveAgentMessageLikeDislikeMutation(
    agentId: string,
    conversationId: string,
    messageId: string,
) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (type: "like" | "dislike") =>
            removeAgentMessageLikeDislike(agentId, conversationId, messageId, type),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: [...MESSAGE_FEEDBACKS_KEY, agentId, conversationId, messageId],
            });
        },
    });
}
