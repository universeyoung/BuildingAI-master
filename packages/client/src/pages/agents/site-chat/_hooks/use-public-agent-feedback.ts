import type { UIMessage } from "ai";
import { useCallback, useMemo } from "react";

import {
  addPublicAgentMessageFeedback,
  type PublicAgentMessageFeedbackType,
  removePublicAgentMessageLikeDislike,
} from "../services/public-agent-message-feedback";

export function usePublicAgentFeedback(args: {
  agentId: string;
  accessToken: string;
  anonymousIdentifier?: string;
  messages: UIMessage[];
  setMessages: (messages: UIMessage[] | ((prev: UIMessage[]) => UIMessage[])) => void;
  canOperateMessage: boolean;
  conversationIdForMessageOps?: string;
  getDbMessageId: (clientMessageId: string) => string | undefined;
}) {
  const {
    agentId: _agentId,
    accessToken,
    anonymousIdentifier,
    messages,
    setMessages,
    canOperateMessage,
    conversationIdForMessageOps,
    getDbMessageId,
  } = args;
  const likedMap = useMemo(() => {
    const next: Record<string, boolean> = {};
    for (const msg of messages) {
      const type = (msg as unknown as { feedback?: { type?: PublicAgentMessageFeedbackType } })
        .feedback?.type;
      if (type === "like") next[msg.id] = true;
    }
    return next;
  }, [messages]);

  const dislikedMap = useMemo(() => {
    const next: Record<string, boolean> = {};
    for (const msg of messages) {
      const type = (msg as unknown as { feedback?: { type?: PublicAgentMessageFeedbackType } })
        .feedback?.type;
      if (type === "dislike") next[msg.id] = true;
    }
    return next;
  }, [messages]);

  const onLike = useCallback(
    async (messageClientId: string, liked: boolean) => {
      if (!canOperateMessage) return;
      if (!conversationIdForMessageOps) return;

      if (liked) {
        let prevFeedbackType: PublicAgentMessageFeedbackType | undefined;
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== messageClientId) return m;
            prevFeedbackType = (
              m as unknown as { feedback?: { type?: PublicAgentMessageFeedbackType } }
            ).feedback?.type;
            return {
              ...m,
              feedback: { type: "like" } as any,
            };
          }),
        );

        const messageId = getDbMessageId(messageClientId) ?? messageClientId;
        try {
          await addPublicAgentMessageFeedback({
            conversationId: conversationIdForMessageOps,
            messageId,
            accessToken,
            anonymousIdentifier,
            type: "like",
          });
        } catch {
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== messageClientId) return m;
              return {
                ...m,
                feedback: prevFeedbackType ? { type: prevFeedbackType } : undefined,
              };
            }),
          );
        }
      } else {
        let prevFeedbackType: PublicAgentMessageFeedbackType | undefined;
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== messageClientId) return m;
            prevFeedbackType = (
              m as unknown as { feedback?: { type?: PublicAgentMessageFeedbackType } }
            ).feedback?.type;
            return {
              ...m,
              feedback: undefined,
            };
          }),
        );

        const messageId = getDbMessageId(messageClientId) ?? messageClientId;
        try {
          await removePublicAgentMessageLikeDislike({
            conversationId: conversationIdForMessageOps,
            messageId,
            accessToken,
            anonymousIdentifier,
            type: "like",
          });
        } catch {
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== messageClientId) return m;
              return {
                ...m,
                feedback: prevFeedbackType ? { type: prevFeedbackType } : undefined,
              };
            }),
          );
        }
      }
    },
    [
      canOperateMessage,
      conversationIdForMessageOps,
      getDbMessageId,
      setMessages,
      accessToken,
      anonymousIdentifier,
    ],
  );

  const onDislike = useCallback(
    async (messageClientId: string, disliked: boolean, dislikeReason?: string) => {
      if (!canOperateMessage) return;

      if (!conversationIdForMessageOps) return;

      if (disliked) {
        let prevFeedbackType: PublicAgentMessageFeedbackType | undefined;
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== messageClientId) return m;
            prevFeedbackType = (
              m as unknown as { feedback?: { type?: PublicAgentMessageFeedbackType } }
            ).feedback?.type;
            return {
              ...m,
              feedback: { type: "dislike" } as any,
            };
          }),
        );

        const messageId = getDbMessageId(messageClientId) ?? messageClientId;
        try {
          await addPublicAgentMessageFeedback({
            conversationId: conversationIdForMessageOps,
            messageId,
            accessToken,
            anonymousIdentifier,
            type: "dislike",
            dislikeReason,
          });
        } catch {
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== messageClientId) return m;
              return {
                ...m,
                feedback: prevFeedbackType ? { type: prevFeedbackType } : undefined,
              };
            }),
          );
        }
      } else {
        let prevFeedbackType: PublicAgentMessageFeedbackType | undefined;
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== messageClientId) return m;
            prevFeedbackType = (
              m as unknown as { feedback?: { type?: PublicAgentMessageFeedbackType } }
            ).feedback?.type;
            return {
              ...m,
              feedback: undefined,
            };
          }),
        );

        const messageId = getDbMessageId(messageClientId) ?? messageClientId;
        try {
          await removePublicAgentMessageLikeDislike({
            conversationId: conversationIdForMessageOps,
            messageId,
            accessToken,
            anonymousIdentifier,
            type: "dislike",
          });
        } catch {
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== messageClientId) return m;
              return {
                ...m,
                feedback: prevFeedbackType ? { type: prevFeedbackType } : undefined,
              };
            }),
          );
        }
      }
    },
    [
      canOperateMessage,
      conversationIdForMessageOps,
      getDbMessageId,
      setMessages,
      accessToken,
      anonymousIdentifier,
    ],
  );

  return {
    likedMap,
    dislikedMap,
    onLike,
    onDislike,
  };
}
