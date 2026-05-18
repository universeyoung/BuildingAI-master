import { getProviderForEmbedding } from "@buildingai/ai-sdk";
import { cosineSimilarity } from "@buildingai/ai-toolkit/utils";
import { PaginationResult } from "@buildingai/base";
import { BaseService } from "@buildingai/base";
import { SecretService } from "@buildingai/core/modules";
import type { UserPlayground } from "@buildingai/db";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import { AgentAnnotation, AgentChatMessage } from "@buildingai/db/entities";
import { Repository } from "@buildingai/db/typeorm";
import { HttpErrorFactory } from "@buildingai/errors";
import type { AnnotationConfig } from "@buildingai/types/ai/agent-config.interface";
import { getProviderSecret } from "@buildingai/utils";
import { AiModelService } from "@modules/ai/model/services/ai-model.service";
import { Injectable, Logger } from "@nestjs/common";
import { embed } from "ai";

import type { CreateAgentAnnotationDto } from "../dto/web/annotation/create-agent-annotation.dto";
import type { ListAgentAnnotationsDto } from "../dto/web/annotation/list-agent-annotations.dto";
import type { UpdateAgentAnnotationDto } from "../dto/web/annotation/update-agent-annotation.dto";
import { AgentsService } from "./agents.service";

@Injectable()
export class AgentAnnotationService extends BaseService<AgentAnnotation> {
    protected readonly logger = new Logger(AgentAnnotationService.name);

    constructor(
        @InjectRepository(AgentAnnotation)
        private readonly annotationRepository: Repository<AgentAnnotation>,
        @InjectRepository(AgentChatMessage)
        private readonly chatMessageRepository: Repository<AgentChatMessage>,
        private readonly agentsService: AgentsService,
        private readonly aiModelService: AiModelService,
        private readonly secretService: SecretService,
    ) {
        super(annotationRepository);
    }

    private async embedQuestion(
        text: string,
        vectorModelId: string | undefined,
    ): Promise<{ embedding: number[]; modelId: string } | null> {
        const input = (text || " ").replaceAll("\n", " ").trim() || " ";
        if (!vectorModelId?.trim()) return null;
        const model = await this.aiModelService.findOne({
            where: { id: vectorModelId, isActive: true },
            relations: ["provider"],
        });
        if (!model?.provider?.isActive) return null;
        try {
            const providerSecret = await this.secretService.getConfigKeyValuePairs(
                model.provider.bindSecretId!,
            );
            const provider = getProviderForEmbedding(model.provider.provider, {
                apiKey: getProviderSecret("apiKey", providerSecret),
                baseURL: getProviderSecret("baseUrl", providerSecret) || undefined,
            });
            const embeddingModel = provider(model.model);
            const result = await embed({ model: embeddingModel.model, value: input });
            const emb = result.embedding;
            if (!Array.isArray(emb) || emb.length === 0) return null;
            return { embedding: emb, modelId: model.model };
        } catch (err) {
            this.logger.warn(
                `标注问题向量化失败: ${err instanceof Error ? err.message : String(err)}`,
            );
            return null;
        }
    }

    private applyEmbedding(
        annotation: AgentAnnotation,
        result: { embedding: number[]; modelId: string } | null,
    ): void {
        if (result) {
            annotation.embedding = result.embedding;
            annotation.embeddingModelId = result.modelId;
        } else {
            annotation.embedding = null;
            annotation.embeddingModelId = null;
        }
    }

    async searchByQuery(
        agentId: string,
        query: string,
        config: Pick<AnnotationConfig, "vectorModelId" | "threshold"> | undefined,
    ): Promise<AgentAnnotation | null> {
        const vectorModelId = config?.vectorModelId?.trim();
        if (!vectorModelId || !(query || "").trim()) return null;
        const embedResult = await this.embedQuestion(
            (query || " ").replaceAll("\n", " ").trim(),
            vectorModelId,
        );
        if (!embedResult?.embedding?.length) return null;
        const threshold = Math.min(1, Math.max(0.85, config?.threshold ?? 0.9));
        const list = await this.annotationRepository.find({
            where: {
                agentId,
                enabled: true,
                embeddingModelId: embedResult.modelId,
            },
            select: ["id", "question", "answer", "embedding"],
        });
        let best: { annotation: AgentAnnotation; score: number } | null = null;
        for (const ann of list) {
            if (!Array.isArray(ann.embedding) || ann.embedding.length === 0) continue;
            const score = cosineSimilarity(embedResult.embedding, ann.embedding);
            if (score >= threshold && (!best || score > best.score)) {
                best = { annotation: ann, score };
            }
        }
        return best?.annotation ?? null;
    }

    async incrementHitCount(agentId: string, annotationId: string): Promise<void> {
        await this.annotationRepository.increment({ id: annotationId, agentId }, "hitCount", 1);
    }

