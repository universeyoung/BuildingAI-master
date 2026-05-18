import { useMutation } from "@tanstack/react-query";

import { apiHttpClient } from "../base";

export type FeedbackType = "like" | "dislike";

export type CreateFeedbackDto = {
    messageId: string;
    type: FeedbackType;
    dislikeReason?: string;
};

export type UpdateFeedbackDto = {
    type: FeedbackType;
    dislikeReason?: string;
};

export function useCreateFeedbackMutation() {
    return useMutation<void, Error, CreateFeedbackDto>({
        mutationFn: (dto) => apiHttpClient.post<void>("/ai-chat-feedback", dto),
    });
}

export function useUpdateFeedbackMutation() {
    return useMutation<void, Error, { id: string; dto: UpdateFeedbackDto }>({
        mutationFn: ({ id, dto }) => apiHttpClient.put<void>(`/ai-chat-feedback/${id}`, dto),
    });
}
