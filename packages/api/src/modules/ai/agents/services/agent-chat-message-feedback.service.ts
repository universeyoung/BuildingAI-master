import { BaseService } from "@buildingai/base";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import { AgentChatMessage, AgentChatMessageFeedback } from "@buildingai/db/entities";
import { Repository } from "@buildingai/db/typeorm";
import { Injectable } from "@nestjs/common";

import { AgentChatRecordService } from "./agent-chat-record.service";

@Injectable()
export class AgentChatMessageFeedbackService extends BaseService<AgentChatMessageFeedback> {
    constructor(
        @InjectRepository(AgentChatMessageFeedback)
        private readonly feedbackRepository: Repository<AgentChatMessageFeedback>,
        @InjectRepository(AgentChatMessage)
        private readonly messageRepository: Repository<AgentChatMessage>,
        private readonly agentChatRecordService: AgentChatRecordService,
    ) {
        super(feedbackRepository);
    }

    private async calculateConfidenceScore(
        userId: string,
        messageId: string,
        type: "like" | "dislike",
        existingFeedback?: AgentChatMessageFeedback,
    ): Promise<number> {
        let score = 0.5;

        if (existingFeedback && existingFeedback.type === type) {
            score -= 0.3;
        }

        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const recentFeedbacks = await this.feedbackRepository
            .createQueryBuilder("feedback")
            .where("feedback.userId = :userId", { userId })
            .andWhere("feedback.type = :type", { type: "dislike" })
            .andWhere("feedback.id != :currentId", {
                currentId: existingFeedback?.id || "00000000-0000-0000-0000-000000000000",
            })
            .andWhere("feedback.createdAt > :oneHourAgo", { oneHourAgo })
            .orderBy("feedback.createdAt", "DESC")
            .limit(5)
            .getMany();

        if (type === "dislike" && recentFeedbacks.length >= 3) {
            score += 0.2;
        }

        if (existingFeedback) {
            const timeDiff = Date.now() - existingFeedback.updatedAt.getTime();
            if (timeDiff < 60000) {
                score -= 0.2;
            }
        }

        return Math.max(0, Math.min(1, score));
    }

    async addFeedback(params: {
        messageId: string;
        conversationId: string;
        userId: string;
        type: "like" | "dislike";
        dislikeReason?: string;
    }): Promise<AgentChatMessageFeedback> {
        const { messageId, conversationId, userId, type, dislikeReason } = params;

        const existing = await this.feedbackRepository.findOne({
            where: { messageId, userId },
        });

        const message = await this.messageRepository.findOne({
            where: { id: messageId, conversationId },
            select: ["conversationId"],
        });

        if (!message) {
            throw new Error("Message not found");
        }

        const confidenceScore = await this.calculateConfidenceScore(
            userId,
            messageId,
            type,
            existing || undefined,
        );

        if (existing) {
            if (existing.type === type && !dislikeReason && !existing.dislikeReason) {
                await this.feedbackRepository.remove(existing);
                await this.agentChatRecordService.updateFeedbackStatus(conversationId, type, -1);
                return existing;
            }

            const prevType = existing.type;
            const updated = await this.feedbackRepository.save({
                ...existing,
                type,
                dislikeReason: type === "dislike" ? (dislikeReason ?? null) : null,
                confidenceScore,
                conversationId: message.conversationId,
            });

            if (prevType !== type) {
                await this.agentChatRecordService.updateFeedbackStatus(
                    conversationId,
                    prevType,
                    -1,
                );
                await this.agentChatRecordService.updateFeedbackStatus(conversationId, type, 1);
            }

            return updated;
        }

        const created = await this.feedbackRepository.save(
            this.feedbackRepository.create({
                messageId,
                conversationId: message.conversationId,
                userId,
                type,
                dislikeReason: type === "dislike" ? (dislikeReason ?? null) : null,
                confidenceScore,
            }),
        );

        await this.agentChatRecordService.updateFeedbackStatus(conversationId, type, 1);

        return created;
    }

    async getFeedbacksByMessage(messageId: string): Promise<AgentChatMessageFeedback[]> {
        return this.feedbackRepository.find({
            where: { messageId },
            order: { createdAt: "ASC" },
        });
    }
}
