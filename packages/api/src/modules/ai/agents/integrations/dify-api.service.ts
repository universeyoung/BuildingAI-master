import { HttpErrorFactory } from "@buildingai/errors";
import type { ThirdPartyIntegrationConfig } from "@buildingai/types/ai/agent-config.interface";
import { Injectable, Logger } from "@nestjs/common";

/**
 * Dify 应用基础信息。
 */
export interface DifyAppInfo {
    name?: string;
    description?: string;
    tags?: string[];
    raw: Record<string, any>;
}

/**
 * Dify 应用参数信息（开场白、建议问题等）。
 */
export interface DifyAppParameters {
    openingStatement?: string;
    suggestedQuestions?: string[];
    userInputForm?: Array<Record<string, any>>;
    fileUpload?: Record<string, any>;
    raw: Record<string, any>;
}

/**
 * Dify 对话 token 用量。
 */
export interface DifyChatUsage {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
}

/**
 * Dify 工具调用 Part（与 Coze 对称）。
 */
export interface DifyToolCallPart {
    type: "dynamic-tool";
    toolCallId: string;
    toolName: string;
    state: "input-available" | "output-available" | "output-error";
    input: Record<string, any>;
    output?: unknown;
    errorText?: string;
}

/**
 * Dify 多模态文件对象。
 */
export interface DifyInputFile {
    type: "image" | "document" | "audio" | "video" | "custom";
    transfer_method: "remote_url" | "local_file";
    url?: string;
    upload_file_id?: string;
}

/**
 * Dify 流式对话参数。
 */
export interface DifyStreamChatParams {
    config: ThirdPartyIntegrationConfig;
    userId: string;
    message: string;
    conversationId?: string;
    inputs?: Record<string, any>;
    files?: DifyInputFile[];
}

/**
 * Dify OpenAPI 访问服务。
 *
 * @description
 * Dify 的 API Key 本身绑定到具体应用，因此不需要额外的 appId / botId。
 * 最小可用配置为：baseURL + apiKey。
 */
@Injectable()
export class DifyApiService {
    private readonly logger = new Logger(DifyApiService.name);

    /**
     * Dify 官方 SaaS 默认地址。
     */
    readonly defaultBaseUrl = "https://api.dify.ai/v1";

    /**
     * 规范化第三方配置。
     */
    normalizeConfig(config?: ThirdPartyIntegrationConfig | null): ThirdPartyIntegrationConfig {
        const normalized = {
            ...(config ?? {}),
        } as ThirdPartyIntegrationConfig & { provider?: "coze" | "dify" };
        const extendedConfig = { ...(config?.extendedConfig ?? {}) };

        extendedConfig.provider = "dify";
        normalized.provider = "dify";
        normalized.apiKey = config?.apiKey?.trim();
        normalized.baseURL = this.normalizeBaseUrl(config?.baseURL);
        normalized.extendedConfig = extendedConfig;
        normalized.useExternalConversation = config?.useExternalConversation ?? true;

        return normalized;
    }

    /**
     * 判断当前配置是否满足 Dify 最小可用条件。
     *
     * @description Dify 只需要 apiKey 即可（apiKey 本身绑定应用）。
     */
    hasValidConfig(config?: ThirdPartyIntegrationConfig | null): boolean {
        const normalized = this.normalizeConfig(config);
        return Boolean(normalized.apiKey);
    }

    /**
     * 获取 Dify 应用基础信息。
     *
     * @see https://docs.dify.ai/guides/application-publishing/developing-with-apis
     */
    async getAppInfo(config?: ThirdPartyIntegrationConfig | null): Promise<DifyAppInfo> {
        const normalized = this.normalizeConfig(config);
        const apiKey = normalized.apiKey?.trim();

        if (!apiKey) {
            throw HttpErrorFactory.badRequest("Dify API Key 未配置");
        }

        const url = `${normalized.baseURL}/info`;

        try {
            const response = await fetch(url, {
                method: "GET",
                headers: this.buildHeaders(apiKey),
            });

            if (!response.ok) {
                const text = await response.text();
                throw HttpErrorFactory.badRequest(
                    `获取 Dify 应用信息失败: HTTP ${response.status} ${text}`,
                );
            }

            const data = (await response.json()) as Record<string, any>;
            return this.mapAppInfo(data);
        } catch (error) {
            if (error instanceof Error && error.message.startsWith("获取 Dify")) {
                throw error;
            }
            const msg = this.errMsg(error);
            this.logger.warn(`Dify app info request failed: ${url}, error=${msg}`);
            throw HttpErrorFactory.badRequest(`获取 Dify 应用信息失败: ${msg}`);
        }
    }

