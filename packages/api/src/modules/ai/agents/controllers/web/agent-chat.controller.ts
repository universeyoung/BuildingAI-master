import type { PaginationResult } from "@buildingai/base";
import { type UserPlayground } from "@buildingai/db";
import type { AgentChatMessage } from "@buildingai/db/entities";
import { BuildFileUrl } from "@buildingai/decorators";
import { Playground } from "@buildingai/decorators/playground.decorator";
import { HttpErrorFactory } from "@buildingai/errors";
import { AgentPublicAccess } from "@common/decorators/agent-public-access.decorator";
import { WebController } from "@common/decorators/controller.decorator";
import {
    Body,
    Delete,
    Get,
    Param,
    Post,
    Query,
    Req,
    Res,
    UploadedFile,
    UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Request, Response } from "express";
import { validate as isUUID } from "uuid";

import { AgentChatRequestDto } from "../../dto/web/chat/agent-chat-request.dto";
import { CreateAgentMessageFeedbackDto } from "../../dto/web/chat/agent-message-feedback.dto";
import { AgentSpeechRequestDto } from "../../dto/web/chat/agent-speech-request.dto";
import { ListAgentConversationsDto } from "../../dto/web/chat/list-agent-conversations.dto";
import { ListConversationMessagesDto } from "../../dto/web/chat/list-conversation-messages.dto";
import { AgentChatCompletionService } from "../../services/agent-chat-completion.service";
import { AgentChatMessageService } from "../../services/agent-chat-message.service";
import { AgentChatMessageFeedbackService } from "../../services/agent-chat-message-feedback.service";
import type { AgentChatRecordWithUser } from "../../services/agent-chat-record.service";
import { AgentChatRecordService } from "../../services/agent-chat-record.service";
import { AgentVoiceService } from "../../services/agent-voice.service";

@WebController("ai-agents")
export class AgentChatWebController {
    constructor(
        private readonly agentChatCompletionService: AgentChatCompletionService,
        private readonly agentVoiceService: AgentVoiceService,
        private readonly agentChatRecordService: AgentChatRecordService,
        private readonly agentChatMessageService: AgentChatMessageService,
        private readonly agentChatMessageFeedbackService: AgentChatMessageFeedbackService,
    ) {}

    @AgentPublicAccess({ route: "chat-messages", targetPath: ":id/chat/stream" })
    @Post(":id/chat/stream")
    async streamChat(
        @Param("id") agentId: string,
        @Body() dto: AgentChatRequestDto,
        @Playground() playground: UserPlayground,
        @Res() res: Response,
        @Req() req: Request,
    ) {
        const anonymousIdentifier = this.extractAnonymousIdentifier(req);

        if (anonymousIdentifier && dto.conversationId && isUUID(dto.conversationId)) {
            const record = await this.agentChatRecordService.getConversation(dto.conversationId);
            if (!record) throw HttpErrorFactory.notFound("对话不存在");
            if (record.agentId !== agentId) throw HttpErrorFactory.notFound("对话不存在");
            if (record.anonymousIdentifier !== anonymousIdentifier) {
                throw HttpErrorFactory.forbidden("无权访问该对话");
            }
            if (record.userId !== playground.id) throw HttpErrorFactory.forbidden("无权访问该对话");
        }

        if (dto.responseMode === "blocking") {
            return this.handleBlockingChat(dto, agentId, playground.id, anonymousIdentifier, res);
        }

        const abortController = new AbortController();
        const abortSignal =
            (req as any).signal instanceof AbortSignal
                ? (req as any).signal
                : abortController.signal;

        if (!((req as any).signal instanceof AbortSignal)) {
            const handleDisconnect = () => {
                if (!res.writableEnded && !abortSignal.aborted) abortController.abort();
            };
            req.on("close", handleDisconnect);
            req.on("aborted", handleDisconnect);
            res.on("close", handleDisconnect);
            if (req.aborted || req.socket?.destroyed) abortController.abort();
        }

        const isRegenerate = dto.trigger === "regenerate-message" && !!dto.messageId;

        const isToolApprovalFlow =
            dto.message &&
            !dto.messages &&
            dto.message.role === "assistant" &&
            dto.message.parts?.some((part: any) => {
                const state = part?.state as string | undefined;
                return state === "approval-responded" || state === "output-denied";
            });

        await this.agentChatCompletionService.streamChat(
            {
                agentId,
                userId: playground.id,
                anonymousIdentifier,
                conversationId: dto.conversationId,
                saveConversation: dto.saveConversation ?? true,
                isDebug: dto.isDebug === true,
                messages: dto.messages ?? (dto.message ? [dto.message] : []),
                formVariables: dto.formVariables,
                formFieldsInputs: dto.formFieldsInputs,
                abortSignal,
                feature: dto.feature,
                isRegenerate,
                regenerateMessageId: dto.messageId,
                parentId: isRegenerate ? undefined : dto.parentId,
                regenerateParentId: isRegenerate ? dto.parentId : undefined,
                isToolApprovalFlow: !!isToolApprovalFlow,
            },
            res,
        );
    }

