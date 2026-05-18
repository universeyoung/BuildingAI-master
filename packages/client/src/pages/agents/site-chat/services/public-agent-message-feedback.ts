import { createHttpClient } from "@buildingai/utils/http-client";

import { getApiBaseUrl } from "@/utils/api";

export type PublicAgentMessageFeedbackType = "like" | "dislike";

function createPublicAgentMessageFeedbackClient(accessToken: string, anonymousIdentifier?: string) {
  return createHttpClient({
    baseURL: getApiBaseUrl(),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(anonymousIdentifier ? { "X-Anonymous-Identifier": anonymousIdentifier } : {}),
    },
  });
}

export async function addPublicAgentMessageFeedback(args: {
  conversationId: string;
  messageId: string;
  accessToken: string;
  anonymousIdentifier?: string;
  type: PublicAgentMessageFeedbackType;
  dislikeReason?: string;
}): Promise<void> {
  const client = createPublicAgentMessageFeedbackClient(args.accessToken, args.anonymousIdentifier);
  await client.post<void>(`/v1/messages/${args.conversationId}/${args.messageId}/feedback`, {
    type: args.type,
    ...(args.dislikeReason ? { dislikeReason: args.dislikeReason } : {}),
  });
}

export async function removePublicAgentMessageLikeDislike(args: {
  conversationId: string;
  messageId: string;
  accessToken: string;
  anonymousIdentifier?: string;
  type: PublicAgentMessageFeedbackType;
}): Promise<void> {
  const client = createPublicAgentMessageFeedbackClient(args.accessToken, args.anonymousIdentifier);
  await client.delete<void>(`/v1/messages/${args.conversationId}/${args.messageId}/feedback`, {
    params: { type: args.type },
  });
}