    async createAnnotation(
        agentId: string,
        dto: CreateAgentAnnotationDto,
        user: UserPlayground,
    ): Promise<AgentAnnotation> {
        await this.ensureAgentOwnership(user, agentId);
        const question = dto.question.trim();
        const answer = dto.answer.trim();
        const existing = await this.annotationRepository.findOne({
            where: {
                agentId,
                question,
                enabled: true,
            },
        });
        if (existing) throw HttpErrorFactory.badRequest("该问题已存在标注");

        const agent = await this.agentsService.findOne({ where: { id: agentId } });
        const vectorModelId = agent?.annotationConfig?.vectorModelId;
        const annotation = this.annotationRepository.create({
            agentId,
            question,
            answer,
            enabled: dto.enabled ?? true,
            createdBy: user.id,
        });
        const embeddingResult = await this.embedQuestion(question, vectorModelId);
        this.applyEmbedding(annotation, embeddingResult);
        const saved = await this.annotationRepository.save(annotation);
        if (dto.messageId) await this.updateMessageAnnotation(dto.messageId, saved.id);
        return saved;
    }

    async list(
        agentId: string,
        query: ListAgentAnnotationsDto,
        user: UserPlayground,
    ): Promise<PaginationResult<AgentAnnotation>> {
        await this.agentsService.getAgentDetail(user, agentId);
        const qb = this.annotationRepository
            .createQueryBuilder("a")
            .leftJoinAndSelect("a.user", "user")
            .where("a.agentId = :agentId", { agentId });
        if (query.keyword) {
            qb.andWhere("(a.question ILIKE :keyword OR a.answer ILIKE :keyword)", {
                keyword: `%${query.keyword}%`,
            });
        }
        if (query.enabled !== undefined) {
            qb.andWhere("a.enabled = :enabled", { enabled: query.enabled });
        }
        qb.orderBy("a.createdAt", "DESC");
        return this.paginateQueryBuilder(qb, query);
    }

    async getOne(
        agentId: string,
        annotationId: string,
        user: UserPlayground,
    ): Promise<AgentAnnotation> {
        await this.agentsService.getAgentDetail(user, agentId);
        const annotation = await this.annotationRepository.findOne({
            where: { id: annotationId, agentId },
            relations: ["user"],
        });
        if (!annotation) throw HttpErrorFactory.notFound("标注不存在");
        return annotation;
    }

    async updateAnnotation(
        agentId: string,
        annotationId: string,
        dto: UpdateAgentAnnotationDto,
        user: UserPlayground,
    ): Promise<AgentAnnotation> {
        await this.ensureAgentOwnership(user, agentId);
        const annotation = await this.annotationRepository.findOne({
            where: { id: annotationId, agentId },
        });
        if (!annotation) throw HttpErrorFactory.notFound("标注不存在");
        if (dto.question !== undefined) annotation.question = dto.question.trim();
        if (dto.answer !== undefined) annotation.answer = dto.answer.trim();
        if (dto.enabled !== undefined) annotation.enabled = dto.enabled;
        if (dto.question !== undefined) {
            const agent = await this.agentsService.findOne({ where: { id: agentId } });
            const vectorModelId = agent?.annotationConfig?.vectorModelId;
            const embeddingResult = await this.embedQuestion(annotation.question, vectorModelId);
            this.applyEmbedding(annotation, embeddingResult);
        }
        const saved = await this.annotationRepository.save(annotation);
        if (dto.messageId) await this.updateMessageAnnotation(dto.messageId, saved.id);
        return saved;
    }

    async deleteAnnotation(
        agentId: string,
        annotationId: string,
        user: UserPlayground,
    ): Promise<void> {
        await this.ensureAgentOwnership(user, agentId);
        const annotation = await this.annotationRepository.findOne({
            where: { id: annotationId, agentId },
        });
        if (!annotation) throw HttpErrorFactory.notFound("标注不存在");
        await this.removeAnnotationFromMessages(annotationId);
        await this.annotationRepository.delete(annotationId);
    }

    async deleteAll(agentId: string, user: UserPlayground): Promise<{ deleted: number }> {
        await this.ensureAgentOwnership(user, agentId);
        const list = await this.annotationRepository.find({
            where: { agentId },
            select: { id: true },
        });
        for (const a of list) {
            await this.removeAnnotationFromMessages(a.id);
        }
        const result = await this.annotationRepository.delete({ agentId });
        return { deleted: result.affected ?? 0 };
    }