    /**
     * 获取 Dify 应用参数（开场白、建议问题等）。
     */
    async getAppParameters(
        config?: ThirdPartyIntegrationConfig | null,
    ): Promise<DifyAppParameters> {
        const normalized = this.normalizeConfig(config);
        const apiKey = normalized.apiKey?.trim();

        if (!apiKey) {
            throw HttpErrorFactory.badRequest("Dify API Key 未配置");
        }

        const url = `${normalized.baseURL}/parameters`;

        try {
            const response = await fetch(url, {
                method: "GET",
                headers: this.buildHeaders(apiKey),
            });

            if (!response.ok) {
                const text = await response.text();
                this.logger.warn(`Dify parameters request failed: HTTP ${response.status} ${text}`);
                return { raw: {} };
            }

            const data = (await response.json()) as Record<string, any>;
            return this.mapAppParameters(data);
        } catch (error) {
            this.logger.warn(`Dify parameters request failed: ${this.errMsg(error)}`);
            return { raw: {} };
        }
    }

    /**
     * 发起 Dify 流式聊天请求。
     */
    async streamChat(params: DifyStreamChatParams): Promise<Response> {
        const normalized = this.normalizeConfig(params.config);
        const apiKey = normalized.apiKey?.trim();

        if (!apiKey) {
            throw HttpErrorFactory.badRequest("Dify API Key 未配置");
        }

        const body: Record<string, any> = {
            inputs: params.inputs ?? {},
            query: params.message,
            response_mode: "streaming",
            user: params.userId,
        };

        if (normalized.useExternalConversation !== false && params.conversationId) {
            body.conversation_id = params.conversationId;
        }
        if (params.files?.length) {
            body.files = params.files;
        }

        const url = `${normalized.baseURL}/chat-messages`;

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
                throw HttpErrorFactory.badRequest(`Dify 对话失败: HTTP ${response.status} ${text}`);
            }

