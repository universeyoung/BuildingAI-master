import { extractTextFromParts } from "@buildingai/ai-sdk/utils/token-usage";
import {
    type DocumentContent,
    parseFile,
    processFiles as processFilesUtil,
    type ProcessFilesWriter,
} from "@buildingai/ai-toolkit/utils";
import type { Agent } from "@buildingai/db/entities";
import { HttpErrorFactory } from "@buildingai/errors";
import type { ChatUIMessage } from "@buildingai/types";
import { AgentConfigService } from "@modules/config/services/agent-config.service";
import { Injectable, Logger } from "@nestjs/common";
import {
    createUIMessageStream,
    generateId,
    pipeUIMessageStreamToResponse,
    type UIMessage,
} from "ai";
import type { ServerResponse } from "http";
import { validate as isUUID } from "uuid";

import { AgentBillingHandler } from "../handlers/agent-billing";
import {
    DifyApiService,
    type DifyChatUsage,
    type DifyInputFile,
    type DifyToolCallPart,
} from "../integrations/dify-api.service";
import type { AgentChatCompletionParams } from "../services/agent-chat-completion.service";
import { AgentChatMessageService } from "../services/agent-chat-message.service";
import { AgentChatRecordService } from "../services/agent-chat-record.service";

type ProviderWriter = {
    write: (part: Record<string, any>) => void;
};

/**
 * Dify 智能体聊天 Provider。
 */
@Injectable()
export class DifyChatProvider {
    private readonly logger = new Logger(DifyChatProvider.name);

    constructor(
        private readonly difyApiService: DifyApiService,
        private readonly agentChatRecordService: AgentChatRecordService,
        private readonly agentChatMessageService: AgentChatMessageService,
        private readonly agentBillingHandler: AgentBillingHandler,
        private readonly agentConfigService: AgentConfigService,
    ) {}

