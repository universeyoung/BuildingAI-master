import { HttpErrorFactory } from "@buildingai/errors";
import type { ThirdPartyIntegrationConfig } from "@buildingai/types/ai/agent-config.interface";
import { Injectable, Logger } from "@nestjs/common";

export interface CozeBotInfo {
    id?: string;
    name?: string;
    description?: string;
    iconUrl?: string;
    openingStatement?: string;
    openingQuestions?: string[];
    raw: Record<string, any>;
}

export interface CozeChatUsage {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
}

export interface CozeToolCallPart {
    type: "dynamic-tool";
    toolCallId: string;
    toolName: string;
    state: "input-available" | "output-available" | "output-error";
    input: Record<string, any>;
    output?: unknown;
    errorText?: string;
}

export interface CozeMessageObject {
    type: "text" | "image" | "file";
    text?: string;
    file_id?: string;
    file_url?: string;
    url?: string;
    name?: string;
    mime_type?: string;
}

export interface CozeStreamChatParams {
    config: ThirdPartyIntegrationConfig;
    userId: string;
    message: string;
    conversationId?: string;
    /** 历史消息列表,用于提供上下文 */
    messages?: Array<{
        role: string;
        content: string;
        objects?: CozeMessageObject[];
    }>;
    objects?: CozeMessageObject[];
}

/**
 * Coze OpenAPI 访问服务。
 */
@Injectable()
export class CozeApiService {
    private readonly logger = new Logger(CozeApiService.name);

    /**
     * Coze 官方默认地址。
     */
    readonly defaultBaseUrl = "https://api.coze.cn";

    /**
     * 规范化第三方配置。
     */
    normalizeConfig(config?: ThirdPartyIntegrationConfig | null): ThirdPartyIntegrationConfig {
        const normalized = {
            ...(config ?? {}),
        } as ThirdPartyIntegrationConfig & { provider?: "coze" | "dify" };
        const extendedConfig = { ...(config?.extendedConfig ?? {}) };
        const provider = (config as { provider?: "coze" | "dify" } | null | undefined)?.provider;
        const botId = this.resolveBotId(config);
        const normalizedProvider = provider === "dify" ? "dify" : "coze";

        if (botId) {
            extendedConfig.botId = botId;
        }
        extendedConfig.provider = normalizedProvider;
        normalized.provider = normalizedProvider;
        normalized.appId = botId ?? config?.appId;
        normalized.apiKey = config?.apiKey?.trim();
        normalized.baseURL = this.normalizeBaseUrl(config?.baseURL);
        normalized.extendedConfig = extendedConfig;
        normalized.useExternalConversation = config?.useExternalConversation ?? true;

        return normalized;
    }

    /**
     * 判断当前配置是否满足 Coze 最小可用条件。
     */
    hasValidConfig(config?: ThirdPartyIntegrationConfig | null): boolean {
        const normalized = this.normalizeConfig(config);
        return Boolean(normalized.apiKey && this.resolveBotId(normalized));
    }

    /**
     * 获取 Coze Bot 基础信息。
     */
    async getBotInfo(config?: ThirdPartyIntegrationConfig | null): Promise<CozeBotInfo> {
        const normalized = this.normalizeConfig(config);
        const apiKey = normalized.apiKey?.trim();
        const botId = this.resolveBotId(normalized);

        if (!apiKey) {
            throw HttpErrorFactory.badRequest("Coze API Key 未配置");
        }
        if (!botId) {
            throw HttpErrorFactory.badRequest("Coze Bot ID 未配置");
        }

        const candidates: Array<{
            url: string;
            method: "GET" | "POST";
            body?: Record<string, any>;
        }> = [
            {
                url: `${normalized.baseURL}/v1/bots/retrieve`,
                method: "POST",
                body: { bot_id: botId },
            },
            {
                url: `${normalized.baseURL}/v1/bot/get`,
                method: "POST",
                body: { bot_id: botId },
            },
            {
                url: `${normalized.baseURL}/v1/bots/${encodeURIComponent(botId)}`,
                method: "GET",
            },
        ];

        let lastError = "未知错误";

        for (const candidate of candidates) {
            try {
                const response = await fetch(candidate.url, {
                    method: candidate.method,
                    headers: this.buildHeaders(apiKey),
                    body: candidate.body ? JSON.stringify(candidate.body) : undefined,
                });

                if (!response.ok) {
                    lastError = `HTTP ${response.status}`;
                    continue;
                }

                const payload = (await response.json()) as Record<string, any>;
                const data = this.unwrapResponse<Record<string, any>>(payload);
                return this.mapBotInfo(data, botId);
            } catch (error) {
                lastError = this.errMsg(error);
                this.logger.warn(
                    `Coze bot info request failed: ${candidate.url}, error=${lastError}`,
                );
            }
        }

        throw HttpErrorFactory.badRequest(`获取 Coze 智能体信息失败: ${lastError}`);
    }

