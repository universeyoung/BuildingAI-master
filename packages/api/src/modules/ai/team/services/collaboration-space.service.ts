import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import { Repository } from "@buildingai/db/typeorm";
import { CollaborationSpace, Message, SharedMemoryEntry, MessageSenderType, MessageContentType } from "@buildingai/db/entities";

export interface MessageInput {
    spaceId: string;
    channelId?: string;
    senderType: MessageSenderType;
    senderId?: string;
    contentType?: MessageContentType;
    content: Record<string, unknown>;
}

export interface MessageSendResult {
    messageId: string;
    delivered: boolean;
}

export interface MemoryInput {
    spaceId: string;
    key: string;
    value: Record<string, unknown>;
    memberId: string;
}

export interface MemoryWriteResult {
    entryId: string;
}

@Injectable()
export class CollaborationSpaceService {
    private readonly logger = new Logger(CollaborationSpaceService.name);

    constructor(
        @InjectRepository(CollaborationSpace)
        private readonly spaceRepository: Repository<CollaborationSpace>,
        @InjectRepository(Message)
        private readonly messageRepository: Repository<Message>,
        @InjectRepository(SharedMemoryEntry)
        private readonly memoryRepository: Repository<SharedMemoryEntry>,
    ) {}

    async getByTeam(teamId: string): Promise<CollaborationSpace | null> {
        let space = await this.spaceRepository.findOne({ where: { teamId } });
        if (!space) {
            space = this.spaceRepository.create({ teamId, name: "协作空间", config: {} });
            space = await this.spaceRepository.save(space);
        }
        return space;
    }

    async readMemory(spaceId: string, key: string): Promise<SharedMemoryEntry | null> {
        return this.memoryRepository.findOne({ where: { spaceId, key } });
    }

    async getAllMemory(spaceId: string): Promise<SharedMemoryEntry[]> {
        return this.memoryRepository.find({ where: { spaceId } });
    }

    async writeMemory(input: MemoryInput): Promise<MemoryWriteResult> {
        const existing = await this.memoryRepository.findOne({
            where: { spaceId: input.spaceId, key: input.key },
        });

        if (existing) {
            existing.value = input.value;
            existing.version += 1;
            const saved = await this.memoryRepository.save(existing);
            return { entryId: (saved as any).id };
        }

        const entry = this.memoryRepository.create({
            spaceId: input.spaceId,
            key: input.key,
            value: input.value,
            createdBy: input.memberId,
        });

        const saved = await this.memoryRepository.save(entry);
        return { entryId: (saved as any).id };
    }

    async getMessages(spaceId: string): Promise<Message[]> {
        const qb = this.messageRepository.createQueryBuilder("message");
        qb.where("message.spaceId = :spaceId", { spaceId });
        qb.orderBy("message.createdAt", "ASC");
        return qb.getMany();
    }

    async sendMessage(input: MessageInput): Promise<MessageSendResult> {
        const message = this.messageRepository.create({
            spaceId: input.spaceId,
            channelId: input.channelId,
            senderType: input.senderType,
            senderId: input.senderId,
            contentType: input.contentType || MessageContentType.TEXT,
            content: input.content,
        });

        const saved = await this.messageRepository.save(message);
        return { messageId: (saved as any).id, delivered: true };
    }

    async searchMemory(spaceId: string, query: string): Promise<SharedMemoryEntry[]> {
        const qb = this.memoryRepository.createQueryBuilder("entry");
        qb.where("entry.spaceId = :spaceId", { spaceId });
        qb.andWhere("entry.key LIKE :query", { query: `%${query}%` });
        return qb.getMany();
    }
}
