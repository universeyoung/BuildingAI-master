import type { AgentChatMessageItem } from "@buildingai/services/web";
import { listAgentConversationMessages } from "@buildingai/services/web";
import type { UIMessage } from "ai";
import { useCallback, useEffect, useRef, useState } from "react";

const PAGE_SIZE = 20;

function convertToUIMessage(
  item: AgentChatMessageItem,
  index: number,
  args: { page: number; pageSize: number; total: number },
): UIMessage {
  const base = (item.message ?? {}) as Record<string, unknown>;
  const baseMetadata = (base.metadata ?? {}) as Record<string, unknown>;
  const overallDescIndex = (args.page - 1) * args.pageSize + index;
  const sequenceAsc = args.total - 1 - overallDescIndex;
  return {
    ...base,
    id: item.id,
    role: (base.role ?? item.role) as UIMessage["role"],
    metadata: {
      ...baseMetadata,
      parentId: item.parentId ?? null,
      sequence: sequenceAsc,
    },
  } as UIMessage;
}

function mergeAndSort(base: UIMessage[], incoming: UIMessage[]): UIMessage[] {
  const map = new Map<string, UIMessage>();
  for (const m of base) map.set(m.id, m);
  for (const m of incoming) {
    if (!map.has(m.id)) map.set(m.id, m);
  }
  const arr = Array.from(map.values());
  arr.sort((a, b) => {
    const sa = (a.metadata as { sequence?: number } | undefined)?.sequence;
    const sb = (b.metadata as { sequence?: number } | undefined)?.sequence;
    return (typeof sa === "number" ? sa : 0) - (typeof sb === "number" ? sb : 0);
  });
  return arr;
}

export interface UseAgentMessagesPagingOptions {
  agentId: string;
  conversationId: string | undefined;
  setMessages: (messages: UIMessage[] | ((prev: UIMessage[]) => UIMessage[])) => void;
  lastMessageDbIdRef: React.RefObject<string | null>;
  shouldLoadInitial: boolean;
}

export interface UseAgentMessagesPagingReturn {
  isLoadingMessages: boolean;
  isLoadingMoreMessages: boolean;
  hasMoreMessages: boolean;
  loadMoreMessages: () => void;
}

export function useAgentMessagesPaging(
  options: UseAgentMessagesPagingOptions,
): UseAgentMessagesPagingReturn {
  const { agentId, conversationId, setMessages, lastMessageDbIdRef, shouldLoadInitial } = options;

  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isLoadingMoreMessages, setIsLoadingMoreMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);

  const prevConversationIdRef = useRef<string | undefined>(undefined);
  const nextPageRef = useRef(2);
  const loadMoreLockRef = useRef(false);

  useEffect(() => {
    const prevId = prevConversationIdRef.current;
    const switched = Boolean(prevId && prevId !== conversationId);

    if (switched) {
      setIsLoadingMessages(false);
      setIsLoadingMoreMessages(false);
      setHasMoreMessages(false);
      nextPageRef.current = 2;
      loadMoreLockRef.current = false;
    }

    prevConversationIdRef.current = conversationId;

    if (!conversationId) return;

    const shouldFetch = shouldLoadInitial || switched;
    if (!shouldFetch) return;

    setIsLoadingMessages(true);
    listAgentConversationMessages(agentId, conversationId, { page: 1, pageSize: PAGE_SIZE })
      .then((res) => {
        const total = res.total;
        const items = res.items.map((item, idx) =>
          convertToUIMessage(item, idx, { page: 1, pageSize: PAGE_SIZE, total }),
        );
        const sorted = mergeAndSort([], items);
        setHasMoreMessages(res.page < res.totalPages);
        nextPageRef.current = Math.max(2, res.page + 1);
        setMessages(sorted);
        if (sorted.length > 0) {
          lastMessageDbIdRef.current = sorted[sorted.length - 1].id;
        }
      })
      .catch(() => {})
      .finally(() => {
        setIsLoadingMessages(false);
      });
  }, [agentId, conversationId, shouldLoadInitial, setMessages, lastMessageDbIdRef]);

  const loadMoreMessages = useCallback(() => {
    if (!conversationId) return;
    if (!hasMoreMessages) return;
    if (isLoadingMoreMessages) return;
    if (loadMoreLockRef.current) return;

    loadMoreLockRef.current = true;
    setIsLoadingMoreMessages(true);

    const page = nextPageRef.current;
    void listAgentConversationMessages(agentId, conversationId, { page, pageSize: PAGE_SIZE })
      .then((res) => {
        const total = res.total;
        const incoming = res.items.map((item, idx) =>
          convertToUIMessage(item, idx, { page, pageSize: PAGE_SIZE, total }),
        );
        setHasMoreMessages(res.page < res.totalPages);
        nextPageRef.current = res.page + 1;
        setMessages((prev) => {
          const merged = mergeAndSort(prev, incoming);
          if (merged.length > 0) {
            lastMessageDbIdRef.current = merged[merged.length - 1].id;
          }
          return merged;
        });
      })
      .catch(() => {})
      .finally(() => {
        setIsLoadingMoreMessages(false);
        loadMoreLockRef.current = false;
      });
  }, [
    agentId,
    conversationId,
    hasMoreMessages,
    isLoadingMoreMessages,
    setMessages,
    lastMessageDbIdRef,
  ]);

  return { isLoadingMessages, isLoadingMoreMessages, hasMoreMessages, loadMoreMessages };
}
