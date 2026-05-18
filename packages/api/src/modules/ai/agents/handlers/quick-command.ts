import type { QuickCommandConfig } from "@buildingai/types/ai/agent-config.interface";
import { Injectable } from "@nestjs/common";
import type { UIMessage } from "ai";

export type QuickCommandStreamWriter = { write: (p: unknown) => void };

export type ReplySource = "annotation" | "quick-command";

export type QuickCommandEmitContext = {
    writer: QuickCommandStreamWriter;
    assistantMessageId: string;
    messages: UIMessage[];
    customReply: string;
    replySource?: ReplySource;
    conversationId: string | undefined;
    saveConversation: boolean;
    params: unknown;
    saveMessages: (ctx: QuickCommandSaveContext) => Promise<void>;
    serializeContextForDisplay: (
        messages: Array<{ role: string; content: unknown }>,
    ) => Array<{ role: string; content: string }>;
};

export type QuickCommandSaveContext = {
    finished: UIMessage[];
    responseMsg: UIMessage;
    params: unknown;
    conversationId: string;
    usage: undefined;
    aborted: false;
    writer: QuickCommandStreamWriter;
};

const ZERO_USAGE = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    inputTokenDetails: { noCacheTokens: 0, cacheReadTokens: 0 },
    outputTokenDetails: { textTokens: 0, reasoningTokens: 0 },
    reasoningTokens: 0,
    cachedInputTokens: 0,
    raw: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
};

@Injectable()
export class QuickCommandHandler {
    getCustomReply(
        lastUserText: string,
        quickCommands: QuickCommandConfig[] | undefined,
    ): string | null {
        if (!quickCommands?.length || !lastUserText.trim()) return null;
        const normalized = lastUserText.trim();
        const cmd = quickCommands.find(
            (c) => typeof c.content === "string" && c.content.trim() === normalized,
        );
        if (!cmd || cmd.replyType !== "custom" || !cmd.replyContent?.trim()) return null;
        return this.extractPlainTextFromReplyContent(cmd.replyContent) || null;
    }

    async emitCustomReplyStream(ctx: QuickCommandEmitContext): Promise<void> {
        const {
            writer,
            assistantMessageId,
            messages,
            customReply,
            replySource,
            conversationId,
            saveConversation,
            params,
            saveMessages,
            serializeContextForDisplay,
        } = ctx;
        const w = writer;
        if (replySource) {
            w.write({ type: "data-reply-source", data: replySource });
        }
        w.write({ type: "start-step" });
        const textId = "txt-0";
        w.write({ type: "text-start", id: textId });
        w.write({ type: "text-delta", id: textId, delta: customReply });
        w.write({ type: "text-end", id: textId });
        w.write({ type: "finish-step" });
        w.write({ type: "finish", finishReason: "stop" });
        w.write({ type: "data-usage", data: ZERO_USAGE });
        const responseMsg: UIMessage = {
            id: assistantMessageId,
            role: "assistant",
            parts: [
                { type: "text", text: customReply },
                ...(replySource ? [{ type: "data-reply-source" as const, data: replySource }] : []),
            ],
        };
        const finished = [...messages, responseMsg];
        const contextMessages = finished.map((m) => ({ role: m.role, content: m.parts }));
        w.write({
            type: "data-conversation-context",
            data: {
                messageId: assistantMessageId,
                messages: serializeContextForDisplay(contextMessages),
            },
        });
        if (conversationId && saveConversation) {
            await saveMessages({
                finished,
                responseMsg,
                params,
                conversationId,
                usage: undefined,
                aborted: false,
                writer,
            });
        }
    }

    extractPlainTextFromReplyContent(replyContent: string | undefined): string {
        if (!replyContent?.trim()) return "";
        const trimmed = replyContent.trim();
        try {
            const parsed = JSON.parse(trimmed);
            if (!Array.isArray(parsed)) return trimmed;
            const collect = (nodes: unknown[]): string =>
                nodes
                    .map((node) => {
                        if (node && typeof node === "object" && "children" in node) {
                            const children = (node as { children?: unknown[] }).children;
                            return Array.isArray(children)
                                ? children
                                      .map((c) =>
                                          c && typeof c === "object" && "text" in c
                                              ? String((c as { text?: string }).text ?? "")
                                              : "",
                                      )
                                      .join("")
                                : "";
                        }
                        return "";
                    })
                    .join("\n");
            return collect(parsed) || trimmed;
        } catch {
            return trimmed;
        }
    }
}
