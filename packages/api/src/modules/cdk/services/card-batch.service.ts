import { BaseService } from "@buildingai/base";
import { CardBatch, CardKeyStatus, CDK, MembershipLevels } from "@buildingai/db/entities";
import { HttpErrorFactory } from "@buildingai/errors";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Between, Like, Repository } from "typeorm";

import { CreateCardBatchDto } from "../dto/create-card-batch.dto";
import { QueryCardBatchDto } from "../dto/query-card-batch.dto";
import { QueryCDKDto } from "../dto/query-cdk.dto";
import { CDKService } from "./cdk.service";

/**
 * 卡密批次服务
 */
@Injectable()
export class CardBatchService extends BaseService<CardBatch> {
    constructor(
        @InjectRepository(CardBatch)
        private readonly cardBatchRepository: Repository<CardBatch>,
        @InjectRepository(CDK)
        private readonly cdkRepository: Repository<CDK>,
        @InjectRepository(MembershipLevels)
        private readonly membershipLevelsRepository: Repository<MembershipLevels>,
        private readonly cdkService: CDKService,
    ) {
        super(cardBatchRepository);
    }

    /**
     * 生成批次编号：年月日+随机4位数字
     */
    private generateBatchNo(): string {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        const random = Math.floor(1000 + Math.random() * 9000);
        return `${year}${month}${day}${random}`;
    }

