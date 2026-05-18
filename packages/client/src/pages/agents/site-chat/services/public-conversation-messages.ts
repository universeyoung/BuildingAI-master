import { useQuery } from "@tanstack/react-query";
import type { UIMessage } from "ai";

import { getApiBaseUrl } from "@/utils/api";

import { fetchPublicJson } from "./public-http";

const DEFAULT_PAGE_SIZE = 50;

type PublicConversationMessagesResult = {
  items: Array<{
    id: string;
    parentId?: string | null;
    message?: {
      role?: string;
      parts?: unknown[];
      metadata?: Record<string, unknown>;
      [key: string]: unknown;
    };
  }>;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

function convertToUIMessage(
  item: PublicConversationMessagesResult["items"][number],
  index: number,
  args: { page: number; pageSize: number; total: number },
): UIMessage {
  const base = (item.message ?? {}) as Record<string, unknown>;
  const baseMetadata = (base.metadata ?? {}) as Record<string, unknown>;
  const role = (base.role ?? "user") as UIMessage["role"];

  const overallDescIndex = (args.page - 1) * args.pageSize + index;
  const sequenceAsc = args.total - 1 - overallDescIndex;

  return {
    ...base,
    id: item.id,
    role,
    metadata: {
      ...baseMetadata,
      parentId: item.parentId ?? null,
      sequence: sequenceAsc,
    },
  } as UIMessage;
}

export type PublicConversationMessagesPagingResult = {
  items: UIMessage[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export async function getPublicConversationMessages(args: {
  agentId: string;
  accessToken: string;
  conversationId: string;
  page?: number;
  pageSize?: number;
  anonymousIdentifier?: string;
}): Promise<PublicConversationMessagesPagingResult> {
  const page = args.page ?? 1;
  const pageSize = args.pageSize ?? DEFAULT_PAGE_SIZE;
  const url = `${getApiBaseUrl()}/v1/messages/${args.conversationId}?page=${page}&pageSize=${pageSize}`;
  const data = await fetchPublicJson<PublicConversationMessagesResult>(
    url,
    args.accessToken,
    args.anonymousIdentifier,
  );
  const items = data.items ?? [];
  const total = typeof data.total === "number" ? data.total : items.length;

  const mapped = items.map((item, idx) => convertToUIMessage(item, idx, { page, pageSize, total }));
  mapped.sort((a, b) => {
    const sa = (a.metadata as { sequence?: number } | undefined)?.sequence;
    const sb = (b.metadata as { sequence?: number } | undefined)?.sequence;
    return (typeof sa === "number" ? sa : 0) - (typeof sb === "number" ? sb : 0);
  });
  return {
    items: mapped,
    total,
    page,
    pageSize,
    totalPages: data.totalPages ?? Math.ceil(total / pageSize),
  };
}

export function usePublicConversationMessages(
  agentId: string | undefined,
  accessToken: string | undefined,
  conversationId: string | undefined,
  anonymousIdentifier?: string,
) {
  return useQuery<UIMessage[]>({
    queryKey: [
      "public-agent-conversation-messages",
      agentId ?? "",
      accessToken ?? "",
      conversationId ?? "",
      anonymousIdentifier ?? "",
    ],
    enabled: Boolean(agentId && accessToken && conversationId),
    refetchOnWindowFocus: false,
    queryFn: () =>
      getPublicConversationMessages({
        agentId: agentId!,
        accessToken: accessToken!,
        conversationId: conversationId!,
        page: 1,
        pageSize: DEFAULT_PAGE_SIZE,
        anonymousIdentifier,
      }).then((r) => r.items),
  });
}