    private async handleBlockingChat(
        dto: AgentChatRequestDto,
        agentId: string,
        userId: string,
        anonymousIdentifier: string | undefined,
        res: Response,
    ): Promise<void> {
        let fullText = "";
        let conversationId: string | undefined;
        let messageId: string | undefined;
        let mockWritableEnded = false;

        const mockRes = {
            get writableEnded() {
                return mockWritableEnded;
            },
            setHeader: () => mockRes,
            write: (chunk: Buffer | string) => {
                const str = typeof chunk === "string" ? chunk : chunk.toString();
                const lines = str.split("\n");
                for (const line of lines) {
                    if (!line.startsWith("data: ")) continue;
                    try {
                        const data = JSON.parse(line.slice(6));
                        if (data.type === "text-delta" && data.delta) {
                            fullText += data.delta;
                        }
                        if (data.type === "data-conversation-id") {
                            conversationId = data.data;
                        }
                        if (data.type === "data-assistant-message-id") {
                            messageId = data.data;
                        }
                    } catch {
                        continue;
                    }
                }
                return true;
            },
            end: () => {
                mockWritableEnded = true;
            },
            on: () => mockRes,
            once: () => mockRes,
            emit: () => true,
            flushHeaders: () => {},
        } as unknown as Response;

        const isRegenerate = dto.trigger === "regenerate-message" && !!dto.messageId;
        const isToolApprovalFlow =
            dto.message &&
            !dto.messages &&
            dto.message.role === "assistant" &&
            dto.message.parts?.some((part: any) => {
                const state = part?.state as string | undefined;
                return state === "approval-responded" || state === "output-denied";
            });

        await this.agentChatCompletionService.streamChat(
            {
                agentId,
                userId,
                anonymousIdentifier,
                conversationId: dto.conversationId,
                saveConversation: dto.saveConversation ?? true,
                isDebug: dto.isDebug === true,
                messages: dto.messages ?? (dto.message ? [dto.message] : []),
                formVariables: dto.formVariables,
                formFieldsInputs: dto.formFieldsInputs,
                feature: dto.feature,
                isRegenerate,
                regenerateMessageId: dto.messageId,
                parentId: isRegenerate ? undefined : dto.parentId,
                regenerateParentId: isRegenerate ? dto.parentId : undefined,
                isToolApprovalFlow: !!isToolApprovalFlow,
            },
            mockRes,
        );

        res.json({
            event: "message",
            conversationId,
            messageId,
            answer: fullText,
            createdAt: Math.floor(Date.now() / 1000),
        });
    }

    @AgentPublicAccess({ route: "audio-to-text", targetPath: ":id/voice/transcribe" })
    @Post(":id/voice/transcribe")
    @UseInterceptors(FileInterceptor("file"))
    async transcribe(
        @Param("id") agentId: string,
        @UploadedFile() file: Express.Multer.File,
        @Playground() _playground: UserPlayground,
    ) {
        if (!file?.buffer) throw HttpErrorFactory.badRequest("请上传音频文件");
        return this.agentVoiceService.transcribe(agentId, file.buffer);
    }

    @AgentPublicAccess({ route: "text-to-audio", targetPath: ":id/voice/speech" })
    @Post(":id/voice/speech")
    async speech(
        @Param("id") agentId: string,
        @Body() dto: AgentSpeechRequestDto,
        @Playground() _playground: UserPlayground,
        @Res() res: Response,
    ) {
        const { audio, format } = await this.agentVoiceService.speech(agentId, dto.text, {
            modelId: dto.modelId,
            voice: dto.voice,
            speed: dto.speed,
            responseFormat:
                (dto.responseFormat as "mp3" | "opus" | "aac" | "flac" | "wav" | "pcm") ?? "mp3",
        });
        const mime =
            format === "mp3" ? "audio/mpeg" : format === "wav" ? "audio/wav" : "audio/mpeg";
        res.setHeader("Content-Type", mime);
        res.send(Buffer.from(audio));
    }

    @Post(":id/chat/conversations/:conversationId/messages/:messageId/feedback")
    @AgentPublicAccess({
        route: "messages/:conversationId/:messageId/feedback",
        targetPath: ":id/chat/conversations/:conversationId/messages/:messageId/feedback",
    })
    async addMessageFeedback(
        @Param("id") agentId: string,
        @Param("conversationId") conversationId: string,
        @Param("messageId") messageId: string,
        @Body() dto: CreateAgentMessageFeedbackDto,
        @Playground() playground: UserPlayground,
        @Req() req: Request,
    ) {
        const anonymousIdentifier = this.extractAnonymousIdentifier(req);
        const record = await this.agentChatRecordService.getConversation(conversationId);
        if (!record) throw HttpErrorFactory.notFound("对话不存在");
        if (record.agentId !== agentId) throw HttpErrorFactory.notFound("对话不存在");
        if (anonymousIdentifier && record.anonymousIdentifier !== anonymousIdentifier) {
            throw HttpErrorFactory.forbidden("无权访问该对话");
        }
        if (record.userId !== playground.id) throw HttpErrorFactory.forbidden("无权访问该对话");
        const msg = await this.agentChatMessageService.findOne({
            where: { id: messageId, conversationId },
        });
        if (!msg) throw HttpErrorFactory.notFound("消息不存在");
        return this.agentChatMessageFeedbackService.addFeedback({
            messageId,
            conversationId,
            userId: playground.id,
            type: dto.type,
            dislikeReason: dto.dislikeReason,
        });
    }

