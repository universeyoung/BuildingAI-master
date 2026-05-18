import type { UIMessage } from "ai";
import { useCallback, useEffect, useRef, useState } from "react";

import { getPublicConversationMessages } from "../services/public-conversation-messages";

const PAGE_SIZE = 50;

function getSequence(m: UIMessage): number {
  const s = (m.metadata as { sequence?: number } | undefined)?.sequence;
  return typeof s === "number" ? s : 0;
}

function mergeAndSort(base: UIMessage[], incoming: UIMessage[]): UIMessage[] {
  const map = new Map<string, UIMessage>();
  for (const m of base) map.set(m.id, m);
  for (const m of incoming) {
    if (!map.has(m.id)) map.set(m.id, m);
  }

  const arr = Array.from(map.values());
  arr.sort((a, b) => getSequence(a) - getSequence(b));
  return arr;
}

export interface UsePublicAgentMessagesPagingOptions {
  agentId: string;
  accessToken: string;
  anonymousIdentifier?: string;
  conversationId: string | undefined;
  setMessages: (messages: UIMessage[] | ((prev: UIMessage[]) => UIMessage[])) => void;
  shouldLoadInitial: boolean;
  onLoadError?: () => void;
}

export interface UsePublicAgentMessagesPagingReturn {
  isLoadingMessages: boolean;
  isLoadingMoreMessages: boolean;
  hasMoreMessages: boolean;
  loadMoreMessages: () => void;
}

export function usePublicAgentMessagesPaging(
  options: UsePublicAgentMessagesPagingOptions,
): UsePublicAgentMessagesPagingReturn {
  const {
    agentId,
    accessToken,
    anonymousIdentifier,
    conversationId,
    setMessages,
    shouldLoadInitial,
    onLoadError,
  } = options;

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
    getPublicConversationMessages({
      agentId,
      accessToken,
      anonymousIdentifier,
      conversationId,
      page: 1,
      pageSize: PAGE_SIZE,
    })
      .then((res) => {
        setHasMoreMessages(res.page < res.totalPages);
        nextPageRef.current = Math.max(2, res.page + 1);
        setMessages(res.items);
      })
      .catch(() => {
        onLoadError?.();
      })
      .finally(() => {
        setIsLoadingMessages(false);
      });
  }, [
    agentId,
    accessToken,
    anonymousIdentifier,
    conversationId,
    shouldLoadInitial,
    setMessages,
    onLoadError,
  ]);

  const loadMoreMessages = useCallback(() => {
    if (!conversationId) return;
    if (!hasMoreMessages) return;
    if (isLoadingMoreMessages) return;
    if (loadMoreLockRef.current) return;

    loadMoreLockRef.current = true;
    setIsLoadingMoreMessages(true);

    const page = nextPageRef.current;
    void getPublicConversationMessages({
      agentId,
      accessToken,
      anonymousIdentifier,
      conversationId,
      page,
      pageSize: PAGE_SIZE,
    })
      .then((res) => {
        setHasMoreMessages(res.page < res.totalPages);
        nextPageRef.current = res.page + 1;
        setMessages((prev) => mergeAndSort(prev, res.items));
      })
      .catch(() => {})
      .finally(() => {
        setIsLoadingMoreMessages(false);
        loadMoreLockRef.current = false;
      });
  }, [
    agentId,
    accessToken,
    anonymousIdentifier,
    conversationId,
    hasMoreMessages,
    isLoadingMoreMessages,
    setMessages,
  ]);

  return { isLoadingMessages, isLoadingMoreMessages, hasMoreMessages, loadMoreMessages };
}
