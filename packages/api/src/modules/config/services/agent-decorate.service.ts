import { BaseService, type PaginationResult } from "@buildingai/base";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import {
    Agent,
    AgentChatMessage,
    AiModel,
    SquarePublishStatus,
    User,
} from "@buildingai/db/entities";
import { ILike, In, Repository } from "@buildingai/db/typeorm";
import { DictService } from "@buildingai/dict";
import { HttpErrorFactory } from "@buildingai/errors";
import { Injectable } from "@nestjs/common";

import {
    type BatchUpdateAgentDecorateSortDto,
    type QueryAgentDecorateItemsDto,
} from "../dto/agent-decorate.dto";

const GROUP = "agent-decorate";
const KEY = "config";
const FILE_URL_FIELDS = ["heroImageUrl", "overlayIconUrl", "banners.*.imageUrl"];

export type AgentDecoratePublicItem = {
    id: string;
    name: string;
    description?: string | null;
    avatar?: string | null;
    updatedAt: string;
    userCount: number;
    messageCount: number;
    creator: { id: string; nickname: string | null; avatar: string | null } | null;
    primaryModel: {
        id: string;
        name: string;
        iconUrl: string | null;
        provider: string | null;
    } | null;
    tags?: { id: string; name: string }[];
};

/**
 * 智能体广场链接项配置。
 */
export interface AgentDecorateLinkItem {
    type?: string;
    name?: string;
    path?: string;
    query?: Record<string, unknown>;
}

/**
 * 智能体广场 Banner 项配置。
 */
export interface AgentDecorateBannerItem {
    imageUrl: string;
    linkUrl?: string;
    linkType?: "system" | "custom";
}

/**
 * 智能体广场装修配置。
 */
export interface AgentDecorateConfig {
    enabled: boolean;
    title: string;
    description: string;
    banners?: AgentDecorateBannerItem[];
    link: AgentDecorateLinkItem;
    heroImageUrl: string;
    overlayTitle: string;
    overlayDescription: string;
    overlayIconUrl: string;
    sortAgentIds: string[];
}

const DEFAULT_CONFIG: AgentDecorateConfig = {
    enabled: false,
    title: "",
    description: "",
    banners: [],
    link: {},
    heroImageUrl: "",
    overlayTitle: "",
    overlayDescription: "",
    overlayIconUrl: "",
    sortAgentIds: [],
};

@Injectable()
export class AgentDecorateService extends BaseService<Agent> {
    constructor(
        private readonly dictService: DictService,
        @InjectRepository(Agent)
        private readonly agentRepository: Repository<Agent>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(AgentChatMessage)
        private readonly agentChatMessageRepository: Repository<AgentChatMessage>,
        @InjectRepository(AiModel)
        private readonly aiModelRepository: Repository<AiModel>,
    ) {
        super(agentRepository);
    }

    /**
     * 获取智能体广场装修配置。
     */
    async getConfig(): Promise<AgentDecorateConfig> {
        const stored = await this.dictService.get<Partial<AgentDecorateConfig>>(
            KEY,
            undefined,
            GROUP,
            { restoreFileUrlFields: FILE_URL_FIELDS },
        );

        const config: AgentDecorateConfig = { ...DEFAULT_CONFIG, ...(stored || {}) };

        if (!config.banners || config.banners.length === 0) {
            if (config.heroImageUrl) {
                config.banners = [
                    {
                        imageUrl: config.heroImageUrl,
                        linkUrl: config.link?.path,
                        linkType: "system",
                    },
                ];
            } else {
                config.banners = [];
            }
        }

        return config;
    }

    /**
     * 设置智能体广场装修配置。
     */
    async setConfig(payload: Partial<AgentDecorateConfig>): Promise<AgentDecorateConfig> {
        const current = await this.getConfig();
        const configToSave: AgentDecorateConfig = {
            ...current,
            ...payload,
            link: payload.link ?? current.link ?? {},
            sortAgentIds: payload.sortAgentIds ?? current.sortAgentIds ?? [],
        };

        if (payload.banners && payload.banners.length > 0) {
            configToSave.banners = payload.banners;
            configToSave.heroImageUrl = payload.banners[0]?.imageUrl ?? "";
            configToSave.link = payload.banners[0]?.linkUrl
                ? { path: payload.banners[0].linkUrl }
                : {};
        } else if (payload.heroImageUrl) {
            configToSave.banners = [
                {
                    imageUrl: payload.heroImageUrl,
                    linkUrl: payload.link?.path,
                    linkType: "system",
                },
            ];
            configToSave.heroImageUrl = payload.heroImageUrl;
            configToSave.link = payload.link ?? {};
        } else if (payload.banners) {
            configToSave.banners = [];
            configToSave.heroImageUrl = "";
            configToSave.link = {};
        }

        await this.dictService.set(KEY, configToSave, {
            group: GROUP,
            description: "agent-decorate 配置",
            normalizeFileUrlFields: FILE_URL_FIELDS,
        });
        return this.getConfig();
    }

