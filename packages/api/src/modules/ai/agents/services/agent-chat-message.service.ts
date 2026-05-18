import { BaseService, type PaginationResult } from "@buildingai/base";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import { AgentChatMessage, AgentChatMessageFeedback } from "@buildingai/db/entities";
import { In, Repository } from "@buildingai/db/typeorm";
import { HttpErrorFactory } from "@buildingai/errors";
import type { ChatUIMessage } from "@buildingai/types";
import { Injectable } from "@nestjs/common";
import { validate as isUUID } from "uuid";

import type { ListConversationMessagesDto } from "../dto/web/chat/list-conversation-messages.dto";

export interface CreateAgentMessageDto {
    conversationId: string;
    agentId: string;
    userId?: string;
    anonymousIdentifier?: string;
    message: ChatUIMessage;
    status?: "streaming" | "completed" | "failed";
    formVariables?: Record<string, string>;
    formFieldsInputs?: Record<string, any>;
    parentId?: string;
}

@Injectable()
export class AgentChatMessageService extends BaseService<AgentChatMessage> {
    constructor(
        @InjectRepository(AgentChatMessage)
        private readonly messageRepository: Repository<AgentChatMessage>,
        @InjectRepository(AgentChatMessageFeedback)
        private readonly feedbackRepository: Repository<AgentChatMessageFeedback>,
    ) {
        super(messageRepository);
    }

    async createMessage(dto: CreateAgentMessageDto): Promise<AgentChatMessage> {
        try {
            const message = this.messageRepository.create({
                conversationId: dto.conversationId,
                agentId: dto.agentId,
                userId: dto.userId,
                anonymousIdentifier: dto.anonymousIdentifier,
                message: dto.message,
                status: dto.status ?? "completed",
                formVariables: dto.formVariables,
                formFieldsInputs: dto.formFieldsInputs,
                parentId: dto.parentId && isUUID(dto.parentId) ? dto.parentId : undefined,
            });
            return this.messageRepository.save(message);
        } catch (error) {
            this.logger.error(`创建消息失败: ${error.message}`, error.stack);
            throw HttpErrorFactory.badRequest("Failed to create agent message.");
        }
    }

    async updateMessage(
        id: string,
        updates: Partial<Pick<AgentChatMessage, "message" | "status">>,
    ): Promise<void> {
        await this.messageRepository.update(id, updates as any);
    }

    async getConversationMessages(
        conversationId: string,
        limit?: number,
    ): Promise<AgentChatMessage[]> {
        return this.messageRepository.find({
            where: { conversationId },
            order: { createdAt: "ASC" },
            ...(limit ? { take: limit } : {}),
        });
    }

    async listConversationMessages(
        conversationId: string,
        query: ListConversationMessagesDto,
        userId?: string,
    ): Promise<PaginationResult<AgentChatMessage>> {
        const qb = this.messageRepository
            .createQueryBuilder("m")
            .where("m.conversationId = :conversationId", { conversationId })
            .orderBy("m.createdAt", "DESC");
        const result = await this.paginateQueryBuilder(qb, query);
        if (!result.items.length) return result;

        const messages = result.items as AgentChatMessage[];
        const messageIds = messages.map((m) => m.id);

        const where: Record<string, any> = {
            conversationId,
            messageId: In(messageIds),
        };
        if (userId) {
            where.userId = userId;
        }

        const feedbacks = await this.feedbackRepository.find({
            where,
            order: { createdAt: "DESC" },
        });
        if (!feedbacks.length) return result;

        const feedbackMap = new Map<string, AgentChatMessageFeedback>();
        for (const fb of feedbacks) {
            if (!feedbackMap.has(fb.messageId)) {
                feedbackMap.set(fb.messageId, fb);
            }
        }

        return {
            ...result,
            items: messages.map((msg) => {
                const fb = feedbackMap.get(msg.id);
                if (!fb) return msg;
                const messageWithFeedback: typeof msg.message & {
                    feedback: {
                        id: string;
                        type: "like" | "dislike";
                        dislikeReason?: string;
                        confidenceScore: number;
                        userId?: string;
                        createdAt: Date;
                        updatedAt: Date;
                    };
                } = {
                    ...(msg.message as any),
                    feedback: {
                        id: fb.id,
                        type: fb.type,
                        dislikeReason: fb.dislikeReason ?? undefined,
                        confidenceScore: Number(fb.confidenceScore),
                        userId: fb.userId ?? undefined,
                        createdAt: fb.createdAt,
                        updatedAt: fb.updatedAt,
                    },
                };
                return {
                    ...msg,
                    message: messageWithFeedback,
                };
            }),
        };
    }

    async getMessageStats(conversationId: string): Promise<{
        messageCount: number;
        totalTokens: number;
        totalPower: number;
    }> {
        const messageCount = await this.messageRepository.count({
            where: { conversationId },
        });

        const stats = await this.messageRepository
            .createQueryBuilder("msg")
            .select("COALESCE(SUM((msg.message->'usage'->>'totalTokens')::int), 0)", "totalTokens")
            .addSelect("COALESCE(SUM((msg.message->>'userConsumedPower')::int), 0)", "totalPower")
            .where("msg.conversation_id = :conversationId", { conversationId })
            .getRawOne<{ totalTokens: string; totalPower: string }>();

        return {
            messageCount,
            totalTokens: parseInt(stats?.totalTokens ?? "0") || 0,
            totalPower: parseInt(stats?.totalPower ?? "0") || 0,
        };
    }
}
