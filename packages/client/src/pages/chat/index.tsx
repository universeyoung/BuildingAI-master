import { definePageMeta, useDocumentHead } from "@buildingai/hooks";
import {
  type ChatConfig,
  useAiProvidersQuery,
  useChatConfigQuery,
  useConversationQuery,
} from "@buildingai/services/web";
import { useMemo } from "react";
import { useParams } from "react-router-dom";

import type { Suggestion } from "@/components/ask-assistant-ui";
import { AssistantProvider, Chat, useAssistant } from "@/components/ask-assistant-ui";

const DEFAULT_SUGGESTIONS: Suggestion[] = [
  { id: "1", text: "如何开始使用 React Hooks？" },
  { id: "2", text: "TypeScript 的最佳实践是什么？" },
  { id: "3", text: "如何优化 React 应用的性能？" },
];

export const meta = definePageMeta({
  title: "对话",
  description: "开始新的对话",
  icon: "square-pen",
});

const IndexPage = () => {
  const { id } = useParams<{ id: string }>();
  const { data: providers = [] } = useAiProvidersQuery({ supportedModelTypes: "llm" });
  const { data: conversation } = useConversationQuery(id || "", { enabled: !!id });
  const { data: rawChatConfig } = useChatConfigQuery();
  const chatConfig = rawChatConfig as ChatConfig | undefined;

  useDocumentHead({
    title: id ? conversation?.title || "新对话" : "新对话",
  });

  const suggestions: Suggestion[] = useMemo(() => {
    if (!chatConfig) return DEFAULT_SUGGESTIONS;
    if (!chatConfig.suggestionsEnabled) return [];
    const list = Array.isArray(chatConfig.suggestions) ? chatConfig.suggestions : [];
    return list
      .filter((item): item is { icon?: string; text: string } => Boolean(item?.text))
      .map((item, index) => ({ id: String(index), text: item.text }));
  }, [chatConfig]);

  const welcomeInfo = chatConfig?.welcomeInfo;

  const assistant = useAssistant({ providers, suggestions });

  return (
    <AssistantProvider {...assistant}>
      <Chat
        title={conversation?.title || "新对话"}
        welcomeTitle={welcomeInfo?.title}
        welcomeDescription={welcomeInfo?.description}
        footerText={welcomeInfo?.footer}
      />
    </AssistantProvider>
  );
};

export default IndexPage;
