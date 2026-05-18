import type { ToolUIPart, UIMessage } from "ai";
import type { ReactNode, RefObject } from "react";

export interface MessageAttachment {
  type: "file";
  url: string;
  mediaType?: string;
  filename?: string;
}

export interface MessageVersion {
  id: string;
  content: string;
  attachments?: MessageAttachment[];
}

export interface MessageSource {
  href: string;
  title: string;
}

export interface MessageReasoning {
  content: string;
  duration: number;
}

export interface MessageToolCall {
  name: string;
  description: string;
  status: ToolUIPart["state"];
  parameters: Record<string, unknown>;
  result: string | undefined;
  error: string | undefined;
}

export interface Message {
  key: string;
  from: "user" | "assistant";
  versions: MessageVersion[];
  activeVersionIndex?: number;
  sources?: MessageSource[];
  reasoning?: MessageReasoning;
  tools?: MessageToolCall[];
}

export interface Model {
  id: string;
  name: string;
  chef: string;
  chefSlug: string;
  providers: string[];
  providerSortOrder?: number;
  providerCreatedAt?: string;
  features?: string[];
  thinking?: boolean;
  enableThinkingParam?: boolean;
  billingRule?: {
    power: number;
    tokens: number;
  };
  iconUrl?: string;
  membershipLevel?: string[];
}

export interface Suggestion {
  id: string;
  text: string;
}

export type ChatStatus = "ready" | "submitted" | "streaming" | "error";

export interface DisplayMessage {
  id: string;
  message: UIMessage;
  parentId: string | null;
  sequence: number;
  branchNumber: number;
  branchCount: number;
  branches: string[];
  isLast: boolean;
}

export interface VoiceConfigContext {
  stt?: { modelId: string; language?: string };
  tts?: { modelId: string; voiceId?: string; speed?: number };
}

export interface AssistantContextValue {
  agentId?: string;
  voiceConfig?: VoiceConfigContext | null;
  messages: UIMessage[];
  displayMessages: DisplayMessage[];
  currentThreadId?: string;
  status: ChatStatus;
  streamingMessageId: string | null;
  isLoading: boolean;
  isLoadingMoreMessages: boolean;
  hasMoreMessages: boolean;

  models: Model[];
  selectedModelId: string;
  selectedMcpServerIds: string[];
  suggestions: Suggestion[];

  liked: Record<string, boolean>;
  disliked: Record<string, boolean>;

  textareaRef: RefObject<HTMLTextAreaElement | null>;

  onSend: (
    content: string,
    files?: Array<{ type: "file"; url: string; mediaType?: string; filename?: string }>,
  ) => void;
  onLoadMoreMessages: () => void;
  onStop: () => void;
  onRegenerate: (messageKey: string) => void;
  onEditMessage: (
    messageId: string,
    newContent: string,
    files?: Array<{ type: "file"; url: string; mediaType?: string; filename?: string }>,
  ) => void;
  onSwitchBranch: (messageId: string) => void;
  onSelectModel: (id: string) => void;
  onSelectMcpServers: (ids: string[]) => void;
  onSetFeature: (key: string, value: boolean) => void;
  onLike?: (messageKey: string, liked: boolean) => void | Promise<void>;
  onDislike?: (
    messageKey: string,
    disliked: boolean,
    dislikeReason?: string,
    isUpdate?: boolean,
  ) => void | Promise<void>;
  addToolApprovalResponse?: (args: { id: string; approved: boolean; reason?: string }) => void;
  onSpeak?: (
    text: string,
    options?: { onReady?: (stop: () => void) => void },
  ) => void | Promise<void>;
  onVoiceAudio?: (audioBlob: Blob) => Promise<string | void>;
  showConversationContext?: boolean;
  showReference?: boolean;
  assistantAvatar?: string;
  historicalSessions?: DisplayMessage[][];
  /** Override available upload types (e.g. for third-party agents like Coze/Dify). */
  supportedUploadTypes?: Array<"image" | "video" | "audio" | "file">;
}

export interface AssistantProviderProps extends AssistantContextValue {
  children: ReactNode;
}