    private async countMessagesByAgentIds(agentIds: string[]): Promise<Map<string, number>> {
        if (agentIds.length === 0) {
            return new Map();
        }
        const rows = await this.agentChatMessageRepository
            .createQueryBuilder("msg")
            .select("msg.agentId", "agentId")
            .addSelect("COUNT(msg.id)", "cnt")
            .where("msg.agentId IN (:...agentIds)", { agentIds })
            .groupBy("msg.agentId")
            .getRawMany<{ agentId: string; cnt: string }>();
        return new Map(rows.map((r) => [r.agentId, Number(r.cnt)]));
    }

    private async enrichPublicItems(agents: Agent[]): Promise<AgentDecoratePublicItem[]> {
        if (agents.length === 0) {
            return [];
        }
        const agentIds = agents.map((a) => a.id);
        const creatorIds = [...new Set(agents.map((a) => a.createBy).filter(Boolean))] as string[];
        const modelIds = [
            ...new Set(
                agents.map((a) => a.modelConfig?.id).filter((id): id is string => Boolean(id)),
            ),
        ];
        const [users, messageCountMap, models] = await Promise.all([
            creatorIds.length > 0
                ? this.userRepository.find({
                      where: { id: In(creatorIds) },
                      select: { id: true, nickname: true, avatar: true },
                  })
                : Promise.resolve([] as User[]),
            this.countMessagesByAgentIds(agentIds),
            modelIds.length > 0
                ? this.aiModelRepository.find({
                      where: { id: In(modelIds) },
                      relations: { provider: true },
                  })
                : Promise.resolve([] as AiModel[]),
        ]);
        const creatorMap = new Map(
            users.map((u) => [
                u.id,
                { id: u.id, nickname: u.nickname ?? null, avatar: u.avatar ?? null },
            ]),
        );
        const modelMap = new Map(
            models.map((m) => [
                m.id,
                {
                    id: m.id,
                    name: m.name,
                    iconUrl: m.provider?.iconUrl ?? null,
                    provider: m.provider?.provider ?? null,
                },
            ]),
        );
        return agents.map((agent) => {
            const mid = agent.modelConfig?.id;
            const primaryModel = mid ? (modelMap.get(mid) ?? null) : null;
            const creator = agent.createBy ? (creatorMap.get(agent.createBy) ?? null) : null;
            return {
                id: agent.id,
                name: agent.name,
                description: agent.description ?? null,
                avatar: agent.avatar ?? null,
                updatedAt: agent.updatedAt.toISOString(),
                userCount: agent.userCount ?? 0,
                messageCount: messageCountMap.get(agent.id) ?? 0,
                creator,
                primaryModel,
                tags: agent.tags?.map((t) => ({ id: t.id, name: t.name })),
            };
        });
    }

    async paginateItems(
        query: QueryAgentDecorateItemsDto,
        options: { forPublic: true },
    ): Promise<PaginationResult<AgentDecoratePublicItem>>;
    async paginateItems(
        query: QueryAgentDecorateItemsDto,
        options?: { forPublic?: false },
    ): Promise<PaginationResult<Agent>>;
    async paginateItems(
        query: QueryAgentDecorateItemsDto,
        options?: { forPublic?: boolean },
    ): Promise<PaginationResult<Agent> | PaginationResult<AgentDecoratePublicItem>> {
        const baseWhere = {
            squarePublishStatus: SquarePublishStatus.APPROVED,
            publishedToSquare: true,
            tags: query.tagId
                ? {
                      id: query.tagId,
                  }
                : undefined,
        };

        const where = query.keyword?.trim()
            ? [
                  { ...baseWhere, name: ILike(`%${query.keyword.trim()}%`) },
                  { ...baseWhere, description: ILike(`%${query.keyword.trim()}%`) },
              ]
            : baseWhere;

        const result = await this.paginate(
            { page: query.page ?? 1, pageSize: query.pageSize ?? 20 },
            {
                where,
                relations: ["tags"],
                order: {
                    decorateSort: { direction: "ASC", nulls: "LAST" },
                    updatedAt: "DESC",
                },
            },
        );

        if (options?.forPublic) {
            const items = await this.enrichPublicItems(result.items);
            return {
                ...result,
                items,
            };
        }

        return result;
    }

    async batchUpdateSort(dto: BatchUpdateAgentDecorateSortDto) {
        const { items } = dto;

        if (!items || items.length === 0) {
            throw HttpErrorFactory.paramError("排序数组不能为空");
        }

        try {
            await this.withTransaction(async () => {
                for (const item of items) {
                    await this.agentRepository.update(item.id, {
                        decorateSort: item.sort,
                    });
                }
            });

            return { success: true };
        } catch (error) {
            this.logger.error(`批量更新智能体装修排序失败: ${error.message}`, error.stack);
            throw HttpErrorFactory.badRequest("Failed to batch update sort.");
        }
    }
}