            return response;
        } catch (error) {
            if (error instanceof Error && error.message.startsWith("Dify 对话失败")) {
                throw error;
            }
            const msg = this.errMsg(error);
            this.logger.warn(`Dify chat stream request failed: ${url}, error=${msg}`);
            throw HttpErrorFactory.badRequest(`Dify 对话失败: ${msg}`);
        }
    }

    /**
     * 解析 Dify SSE 事件块。
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
     * 从 Dify 响应中抽取增量文本。
     *
     * @description Dify 的文本增量在 `message` 和 `agent_message` 事件的 `answer` 字段中。
     */
    extractDeltaText(event?: string, data?: Record<string, any>): string {
        if (!data) return "";

        const eventName = (event ?? data.event ?? "").toString().toLowerCase();
        if (eventName === "message" || eventName === "agent_message") {
            return this.pickTextContent(data.answer);
        }

        return "";
    }

    /**
     * 从 Dify `message_end` 事件中抽取完整元数据。
     */
    extractMessageEnd(
        event?: string,
        data?: Record<string, any>,
    ):
        | {
              conversationId?: string;
              messageId?: string;
              usage?: DifyChatUsage;
          }
        | undefined {
        if (!data) return undefined;

        const eventName = (event ?? data.event ?? "").toString().toLowerCase();
        if (eventName !== "message_end") return undefined;

        const usage = data.metadata?.usage as Record<string, any> | undefined;

        return {
            conversationId: data.conversation_id ?? data.conversationId,
            messageId: data.message_id ?? data.messageId ?? data.id,
            usage: usage
                ? {
                      inputTokens: usage.prompt_tokens ?? usage.promptTokens,
                      outputTokens: usage.completion_tokens ?? usage.completionTokens,
                      totalTokens: usage.total_tokens ?? usage.totalTokens,
                  }
                : undefined,
        };
    }

    /**
     * 从 Dify 响应中抽取 conversation/message 标识。
     */
    extractIdentifiers(data?: Record<string, any>): {
        conversationId?: string;
        messageId?: string;
        taskId?: string;
    } {
        if (!data) return {};

        return {
            conversationId: data.conversation_id ?? data.conversationId,
            messageId: data.message_id ?? data.messageId ?? data.id,
            taskId: data.task_id ?? data.taskId,
        };
    }

    /**
     * 从 Dify `agent_thought` 事件中抽取工具调用信息。
     */
    extractAgentThought(
        event?: string,
        data?: Record<string, any>,
    ):
        | {
              id: string;
              thought?: string;
              observation?: string;
              tool?: string;
              toolInput?: Record<string, any>;
              position?: number;
          }
        | undefined {
        if (!data) return undefined;

        const eventName = (event ?? data.event ?? "").toString().toLowerCase();
        if (eventName !== "agent_thought") return undefined;

        let toolInput: Record<string, any> | undefined;
        if (data.tool_input) {
            if (typeof data.tool_input === "string") {
                try {
                    toolInput = JSON.parse(data.tool_input);
                } catch {
                    toolInput = { raw: data.tool_input };
                }
            } else if (typeof data.tool_input === "object") {
                toolInput = data.tool_input as Record<string, any>;
            }
        }

        return {
            id: data.id ?? `thought-${Date.now()}`,
            thought: data.thought,
            observation: data.observation,
            tool: data.tool,
            toolInput,
            position: data.position,
        };
    }

    /**
     * 从 Dify `agent_thought` 事件中抽取标准化的工具调用 Part。
     *
     * @description 与 Coze 的 extractToolCallPart 对称，返回 `DifyToolCallPart` 类型。
     */
    extractToolCallPart(event?: string, data?: Record<string, any>): DifyToolCallPart | undefined {
        const thought = this.extractAgentThought(event, data);
        if (!thought || !thought.tool) {
            return undefined;
        }

        const hasOutput = thought.observation !== undefined && thought.observation !== "";

        return {
            type: "dynamic-tool",
            toolCallId: thought.id,
            toolName: thought.tool,
            state: hasOutput ? "output-available" : "input-available",
            input: thought.toolInput ?? {},
            ...(hasOutput ? { output: thought.observation } : {}),
        };
    }

    /**
     * 从 Dify 响应中检测错误事件。
     */
    extractError(event?: string, data?: Record<string, any>): string | undefined {
        if (!data) return undefined;

        const eventName = (event ?? data.event ?? "").toString().toLowerCase();
        if (eventName === "error") {
            return data.message ?? data.msg ?? "Dify 返回错误";
        }

        return undefined;
    }

    /**
     * 规范化 baseURL。
     *
     * @description Dify 的 baseURL 通常以 `/v1` 结尾，如未包含则自动追加。
     */
    normalizeBaseUrl(baseURL?: string): string {
        const value = baseURL?.trim();
        if (!value) return this.defaultBaseUrl;

        try {
            const url = new URL(value);
            let normalized = url.toString().replace(/\/+$/, "");
            if (!normalized.endsWith("/v1")) {
                normalized += "/v1";
            }
            return normalized;
        } catch {
            throw HttpErrorFactory.badRequest("Dify Base URL 格式不正确");
        }
    }

    private buildHeaders(apiKey: string): HeadersInit {
        return {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        };
    }

    private mapAppInfo(data: Record<string, any>): DifyAppInfo {
        return {
            name: this.pickString(data.name),
            description: this.pickString(data.description),
            tags: Array.isArray(data.tags)
                ? data.tags.filter((t: unknown) => typeof t === "string")
                : undefined,
            raw: data,
        };
    }

    private mapAppParameters(data: Record<string, any>): DifyAppParameters {
        const suggestedQuestions = this.pickStringArray(data.suggested_questions);

        return {
            openingStatement: this.pickString(data.opening_statement),
            suggestedQuestions,
            userInputForm: Array.isArray(data.user_input_form) ? data.user_input_form : undefined,
            fileUpload: data.file_upload as Record<string, any> | undefined,
            raw: data,
        };
    }

    /**
     * 从候选值中选取第一个非空字符串，**不执行 trim**。
     * 专用于提取流式文本 delta，避免截断 `\n` 等空白字符。
     */
    private pickTextContent(...values: unknown[]): string {
        for (const value of values) {
            if (typeof value === "string" && value.length > 0) {
                return value;
            }
        }
        return "";
    }

    private pickString(...values: unknown[]): string {
        for (const value of values) {
            if (typeof value === "string" && value.trim()) {
                return value.trim();
            }
        }
        return "";
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