    @Delete(":id/chat/conversations/:conversationId/messages/:messageId/feedback")
    @AgentPublicAccess({
        route: "messages/:conversationId/:messageId/feedback",
        targetPath: ":id/chat/conversations/:conversationId/messages/:messageId/feedback",
        method: "DELETE",
    })
    async removeMessageLikeDislike(
        @Param("id") agentId: string,
        @Param("conversationId") conversationId: string,
        @Param("messageId") messageId: string,
        @Query("type") type: "like" | "dislike",
        @Playground() playground: UserPlayground,
        @Req() req: Request,
    ) {
        const anonymousIdentifier = this.extractAnonymousIdentifier(req);
        const record = await this.agentChatRecordService.getConversation(conversationId);
        if (!record) throw HttpErrorFactory.notFound("对话不存在");
        if (record.agentId !== agentId) throw HttpErrorFactory.notFound("对话不存在");
        if (anonymousIdentifier && record.anonymousIdentifier !== anonymousIdentifier) {
            throw HttpErrorFactory.forbidden("无权访问该对话");
        }
        if (record.userId !== playground.id) throw HttpErrorFactory.forbidden("无权访问该对话");
        const msg = await this.agentChatMessageService.findOne({
            where: { id: messageId, conversationId },
        });
        if (!msg) throw HttpErrorFactory.notFound("消息不存在");
        if (type !== "like" && type !== "dislike") {
            throw HttpErrorFactory.badRequest("type 必须为 like 或 dislike");
        }
        await this.agentChatMessageFeedbackService.addFeedback({
            messageId,
            conversationId,
            userId: playground.id,
            type,
        });
    }

    @Get(":id/chat/conversations/:conversationId/messages/:messageId/feedbacks")
    async listMessageFeedbacks(
        @Param("id") _agentId: string,
        @Param("conversationId") conversationId: string,
        @Param("messageId") messageId: string,
    ) {
        const record = await this.agentChatRecordService.getConversation(conversationId);
        if (!record) throw HttpErrorFactory.notFound("对话不存在");
        const msg = await this.agentChatMessageService.findOne({
            where: { id: messageId, conversationId },
        });
        if (!msg) throw HttpErrorFactory.notFound("消息不存在");
        return this.agentChatMessageFeedbackService.getFeedbacksByMessage(messageId);
    }

    @Get(":id/chat/conversations")
    @AgentPublicAccess({
        route: "conversations",
        targetPath: ":id/chat/conversations",
        method: "GET",
    })
    @BuildFileUrl(["**.userAvatar"])
    async listConversations(
        @Param("id") agentId: string,
        @Query() query: ListAgentConversationsDto,
        @Playground() playground: UserPlayground,
        @Req() req: Request,
    ): Promise<PaginationResult<AgentChatRecordWithUser>> {
        const anonymousIdentifier = this.extractAnonymousIdentifier(req);
        return this.agentChatRecordService.listUserConversations(
            agentId,
            playground.id,
            query,
            anonymousIdentifier,
        );
    }

    @Get(":id/chat/conversations/:conversationId/messages")
    @AgentPublicAccess({
        route: "messages/:conversationId",
        targetPath: ":id/chat/conversations/:conversationId/messages",
        method: "GET",
    })
    async listConversationMessages(
        @Param("id") agentId: string,
        @Param("conversationId") conversationId: string,
        @Query() query: ListConversationMessagesDto,
        @Playground() playground: UserPlayground,
        @Req() req: Request,
    ): Promise<PaginationResult<AgentChatMessage>> {
        const anonymousIdentifier = this.extractAnonymousIdentifier(req);
        const record = await this.agentChatRecordService.getConversation(conversationId);
        if (!record) throw HttpErrorFactory.notFound("对话不存在");
        if (record.agentId !== agentId) throw HttpErrorFactory.notFound("对话不存在");
        if (record.userId !== playground.id) throw HttpErrorFactory.forbidden("无权查看该对话");
        if (anonymousIdentifier && record.anonymousIdentifier !== anonymousIdentifier) {
            throw HttpErrorFactory.forbidden("无权查看该对话");
        }
        return this.agentChatMessageService.listConversationMessages(
            conversationId,
            query,
            playground.id,
        );
    }

    private extractAnonymousIdentifier(req: Request): string | undefined {
        const v = req.headers["x-anonymous-identifier"];
        if (typeof v !== "string") return undefined;
        const trimmed = v.trim();
        return trimmed || undefined;
    }
}
