import { BaseService } from "@buildingai/base";
import { ExtensionStatus } from "@buildingai/constants/shared/extension.constant";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import { Extension } from "@buildingai/db/entities";
import { DeepPartial, ILike, Raw, Repository } from "@buildingai/db/typeorm";
import { DictService } from "@buildingai/dict";
import { HttpErrorFactory } from "@buildingai/errors";
import { buildWhere } from "@buildingai/utils";
import { Injectable } from "@nestjs/common";

import {
    BatchUpdateSortDto,
    QueryAppsDecorateItemsDto,
    UpdateItemDecorationDto,
} from "../dto/apps-decorate.dto";

const GROUP = "apps-decorate";
const CONFIG_KEY = "apps_decorate_config";
const CONFIG_FILE_URL_FIELDS = ["heroImageUrl", "banners.*.imageUrl"];

/**
 * 应用中心装饰链接项接口（向后兼容）
 */
export interface AppsDecorateLinkItem {
    type?: string;
    name?: string;
    path?: string;
    query?: Record<string, unknown>;
}

/**
 * Banner 项接口
 */
export interface AppsDecorateBannerItem {
    imageUrl: string;
    linkUrl?: string;
}

/**
 * 应用中心装饰配置接口
 */
export interface AppsDecorateConfig {
    enabled: boolean;
    title: string;
    description: string;
    /**
     * Banner 列表（优先使用此字段）
     */
    banners?: AppsDecorateBannerItem[];
    /**
     * 单个链接配置（向后兼容，已废弃）
     * @deprecated 使用 banners 字段替代
     */
    link?: AppsDecorateLinkItem;
    /**
     * 单个图片 URL（向后兼容，已废弃）
     * @deprecated 使用 banners 字段替代
     */
    heroImageUrl?: string;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: AppsDecorateConfig = {
    enabled: false,
    title: "",
    description: "",
    banners: [],
};

/**
 * 应用中心装饰服务
 * @description 处理应用中心运营位配置和应用装饰项的获取和设置
 */
@Injectable()
export class AppsDecorateService extends BaseService<Extension> {
    constructor(
        private readonly dictService: DictService,
        @InjectRepository(Extension)
        private readonly extensionRepo: Repository<Extension>,
    ) {
        super(extensionRepo);
    }

    /**
     * 获取应用中心装饰配置
     */
    async getConfig(): Promise<AppsDecorateConfig> {
        const stored = await this.dictService.get<Partial<AppsDecorateConfig>>(
            CONFIG_KEY,
            undefined,
            GROUP,
            { restoreFileUrlFields: CONFIG_FILE_URL_FIELDS },
        );

        const config: AppsDecorateConfig = { ...DEFAULT_CONFIG, ...(stored || {}) };

        // 向后兼容：如果存在 heroImageUrl 但没有 banners，转换为 banners 格式
        if (!config.banners || config.banners.length === 0) {
            if (config.heroImageUrl) {
                config.banners = [
                    {
                        imageUrl: config.heroImageUrl,
                        linkUrl: config.link?.path,
                    },
                ];
            } else {
                config.banners = [];
            }
        }

        return config;
    }

    /**
     * 设置应用中心装饰配置
     */
    async setConfig(
        payload: Partial<AppsDecorateConfig> & Pick<AppsDecorateConfig, "enabled" | "title">,
    ): Promise<AppsDecorateConfig> {
        const configToSave: AppsDecorateConfig = {
            enabled: payload.enabled,
            title: payload.title,
            description: payload.description ?? "",
        };

        if (payload.banners && payload.banners.length > 0) {
            configToSave.banners = payload.banners;
        } else if (payload.heroImageUrl) {
            configToSave.banners = [
                {
                    imageUrl: payload.heroImageUrl,
                    linkUrl: payload.link?.path,
                },
            ];
        } else {
            configToSave.banners = [];
        }

        await this.dictService.set(CONFIG_KEY, configToSave, {
            group: GROUP,
            description: "apps-decorate 配置",
            normalizeFileUrlFields: CONFIG_FILE_URL_FIELDS,
        });

        return this.getConfig();
    }

    /**
     * 分页查询应用装饰项
     */
    async paginateItems(query: QueryAppsDecorateItemsDto) {
        const baseWhere = buildWhere<Extension>({
            status: ExtensionStatus.ENABLED,
            appCenterTagIds: query.tagId
                ? Raw((alias) => `${alias} @> :tagIds::jsonb`, {
                      tagIds: JSON.stringify([query.tagId]),
                  })
                : undefined,
        });

        const where = query.keyword
            ? [
                  { ...baseWhere, name: ILike(`%${query.keyword}%`) },
                  { ...baseWhere, identifier: ILike(`%${query.keyword}%`) },
                  { ...baseWhere, alias: ILike(`%${query.keyword}%`) },
              ]
            : baseWhere;

        return this.paginate(
            { page: query.page ?? 1, pageSize: query.pageSize ?? 20 },
            {
                where,
                order: {
                    appCenterSort: { direction: "ASC", nulls: "LAST" },
                    createdAt: "DESC",
                },
            },
        );
    }

    /**
     * 更新单个应用装饰项
     */
    async updateItemDecoration(extensionId: string, dto: UpdateItemDecorationDto) {
        try {
            const updateData: DeepPartial<Extension> = {};
            if (dto.alias !== undefined) updateData.alias = dto.alias;
            if (dto.aliasDescription !== undefined)
                updateData.aliasDescription = dto.aliasDescription;
            if (dto.aliasIcon !== undefined) updateData.aliasIcon = dto.aliasIcon;
            if (dto.aliasShow !== undefined) updateData.aliasShow = dto.aliasShow;
            if (dto.appCenterTagIds !== undefined) updateData.appCenterTagIds = dto.appCenterTagIds;
            if (dto.appCenterSort !== undefined) updateData.appCenterSort = dto.appCenterSort;
            return await this.updateById(extensionId, updateData);
        } catch (error) {
            this.logger.error(`更新应用装饰项失败: ${error.message}`, error.stack);
            throw HttpErrorFactory.badRequest("Failed to update item decoration.");
        }
    }

    /**
     * 批量更新排序
     */
    async batchUpdateSort(dto: BatchUpdateSortDto) {
        const { items } = dto;

        if (!items || items.length === 0) {
            throw HttpErrorFactory.paramError("排序数组不能为空");
        }

        try {
            await this.withTransaction(async (manager) => {
                const repo = manager.getRepository(Extension);
                for (const item of items) {
                    await repo.update(item.id, { appCenterSort: item.sort });
                }
            });
            return { success: true };
        } catch (error) {
            this.logger.error(`批量更新排序失败: ${error.message}`, error.stack);
            throw HttpErrorFactory.badRequest("Failed to batch update sort.");
        }
    }
}