    /**
     * 处理 Dify 流式对话。
     */
    async streamChat(
        agent: Agent,
        params: AgentChatCompletionParams,
        response: ServerResponse,
    ): Promise<void> {
        const saveConversation = params.saveConversation !== false;
        let localConversationId = saveConversation
            ? await this.resolveLocalConversationId(params)
            : undefined;
        const lastUserMessage = params.messages.findLast((message) => message.role === "user");
        const initialTitle = lastUserMessage
            ? extractTextFromParts(lastUserMessage.parts ?? []).fullText
            : "";

        if (saveConversation && !localConversationId) {
            const record = await this.agentChatRecordService.createConversation({
                agentId: params.agentId,
                userId: params.userId,
                anonymousIdentifier: params.anonymousIdentifier,
                title: initialTitle,
            });
            localConversationId = record.id;
        }

        const stream = createUIMessageStream({
            execute: async ({ writer }) => {
                if (localConversationId) {
                    writer.write({
                        type: "data-conversation-id",
                        data: localConversationId,
                        transient: true,
                    } as any);
                }

                const assistantMessageId = generateId();
                writer.write({ type: "start", messageId: assistantMessageId });
                writer.write({ type: "start-step" });

                const textId = "txt-0";
                let textStarted = false;

                const { messages: processedMessages, documentContents } = await processFilesUtil(
                    params.messages,
                    writer as unknown as ProcessFilesWriter,
                    parseFile,
                );

                const lastUser = processedMessages.findLast((message) => message.role === "user");
                let userText = lastUser ? extractTextFromParts(lastUser.parts ?? []).fullText : "";
                if (documentContents.length > 0) {
                    userText = this.appendDocumentContents(userText, documentContents);
                }

                const inputFiles = this.extractInputFiles(lastUser);
                if (!userText.trim() && inputFiles.length === 0) {
                    throw HttpErrorFactory.badRequest("Dify 对话内容不能为空");
                }

                const remoteConversationId = await this.resolveRemoteConversationId(
                    agent,
                    localConversationId,
                );
                const billingRule = await this.getBillingRule();
                const shouldCharge = params.isDebug !== true;
                if (shouldCharge && params.userId && billingRule) {
                    await this.agentBillingHandler.validateUserPower(params.userId, billingRule);
                }

                const difyResponse = await this.difyApiService.streamChat({
                    config: agent.thirdPartyIntegration,
                    userId: params.userId,
                    message: userText,
                    conversationId: remoteConversationId,
                    files: inputFiles,
                });

                const reader = difyResponse.body?.getReader();
                if (!reader) {
                    throw HttpErrorFactory.badRequest("Dify 未返回可读流");
                }

                const decoder = new TextDecoder();
                let buffer = "";
                let fullText = "";
                let usage: DifyChatUsage | undefined;
                let difyConversationId = remoteConversationId;
                let difyMessageId: string | undefined;
                const toolParts = new Map<string, DifyToolCallPart>();
                /** 已通过标准流协议发送过 tool-input-available 的 toolCallId 集合 */
                const emittedToolInputIds = new Set<string>();

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    if (!value) continue;

                    buffer += decoder.decode(value, { stream: true });
                    const chunks = buffer.split(/\n\n+/);
                    buffer = chunks.pop() ?? "";

                    for (const chunk of chunks) {
                        const parsed = this.difyApiService.parseStreamEvent(chunk);

                        // ---- 错误检测 ----
                        const errorMsg = this.difyApiService.extractError(
                            parsed.event,
                            parsed.data,
                        );
                        if (errorMsg) {
                            throw HttpErrorFactory.badRequest(`Dify 错误: ${errorMsg}`);
                        }

                        // ---- 标识提取 ----
                        const identifiers = this.difyApiService.extractIdentifiers(parsed.data);
                        difyConversationId = identifiers.conversationId ?? difyConversationId;
                        difyMessageId = identifiers.messageId ?? difyMessageId;

                        // ---- agent_thought：工具调用（使用标准流协议事件）----
                        const toolPart = this.difyApiService.extractToolCallPart(
                            parsed.event,
                            parsed.data,
                        );
                        if (toolPart) {
                            toolParts.set(toolPart.toolCallId, toolPart);

                            // 首次出现：发送 tool-input-available
                            if (!emittedToolInputIds.has(toolPart.toolCallId)) {
                                emittedToolInputIds.add(toolPart.toolCallId);
                                writer.write({
                                    type: "tool-input-available",
                                    toolCallId: toolPart.toolCallId,
                                    toolName: toolPart.toolName,
                                    input: toolPart.input ?? {},
                                    dynamic: true,
                                } as any);
                            }

                            // 有输出：发送 tool-output-available
                            if (
                                toolPart.state === "output-available" &&
                                toolPart.output !== undefined
                            ) {
                                writer.write({
                                    type: "tool-output-available",
                                    toolCallId: toolPart.toolCallId,
                                    output: toolPart.output,
                                    dynamic: true,
                                } as any);
                            }

                            // 有错误：发送 tool-output-error
                            if (toolPart.state === "output-error" && toolPart.errorText) {
                                writer.write({
                                    type: "tool-output-error",
                                    toolCallId: toolPart.toolCallId,
                                    errorText: toolPart.errorText,
                                    dynamic: true,
                                } as any);
                            }
                        }

                        // ---- 文本 delta ----
                        const deltaText = this.difyApiService.extractDeltaText(
                            parsed.event,
                            parsed.data,
                        );
                        if (deltaText) {
                            if (!textStarted) {
                                writer.write({ type: "text-start", id: textId });
                                textStarted = true;
                            }
                            fullText += deltaText;
                            writer.write({ type: "text-delta", id: textId, delta: deltaText });
                        }

                        // ---- message_end ----
                        const endInfo = this.difyApiService.extractMessageEnd(
                            parsed.event,
                            parsed.data,
                        );
                        if (endInfo) {
                            difyConversationId = endInfo.conversationId ?? difyConversationId;
                            difyMessageId = endInfo.messageId ?? difyMessageId;
                            usage = endInfo.usage ?? usage;
                        }
                    }
                }

                // 确保 text-start / text-end 配对
                if (!textStarted) {
                    writer.write({ type: "text-start", id: textId });
                }
                writer.write({ type: "text-end", id: textId });
                writer.write({ type: "finish-step" });
                writer.write({ type: "finish", finishReason: "stop" });

                let userConsumedPower = 0;
                if (
                    shouldCharge &&
                    saveConversation &&
                    localConversationId &&
                    params.userId &&
                    billingRule &&
                    usage
                ) {
                    userConsumedPower = await this.agentBillingHandler.deduct({
                        userId: params.userId,
                        conversationId: localConversationId,
                        usage,
                        billingRule,
                    });
                }
                writer.write({
                    type: "data-usage",
                    data: {
                        inputTokens: usage?.inputTokens ?? 0,
                        outputTokens: usage?.outputTokens ?? 0,
                        totalTokens: usage?.totalTokens ?? 0,
                        raw: {
                            prompt_tokens: usage?.inputTokens ?? 0,
                            completion_tokens: usage?.outputTokens ?? 0,
                            total_tokens: usage?.totalTokens ?? 0,
                        },
                        userConsumedPower,
                    },
                });

                const toolCallParts = Array.from(toolParts.values());
                const responseMessage: UIMessage = {
                    id: assistantMessageId,
                    role: "assistant",
                    parts: [
                        ...toolCallParts,
                        ...(fullText || toolCallParts.length === 0
                            ? [{ type: "text", text: fullText }]
                            : []),
                    ] as unknown as UIMessage["parts"],
                };
                const finished = [...params.messages, responseMessage];
                writer.write({
                    type: "data-conversation-context",
                    data: {
                        messageId: assistantMessageId,
                        messages: finished.map((message) => ({
                            role: message.role,
                            content:
                                extractTextFromParts(message.parts ?? []).fullText ||
                                "(无文本内容)",
                        })),
                    },
                });

                if (localConversationId) {
                    await this.agentChatRecordService.updateMetadata(localConversationId, {
                        provider: "dify",
                        difyConversationId,
                        difyMessageId,
                    });
                    await this.saveMessages({
                        conversationId: localConversationId,
                        params,
                        writer,
                        lastUser,
                        responseMessage,
                        usage,
                        userConsumedPower,
                        metadata: {
                            provider: "dify",
                            difyConversationId,
                            difyMessageId,
                            toolCalls: toolCallParts,
                        },
                    });
                }
            },
            onError: (error) => {
                const message = error instanceof Error ? error.message : String(error);
                this.logger.error(`Dify chat stream error: ${message}`);
                return message;
            },
        });