    /**
     * 发起 Coze 流式聊天请求。
     */
    async streamChat(params: CozeStreamChatParams): Promise<Response> {
        const normalized = this.normalizeConfig(params.config);
        const apiKey = normalized.apiKey?.trim();
        const botId = this.resolveBotId(normalized);

        if (!apiKey) {
            throw HttpErrorFactory.badRequest("Coze API Key 未配置");
        }
        if (!botId) {
            throw HttpErrorFactory.badRequest("Coze Bot ID 未配置");
        }

        // 构建历史消息列表
        const additionalMessages: Array<{
            role: string;
            type: string;
            content: string;
            content_type: string;
        }> = [];

        // 添加历史消息(如果有)
        if (params.messages && params.messages.length > 0) {
            for (const msg of params.messages) {
                const objects = msg.objects?.filter((item) => item.type !== "text") ?? [];
                additionalMessages.push({
                    role: msg.role === "user" ? "user" : "assistant",
                    type: msg.role === "user" ? "question" : "answer",
                    content:
                        objects.length > 0
                            ? JSON.stringify(
                                  [
                                      ...(msg.content ? [{ type: "text", text: msg.content }] : []),
                                      ...objects,
                                  ],
                                  null,
                                  0,
                              )
                            : msg.content,
                    content_type: objects.length > 0 ? "object_string" : "text",
                });
            }
        }

        // 添加当前用户消息
        const currentObjects = params.objects?.filter((item) => item.type !== "text") ?? [];
        additionalMessages.push({
            role: "user",
            type: "question",
            content:
                currentObjects.length > 0
                    ? JSON.stringify(
                          [
                              ...(params.message ? [{ type: "text", text: params.message }] : []),
                              ...currentObjects,
                          ],
                          null,
                          0,
                      )
                    : params.message,
            content_type: currentObjects.length > 0 ? "object_string" : "text",
        });

        const body = {
            bot_id: botId,
            user_id: params.userId,
            conversation_id:
                normalized.useExternalConversation === false ? undefined : params.conversationId,
            stream: true,
            auto_save_history: normalized.useExternalConversation !== false,
            additional_messages: additionalMessages,
        };

        const candidates = [`${normalized.baseURL}/v3/chat`, `${normalized.baseURL}/v1/chat`];
        let lastError = "未知错误";

        for (const url of candidates) {
            try {
                const response = await fetch(url, {
                    method: "POST",
                    headers: {
                        ...this.buildHeaders(apiKey),
                        Accept: "text/event-stream, application/json",
                    },
                    body: JSON.stringify(body),
                });

                if (!response.ok) {
                    const text = await response.text();
                    lastError = text || `HTTP ${response.status}`;
                    continue;
                }

                return response;
            } catch (error) {
                lastError = this.errMsg(error);
                this.logger.warn(`Coze chat stream request failed: ${url}, error=${lastError}`);
            }
        }

        throw HttpErrorFactory.badRequest(`Coze 对话失败: ${lastError}`);
    }

    /**
     * 解析 Coze SSE 事件块。
     */
    parseStreamEvent(rawBlock: string): {
        event?: string;
        data?: Record<string, any>;
        rawData?: string;
    } {
        const lines = rawBlock
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);

        let eventName: string | undefined;
        const dataLines: string[] = [];

        for (const line of lines) {
            if (line.startsWith("event:")) {
                eventName = line.slice(6).trim();
                continue;
            }
            if (line.startsWith("data:")) {
                dataLines.push(line.slice(5).trim());
            }
        }

        const rawData = dataLines.join("\n");
        if (!rawData) {
            return { event: eventName };
        }