    async importFromCsv(
        agentId: string,
        buffer: Buffer,
        user: UserPlayground,
    ): Promise<{ imported: number }> {
        await this.ensureAgentOwnership(user, agentId);
        const agent = await this.agentsService.findOne({ where: { id: agentId } });
        const vectorModelId = agent?.annotationConfig?.vectorModelId;
        const raw = buffer.toString("utf-8").replace(/^\uFEFF/, "");
        const text = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
        const lines = text.split("\n").filter((l) => l.trim());
        this.logger.log(
            `[importFromCsv] bufferLength=${buffer.length} linesCount=${lines.length} firstLinePreview=${JSON.stringify(lines[0]?.slice(0, 80))}`,
        );
        if (lines.length < 2) throw HttpErrorFactory.badRequest("CSV 至少需要表头一行和数据一行");
        const sep = this.detectCsvSeparator(lines[0]);
        const header = this.parseCsvLine(lines[0], sep);
        const qIdx = header.findIndex((c) => (c || "").trim() === "问题");
        const aIdx = header.findIndex((c) => (c || "").trim() === "回答");
        this.logger.log(
            `[importFromCsv] sep=${JSON.stringify(sep)} header=${JSON.stringify(header)} qIdx=${qIdx} aIdx=${aIdx}`,
        );
        if (qIdx < 0 || aIdx < 0)
            throw HttpErrorFactory.badRequest("CSV 需包含「问题」和「回答」列");
        let imported = 0;
        for (let i = 1; i < lines.length; i++) {
            const row = this.parseCsvLine(lines[i], sep);
            const question = (row[qIdx] ?? "").trim();
            const answer = (row[aIdx] ?? "").trim();
            const isEmpty = !question || !answer;
            if (isEmpty) {
                this.logger.log(
                    `[importFromCsv] row ${i} skip empty: row=${JSON.stringify(row)} question=${JSON.stringify(question)} answer=${JSON.stringify(answer)}`,
                );
                continue;
            }
            const existing = await this.annotationRepository.findOne({
                where: { agentId, question, enabled: true },
            });
            if (existing) {
                this.logger.log(
                    `[importFromCsv] row ${i} skip existing: question=${JSON.stringify(question)}`,
                );
                continue;
            }
            const annotation = this.annotationRepository.create({
                agentId,
                question,
                answer,
                enabled: true,
                createdBy: user.id,
            });
            const embeddingResult = await this.embedQuestion(question, vectorModelId);
            this.applyEmbedding(annotation, embeddingResult);
            await this.annotationRepository.save(annotation);
            imported += 1;
        }
        this.logger.log(`[importFromCsv] done imported=${imported}`);
        return { imported };
    }

    private detectCsvSeparator(firstLine: string): "," | ";" {
        const withComma = this.parseCsvLine(firstLine, ",");
        if (withComma.length >= 2) return ",";
        if (firstLine.includes(";")) return ";";
        return ",";
    }

    private parseCsvLine(line: string, sep: "," | ";" = ","): string[] {
        const out: string[] = [];
        let i = 0;
        while (i < line.length) {
            if (line[i] === '"') {
                let s = "";
                i += 1;
                while (i < line.length) {
                    if (line[i] === '"') {
                        if (line[i + 1] === '"') {
                            s += '"';
                            i += 2;
                        } else {
                            i += 1;
                            break;
                        }
                    } else {
                        s += line[i];
                        i += 1;
                    }
                }
                out.push(s);
            } else {
                let s = "";
                while (i < line.length && line[i] !== sep) {
                    s += line[i];
                    i += 1;
                }
                out.push(s);
                if (line[i] === sep) i += 1;
            }
        }
        return out;
    }

    private async ensureAgentOwnership(user: UserPlayground, agentId: string): Promise<void> {
        const agent = await this.agentsService.findOneById(agentId);
        if (!agent) throw HttpErrorFactory.notFound("智能体不存在");
        if (agent.createBy !== user.id) throw HttpErrorFactory.forbidden("无权限操作该智能体");
    }

    private async updateMessageAnnotation(messageId: string, annotationId: string): Promise<void> {
        try {
            const message = await this.chatMessageRepository.findOne({
                where: { id: messageId },
            });
            if (!message) return;
            const annotation = await this.annotationRepository.findOne({
                where: { id: annotationId },
                relations: ["user"],
            });
            if (!annotation) return;
            const existingMessage = message.message || {};
            const metadata =
                (existingMessage as { metadata?: Record<string, unknown> }).metadata || {};
            (metadata as Record<string, unknown>).annotations = {
                annotationId: annotation.id,
                question: annotation.question,
                similarity: 1.0,
                createdBy: annotation.user?.nickname ?? annotation.user?.username ?? "未知用户",
            };
            await this.chatMessageRepository.update(
                { id: messageId },
                { message: { ...existingMessage, metadata } as any },
            );
        } catch (e) {
            this.logger.warn(`更新消息标注失败: ${(e as Error).message}`);
        }
    }

    private async removeAnnotationFromMessages(annotationId: string): Promise<void> {
        try {
            const messages = await this.chatMessageRepository
                .createQueryBuilder("m")
                .where("m.message->'metadata'->'annotations'->>'annotationId' = :id", {
                    id: annotationId,
                })
                .getMany();
            for (const message of messages) {
                const existingMessage = message.message || {};
                const metadata =
                    (existingMessage as { metadata?: Record<string, unknown> }).metadata || {};
                const ann = (metadata as { annotations?: { annotationId: string } }).annotations;
                if (ann?.annotationId === annotationId) {
                    delete (metadata as Record<string, unknown>).annotations;
                    await this.chatMessageRepository.update(
                        { id: message.id },
                        { message: { ...existingMessage, metadata } as any },
                    );
                }
            }
        } catch (e) {
            this.logger.warn(`清理消息标注失败: ${(e as Error).message}`);
        }
    }
}