    /**
     * 生成卡密编号：随机12位数字字母组合
     */
    private generateKeyCode(): string {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let result = "";
        for (let i = 0; i < 12; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    /**
     * 创建卡密批次
     */
    async createBatch(createCardBatchDto: CreateCardBatchDto) {
        const {
            name,
            redeemType,
            levelId,
            membershipDuration,
            customDuration,
            pointsAmount,
            expireAt,
            totalCount,
            remark,
        } = createCardBatchDto;

        // 校验会员等级
        if (levelId) {
            const level = await this.membershipLevelsRepository.findOne({
                where: { id: levelId },
            });

            if (!level) {
                throw HttpErrorFactory.badRequest("会员等级不存在");
            }
        }

        // 生成批次号
        const batchNo = this.generateBatchNo();

        return this.cardBatchRepository.manager.transaction(async (manager) => {
            // 创建批次
            const batch = manager.create(CardBatch, {
                batchNo,
                name,
                redeemType,
                levelId: levelId ?? null,
                membershipDuration: membershipDuration ?? null,
                customDuration: customDuration ?? null,
                pointsAmount: pointsAmount ?? null,
                expireAt,
                totalCount,
                remark: remark ?? null,
            });

            const savedBatch = await manager.save(CardBatch, batch);

            // 生成卡密
            const keyCodes = this.generateKeyCodes(totalCount);

            const cardKeys = keyCodes.map((code) =>
                manager.create(CDK, {
                    keyCode: code,
                    batchId: savedBatch.id,
                    status: CardKeyStatus.UNUSED,
                    userId: null,
                    usedAt: null,
                }),
            );

            // 分批插入（防止 SQL 太大）
            const chunkSize = 1000;

            for (let i = 0; i < cardKeys.length; i += chunkSize) {
                const chunk = cardKeys.slice(i, i + chunkSize);
                await manager.insert(CDK, chunk);
            }

            return savedBatch;
        });
    }

    private generateKeyCodes(count: number): string[] {
        const codes = new Set<string>();

        while (codes.size < count) {
            codes.add(this.generateKeyCode());
        }

        return Array.from(codes);
    }

    /**
     * 查询批次列表
     */
    async queryBatches(queryDto: QueryCardBatchDto) {
        const { batchNo, name, redeemType, startTime, endTime } = queryDto;

        const where: any = {};

        if (batchNo) {
            where.batchNo = Like(`%${batchNo}%`);
        }

        if (name) {
            where.name = Like(`%${name}%`);
        }

        if (redeemType) {
            where.redeemType = redeemType;
        }

        if (startTime && endTime) {
            where.createdAt = Between(startTime, endTime);
        }

        const result = await this.paginate(queryDto, {
            where,
            relations: ["level"],
            select: {
                id: true,
                batchNo: true,
                name: true,
                redeemType: true,
                remark: true,
                levelId: true,
                membershipDuration: true,
                customDuration: true,
                pointsAmount: true,
                expireAt: true,
                totalCount: true,
                createdAt: true,
                updatedAt: true,
                level: {
                    name: true,
                    level: true,
                    description: true,
                },
            },
            order: { createdAt: "DESC" },
        });

        // 为每个批次添加已使用数量和格式化的兑换内容
        const itemsWithExtras = await Promise.all(
            result.items.map(async (batch) => {
                // 统计已使用数量
                const usedCount = await this.cdkRepository.count({
                    where: { batchId: batch.id, status: CardKeyStatus.USED },
                });

                // 构建兑换内容
                let redeemContent = "";
                if (batch.redeemType === 1) {
                    // 会员类型：会员等级（几月）
                    const levelName = batch.level?.name || "未知等级";
                    let duration = "未知时长";

                    if (batch.membershipDuration) {
                        switch (batch.membershipDuration) {
                            case 1:
                                duration = "1个月";
                                break;
                            case 2:
                                duration = "3个月";
                                break;
                            case 3:
                                duration = "6个月";
                                break;
                            case 4:
                                duration = "1年";
                                break;
                            case 5:
                                duration = "终身";
                                break;
                            case 6:
                                if (batch.customDuration) {
                                    duration = `${batch.customDuration.value}${batch.customDuration.unit}`;
                                }
                                break;
                        }
                    }

                    redeemContent = `${levelName}（${duration}）`;
                } else if (batch.redeemType === 2) {
                    // 积分类型
                    redeemContent = `${batch.pointsAmount || 0}积分`;
                }

                return {
                    ...batch,
                    usedCount,
                    redeemContent,
                };
            }),
        );

        return {
            ...result,
            items: itemsWithExtras,
        };
    }

    /**
     * 查询批次下的卡密列表（分页）
     */
    async queryBatchCDKs(batchId: string, queryDto: QueryCDKDto) {
        const batch = await this.cardBatchRepository.findOne({
            where: { id: batchId },
            relations: ["level"],
        });

        if (!batch) {
            throw HttpErrorFactory.notFound("批次不存在");
        }

        // 构建兑换内容
        let redeemContent = "";
        if (batch.redeemType === 1) {
            // 会员类型：会员等级（几月）
            const levelName = batch.level?.name || "未知等级";
            let duration = "未知时长";

            if (batch.membershipDuration) {
                // 根据枚举值显示时长
                switch (batch.membershipDuration) {
                    case 1: // MONTH
                        duration = "1个月";
                        break;
                    case 2: // QUARTER
                        duration = "3个月";
                        break;
                    case 3: // HALF
                        duration = "6个月";
                        break;
                    case 4: // YEAR
                        duration = "1年";
                        break;
                    case 5: // FOREVER
                        duration = "终身";
                        break;
                    case 6: // CUSTOM
                        if (batch.customDuration) {
                            duration = `${batch.customDuration.value}${batch.customDuration.unit}`;
                        }
                        break;
                }
            }

            redeemContent = `${levelName}（${duration}）`;
        } else if (batch.redeemType === 2) {
            // 积分类型：直接返回积分数量
            redeemContent = `${batch.pointsAmount || 0}积分`;
        }

        // 统计已使用数量
        const usedCount = await this.cdkRepository.count({
            where: { batchId, status: CardKeyStatus.USED },
        });

        const extendsData = {
            batchNo: batch.batchNo,
            name: batch.name,
            redeemType: batch.redeemType,
            redeemContent,
            expireAt: batch.expireAt,
            totalCount: batch.totalCount,
            usedCount,
            remainingCount: batch.totalCount - usedCount,
        };

        const item = await this.cdkService.queryBatchCDKs(batchId, queryDto);

        return {
            ...item,
            extends: extendsData,
        };
    }

    /**
     * 删除批次（级联删除卡密）
     */
    async deleteBatch(id: string) {
        const batch = await this.cardBatchRepository.findOne({ where: { id } });

        if (!batch) {
            throw HttpErrorFactory.notFound("批次不存在");
        }

        // 检查是否有已使用的卡密
        const usedCount = await this.cdkRepository.count({
            where: { batchId: id, status: CardKeyStatus.USED },
        });

        if (usedCount > 0) {
            throw HttpErrorFactory.badRequest("该批次存在已使用的卡密，无法删除");
        }

        // 使用事务删除
        await this.cardBatchRepository.manager.transaction(async (entityManager) => {
            // 删除该批次的所有卡密
            await entityManager.delete(CDK, { batchId: id });
            // 删除批次
            await entityManager.delete(CardBatch, { id });
        });

        return { success: true };
    }
}