        try {
            const data = JSON.parse(rawData) as Record<string, any>;
            return {
                event: eventName ?? (typeof data.event === "string" ? data.event : undefined),
                data,
                rawData,
            };
        } catch {
            return {
                event: eventName,
                rawData,
            };
        }
    }

    /**
     * 从 Coze 响应中抽取增量文本。
     */
    extractDeltaText(event?: string, data?: Record<string, any>): string {
        if (!data) return "";

        const eventName = (event ?? data.event ?? data.type ?? "").toString().toLowerCase();
        if (
            eventName.includes("message.delta") ||
            eventName.includes("conversation_message_delta") ||
            eventName === "conversation.message.delta"
        ) {
            return this.pickText(data);
        }

        return "";
    }

    /**
     * 从 Coze 响应中抽取完成文本。
     */
    extractCompletedText(event?: string, data?: Record<string, any>): string {
        if (!data) return "";

        const eventName = (event ?? data.event ?? data.type ?? "").toString().toLowerCase();
        if (
            eventName.includes("message.completed") ||
            eventName.includes("conversation_message_completed") ||
            eventName === "conversation.message.completed"
        ) {
            return this.pickText(data);
        }

        return "";
    }

    /**
     * 从 Coze 响应中抽取 conversation/chat 标识。
     */
    extractIdentifiers(data?: Record<string, any>): {
        conversationId?: string;
        chatId?: string;
    } {
        if (!data) return {};

        return {
            conversationId:
                data.conversation_id ??
                data.conversationId ??
                data.chat?.conversation_id ??
                data.chat?.conversationId,
            chatId: data.chat_id ?? data.chatId ?? data.chat?.id,
        };
    }

    /**
     * 从 Coze 响应中抽取 token 用量。
     */
    extractUsage(data?: Record<string, any>): CozeChatUsage | undefined {
        if (!data) return undefined;

        const usage = (data.chat?.usage ?? data.usage) as Record<string, any> | undefined;
        if (!usage) return undefined;

        return {
            inputTokens: usage.input_tokens ?? usage.prompt_tokens ?? usage.promptTokens,
            outputTokens: usage.output_tokens ?? usage.completion_tokens ?? usage.completionTokens,
            totalTokens: usage.token_count ?? usage.total_tokens ?? usage.totalTokens,
        };
    }

    extractToolCallPart(event?: string, data?: Record<string, any>): CozeToolCallPart | undefined {
        if (!data) return undefined;

        const eventName = (event ?? data.event ?? data.type ?? "").toString().toLowerCase();
        const payload = this.pickPrimaryMessagePayload(data);
        const messageType = this.pickString(
            payload?.type,
            payload?.message_type,
            payload?.msg_type,
            data.type,
            data.message_type,
            data.msg_type,
        ).toLowerCase();
        const isToolLike =
            eventName.includes("tool") ||
            eventName.includes("plugin") ||
            messageType.includes("tool") ||
            messageType.includes("plugin") ||
            messageType.includes("function");

        if (!isToolLike) {
            return undefined;
        }

        const toolName =
            this.pickString(
                payload?.plugin_name,
                payload?.pluginName,
                payload?.tool_name,
                payload?.toolName,
                payload?.function_name,
                payload?.functionName,
                payload?.name,
                payload?.plugin?.name,
                payload?.tool?.name,
                data.plugin_name,
                data.pluginName,
                data.tool_name,
                data.toolName,
                data.function_name,
                data.functionName,
                data.name,
            ) || "coze-tool";
        const toolCallId =
            this.pickString(
                payload?.tool_call_id,
                payload?.toolCallId,
                payload?.id,
                payload?.message_id,
                payload?.messageId,
                data.tool_call_id,
                data.toolCallId,
                data.id,
                data.message_id,
                data.messageId,
                data.chat_id,
                data.chatId,
            ) || `${toolName}-${Date.now()}`;
        const input = this.pickStructuredObject(
            payload?.arguments,
            payload?.input,
            payload?.plugin_input,
            payload?.pluginInput,
            payload?.tool_input,
            payload?.toolInput,
            data.arguments,
            data.input,
        );
        const output = this.pickStructuredValue(
            payload?.output,
            payload?.tool_output,
            payload?.toolOutput,
            payload?.plugin_output,
            payload?.pluginOutput,
            payload?.data?.output,
            payload?.content,
            data.output,
            data.tool_output,
            data.toolOutput,
            data.plugin_output,
            data.pluginOutput,
            data.content,
        );
        const errorText = this.pickString(
            payload?.error,
            payload?.error_message,
            payload?.errorMessage,
            payload?.last_error,
            payload?.lastError,
            data.error,
            data.error_message,
            data.errorMessage,
            data.last_error,
            data.lastError,
        );

        return {
            type: "dynamic-tool",
            toolCallId,
            toolName,
            state: errorText
                ? "output-error"
                : output !== undefined
                  ? "output-available"
                  : "input-available",
            input: input ?? {},
            ...(output !== undefined ? { output } : {}),
            ...(errorText ? { errorText } : {}),
        };
    }

    /**
     * 解析 Coze Bot ID。
     */
    resolveBotId(config?: ThirdPartyIntegrationConfig | null): string | undefined {
        const botId =
            (config?.extendedConfig?.botId as string | undefined) ??
            (config?.appId as string | undefined) ??
            undefined;
        return botId?.trim() || undefined;
    }

    /**
     * 规范化 baseURL。
     */
    normalizeBaseUrl(baseURL?: string): string {
        const value = baseURL?.trim();
        if (!value) return this.defaultBaseUrl;

        try {
            const url = new URL(value);
            return url.toString().replace(/\/+$/, "");
        } catch {
            throw HttpErrorFactory.badRequest("Coze Base URL 格式不正确");
        }
    }

    private buildHeaders(apiKey: string): HeadersInit {
        return {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        };
    }

    private unwrapResponse<T>(payload: Record<string, any>): T {
        if (payload.code !== undefined && payload.code !== 0) {
            throw HttpErrorFactory.badRequest(
                payload.msg || payload.message || "Coze API 调用失败",
            );
        }
        return (payload.data ?? payload) as T;
    }

    private mapBotInfo(data: Record<string, any>, fallbackBotId: string): CozeBotInfo {
        const openingQuestions = this.pickStringArray(
            data.suggested_questions ??
                data.opening_questions ??
                data.onboarding_info?.suggested_questions ??
                data.onboarding_info?.opening_questions,
        );

        return {
            id: data.id ?? data.bot_id ?? fallbackBotId,
            name: this.pickString(data.name, data.bot_name, data.botName),
            description: this.pickString(data.description, data.desc, data.introduction),
            iconUrl: this.pickString(data.icon_url, data.iconUrl, data.icon, data.avatar_url),
            openingStatement: this.pickString(
                data.prompt,
                data.opening_statement,
                data.onboarding_info?.prologue,
                data.onboarding_info?.opening_statement,
            ),
            openingQuestions,
            raw: data,
        };
    }

    private pickText(data: Record<string, any>): string {
        return this.pickTextContent(
            data.message?.content,
            data.content,
            data.delta,
            data.data?.content,
            data.message?.text,
        );
    }

    /**
     * 从候选值中选取第一个非空字符串，**不执行 trim**。
     * 专用于提取流式文本 delta / completedText，避免截断 `\n` 等空白字符。
     */
    private pickTextContent(...values: unknown[]): string {
        for (const value of values) {
            if (typeof value === "string" && value.length > 0) {
                return value;
            }
        }
        return "";
    }

    private pickPrimaryMessagePayload(data: Record<string, any>): Record<string, any> | undefined {
        const candidates = [data.message, data.data, data];
        for (const candidate of candidates) {
            if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
                return candidate as Record<string, any>;
            }
        }
        return undefined;
    }

    private pickString(...values: unknown[]): string {
        for (const value of values) {
            if (typeof value === "string" && value.trim()) {
                return value.trim();
            }
        }
        return "";
    }

    private pickStructuredObject(...values: unknown[]): Record<string, any> | undefined {
        for (const value of values) {
            const parsed = this.parseStructuredValue(value);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                return parsed as Record<string, any>;
            }
        }
        return undefined;
    }

    private pickStructuredValue(...values: unknown[]): unknown {
        for (const value of values) {
            const parsed = this.parseStructuredValue(value);
            if (parsed !== undefined && parsed !== null && parsed !== "") {
                return parsed;
            }
        }
        return undefined;
    }

    private parseStructuredValue(value: unknown): unknown {
        if (value === undefined || value === null) return undefined;
        if (typeof value === "object") return value;
        if (typeof value !== "string") return value;

        const trimmed = value.trim();
        if (!trimmed) return undefined;

        if (
            (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
            (trimmed.startsWith("[") && trimmed.endsWith("]"))
        ) {
            try {
                return JSON.parse(trimmed);
            } catch {
                return trimmed;
            }
        }

        return trimmed;
    }

    private pickStringArray(value: unknown): string[] {
        if (!Array.isArray(value)) return [];
        return value
            .map((item) => {
                if (typeof item === "string") return item.trim();
                if (item && typeof item === "object") {
                    const raw =
                        (item as Record<string, any>).content ?? (item as Record<string, any>).text;
                    return typeof raw === "string" ? raw.trim() : "";
                }
                return "";
            })
            .filter(Boolean);
    }

    private errMsg(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }
}
