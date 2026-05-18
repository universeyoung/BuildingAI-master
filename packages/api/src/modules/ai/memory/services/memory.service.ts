import { BaseService } from "@buildingai/base";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import { AgentMemory, UserMemory } from "@buildingai/db/entities";
import { Repository } from "@buildingai/db/typeorm";
import { Injectable, Logger } from "@nestjs/common";

@Injectable()
export class MemoryService extends BaseService<UserMemory> {
    protected readonly logger = new Logger(MemoryService.name);

    constructor(
        @InjectRepository(UserMemory)
        private readonly userMemoryRepository: Repository<UserMemory>,
        @InjectRepository(AgentMemory)
        private readonly agentMemoryRepository: Repository<AgentMemory>,
    ) {
        super(userMemoryRepository);
    }

    async getUserMemories(userId: string, limit = 20): Promise<UserMemory[]> {
        return this.userMemoryRepository.find({
            where: { userId, isActive: true },
            order: { createdAt: "DESC" },
            take: limit,
        });
    }

    async createUserMemory(params: {
        userId: string;
        content: string;
        category: string;
        source?: string;
        sourceAgentId?: string;
    }): Promise<UserMemory> {
        const isDuplicate = await this.isDuplicateUserMemory(params.userId, params.content);
        if (isDuplicate) {
            this.logger.debug(
                `Skipping duplicate user memory: "${params.content.slice(0, 60)}..."`,
            );
            return isDuplicate;
        }

        const memory = this.userMemoryRepository.create({
            userId: params.userId,
            content: params.content,
            category: params.category,
            source: params.source,
            sourceAgentId: params.sourceAgentId,
            isActive: true,
        });
        return this.userMemoryRepository.save(memory);
    }

    async getAgentMemories(userId: string, agentId: string, limit = 20): Promise<AgentMemory[]> {
        return this.agentMemoryRepository.find({
            where: { userId, agentId, isActive: true },
            order: { createdAt: "DESC" },
            take: limit,
        });
    }

    async createAgentMemory(params: {
        userId: string;
        agentId: string;
        content: string;
        category: string;
        source?: string;
    }): Promise<AgentMemory> {
        const isDuplicate = await this.isDuplicateAgentMemory(
            params.userId,
            params.agentId,
            params.content,
        );
        if (isDuplicate) {
            this.logger.debug(
                `Skipping duplicate agent memory: "${params.content.slice(0, 60)}..."`,
            );
            return isDuplicate;
        }

        const memory = this.agentMemoryRepository.create({
            userId: params.userId,
            agentId: params.agentId,
            content: params.content,
            category: params.category,
            source: params.source,
            isActive: true,
        });
        return this.agentMemoryRepository.save(memory);
    }

    async findUserMemoryById(id: string, userId: string): Promise<UserMemory | null> {
        return this.userMemoryRepository.findOne({
            where: { id, userId, isActive: true },
        });
    }

    async deactivateUserMemory(id: string): Promise<void> {
        await this.userMemoryRepository.update(id, { isActive: false });
    }

    async deactivateAgentMemory(id: string): Promise<void> {
        await this.agentMemoryRepository.update(id, { isActive: false });
    }

    async trimUserMemoriesToLimit(userId: string, maxCount: number): Promise<void> {
        if (maxCount <= 0) return;
        const toKeep = await this.userMemoryRepository.find({
            where: { userId, isActive: true },
            order: { createdAt: "DESC" },
            take: maxCount,
            select: ["id"],
        });
        const keepIds = toKeep.map((m) => m.id);
        if (keepIds.length === 0) return;
        await this.userMemoryRepository
            .createQueryBuilder()
            .update()
            .set({ isActive: false })
            .where("userId = :userId", { userId })
            .andWhere("isActive = true")
            .andWhere("id NOT IN (:...keepIds)", { keepIds })
            .execute();
    }

    async trimAgentMemoriesToLimit(
        userId: string,
        agentId: string,
        maxCount: number,
    ): Promise<void> {
        if (maxCount <= 0) return;
        const toKeep = await this.agentMemoryRepository.find({
            where: { userId, agentId, isActive: true },
            order: { createdAt: "DESC" },
            take: maxCount,
            select: ["id"],
        });
        const keepIds = toKeep.map((m) => m.id);
        if (keepIds.length === 0) return;
        await this.agentMemoryRepository
            .createQueryBuilder()
            .update()
            .set({ isActive: false })
            .where("userId = :userId", { userId })
            .andWhere("agentId = :agentId", { agentId })
            .andWhere("isActive = true")
            .andWhere("id NOT IN (:...keepIds)", { keepIds })
            .execute();
    }

    private async isDuplicateUserMemory(
        userId: string,
        content: string,
    ): Promise<UserMemory | null> {
        const normalized = content.trim().toLowerCase();
        const existing = await this.userMemoryRepository
            .createQueryBuilder("m")
            .where("m.userId = :userId", { userId })
            .andWhere("m.isActive = true")
            .andWhere("LOWER(TRIM(m.content)) = :normalized", { normalized })
            .getOne();
        return existing;
    }

    private async isDuplicateAgentMemory(
        userId: string,
        agentId: string,
        content: string,
    ): Promise<AgentMemory | null> {
        const normalized = content.trim().toLowerCase();
        const existing = await this.agentMemoryRepository
            .createQueryBuilder("m")
            .where("m.userId = :userId", { userId })
            .andWhere("m.agentId = :agentId", { agentId })
            .andWhere("m.isActive = true")
            .andWhere("LOWER(TRIM(m.content)) = :normalized", { normalized })
            .getOne();
        return existing;
    }
}