        pipeUIMessageStreamToResponse({ stream, response });
    }

    private async resolveLocalConversationId(
        params: AgentChatCompletionParams,
    ): Promise<string | undefined> {
        const requestedConversationId = params.conversationId;
        if (!requestedConversationId) {
            return undefined;
        }

        if (isUUID(requestedConversationId)) {
            return requestedConversationId;
        }

        const record = await this.agentChatRecordService.findConversationByDifyConversationId({
            agentId: params.agentId,
            userId: params.userId,
            difyConversationId: requestedConversationId,
        });
        if (record?.id) {
            this.logger.warn(
                `Received remote Dify conversation id as local conversationId, remapped to local record: ${requestedConversationId} -> ${record.id}`,
            );
            return record.id;
        }

        this.logger.warn(
            `Received non-UUID conversationId but no local record was found, a new local conversation will be created: ${requestedConversationId}`,
        );
        return undefined;
    }

    private async resolveRemoteConversationId(
        agent: Agent,
        localConversationId?: string,
    ): Promise<string | undefined> {
        if (agent.thirdPartyIntegration?.useExternalConversation === false) {
            return undefined;
        }
        if (!localConversationId) {
            return undefined;
        }

        const record = await this.agentChatRecordService.getConversation(localConversationId);
        const remoteConversationId = record?.metadata?.difyConversationId;
        return typeof remoteConversationId === "string" ? remoteConversationId : undefined;
    }

    private async saveMessages(params: {
        conversationId: string;
        params: AgentChatCompletionParams;
        writer: ProviderWriter;
        lastUser?: UIMessage;
        responseMessage: UIMessage;
        usage?: DifyChatUsage;
        userConsumedPower?: number;
        metadata?: Record<string, any>;
    }): Promise<void> {
        const {
            conversationId,
            params: chatParams,
            writer,
            lastUser,
            responseMessage,
            usage,
            userConsumedPower,
        } = params;
        const safeConversationId = isUUID(conversationId)
            ? conversationId
            : (
                  await this.agentChatRecordService.findConversationByDifyConversationId({
                      agentId: chatParams.agentId,
                      userId: chatParams.userId,
                      difyConversationId: conversationId,
                  })
              )?.id;

        if (!safeConversationId) {
            throw HttpErrorFactory.badRequest("Dify 本地会话不存在，无法保存消息");
        }

        let userMessageId: string | undefined;
        if (chatParams.isRegenerate) {
            userMessageId = chatParams.regenerateParentId;
        } else if (lastUser) {
            const savedUserMessage = await this.agentChatMessageService.createMessage({
                conversationId: safeConversationId,
                agentId: chatParams.agentId,
                userId: chatParams.userId,
                message: lastUser,
                formVariables: chatParams.formVariables,
                formFieldsInputs: chatParams.formFieldsInputs,
                parentId: chatParams.parentId,
            });
            userMessageId = savedUserMessage.id;
            writer.write({ type: "data-user-message-id", data: savedUserMessage.id });
        }

        const savedAssistantMessage = await this.agentChatMessageService.createMessage({
            conversationId: safeConversationId,
            agentId: chatParams.agentId,
            userId: chatParams.userId,
            message: {
                ...(responseMessage as ChatUIMessage),
                ...(usage ? { usage } : {}),
                ...(userConsumedPower != null ? { userConsumedPower } : {}),
            } as ChatUIMessage,
            parentId: userMessageId,
        });

        writer.write({
            type: "data-assistant-message-id",
            data: savedAssistantMessage.id,
        });
        await this.agentChatRecordService.updateStats(safeConversationId);
    }

    private async getBillingRule(): Promise<{ power: number; tokens: number } | undefined> {
        const config = await this.agentConfigService.getConfig();
        const item = config.createTypes.find((current) => current.key === "dify");
        if (!item?.enabled || item.billingMode !== "points") {
            return undefined;
        }

        const points = Math.max(0, Number(item.points ?? 0) || 0);
        if (points <= 0) {
            return undefined;
        }

        return {
            power: points,
            tokens: 1000,
        };
    }

    /**
     * Append parsed document contents to user message text.
     * Truncates per-document to avoid exceeding third-party length limits.
     */
    private appendDocumentContents(userText: string, documents: DocumentContent[]): string {
        const MAX_CHARS_PER_DOC = 30_000;
        const parts = documents.map((doc) => {
            const content =
                doc.content.length > MAX_CHARS_PER_DOC
                    ? doc.content.slice(0, MAX_CHARS_PER_DOC) + "\n...(truncated)"
                    : doc.content;
            return `<document name="${doc.filename}">\n${content}\n</document>`;
        });
        return `${userText}\n\n[Attached Documents]\n${parts.join("\n\n")}`;
    }

    /**
     * 从用户消息中提取 Dify 所需的多模态文件列表。
     */
    private extractInputFiles(message?: UIMessage): DifyInputFile[] {
        if (!message?.parts?.length) {
            return [];
        }

        const files: DifyInputFile[] = [];

        for (const part of message.parts as Array<Record<string, any>>) {
            if (part?.type !== "file") {
                continue;
            }

            const url = typeof part.url === "string" ? part.url.trim() : "";
            if (!url) {
                continue;
            }

            files.push({
                type: this.resolveDifyFileType(part.mediaType),
                transfer_method: "remote_url",
                url,
            });
        }

        return files;
    }

    /**
     * 将 MIME 类型映射为 Dify 文件类型。
     */
    private resolveDifyFileType(mediaType?: unknown): DifyInputFile["type"] {
        const value = typeof mediaType === "string" ? mediaType.toLowerCase() : "";
        if (value.startsWith("image/")) return "image";
        if (value.startsWith("audio/")) return "audio";
        if (value.startsWith("video/")) return "video";
        if (
            value.startsWith("text/") ||
            value.includes("pdf") ||
            value.includes("word") ||
            value.includes("sheet") ||
            value.includes("presentation") ||
            value.includes("document")
        ) {
            return "document";
        }
        return "custom";
    }
}
