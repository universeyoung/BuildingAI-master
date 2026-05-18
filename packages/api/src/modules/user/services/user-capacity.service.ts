import { CacheService } from "@buildingai/cache";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import { File, MembershipLevels, UserSubscription } from "@buildingai/db/entities";
import { Repository } from "@buildingai/db/typeorm";
import { DictService } from "@buildingai/dict";
import { Injectable, Logger } from "@nestjs/common";

/**
 * 用户容量信息接口
 */
export interface UserCapacityInfo {
    totalStorage: number;
    usedStorage: number;
    remainingStorage: number;
    usagePercent: number;
    membershipActive: boolean;
    baseStorage: number;
    membershipExtraStorage: number;
}

/**
 * 用户容量管理服务
 */
@Injectable()
export class UserCapacityService {
    private readonly logger = new Logger(UserCapacityService.name);
    private readonly CACHE_PREFIX = "user_storage";
    private readonly CACHE_TTL = 3600;

    constructor(
        @InjectRepository(File)
        private readonly fileRepository: Repository<File>,
        @InjectRepository(UserSubscription)
        private readonly subscriptionRepository: Repository<UserSubscription>,
        private readonly cacheService: CacheService,
        private readonly dictService: DictService,
    ) {}

    /**
     * 获取默认用户存储容量（字节）
     * 从 datasets_config 组读取 initial_storage_mb 配置（单位：MB）
     */
    async getDefaultUserStorage(): Promise<number> {
        const storageMb = await this.dictService.get<number>(
            "initial_storage_mb",
            100,
            "datasets_config",
        );
        const storageBytes = Number(storageMb) * 1024 * 1024;
        this.logger.debug(
            `Default user storage from config: ${storageMb}MB, converted to bytes: ${storageBytes}`,
        );
        return storageBytes;
    }

    /**
     * Resolves per-user base storage (bytes).
     * Community edition uses system default from dict only (no per-user override).
     *
     * @param _userId - User id (reserved for future enterprise overrides)
     */
    async getUserBaseStorage(_userId: string): Promise<number> {
        return this.getDefaultUserStorage();
    }

    /**
     * 获取用户当前会员额外存储容量
     */
    async getUserMembershipStorage(userId: string): Promise<number> {
        const now = new Date();
        const activeSubscription = await this.subscriptionRepository
            .createQueryBuilder("sub")
            .leftJoinAndSelect("sub.level", "level")
            .where("sub.userId = :userId", { userId })
            .andWhere("sub.startTime <= :now", { now })
            .andWhere("sub.endTime > :now", { now })
            .orderBy("level.level", "DESC")
            .getOne();

        if (!activeSubscription?.level) {
            return 0;
        }

        const storageCapacity = (activeSubscription.level as MembershipLevels).storageCapacity;

        return Number(storageCapacity) || 0;
    }

    /**
     * 获取用户已使用存储空间（字节）
     * 只统计知识库文档关联的文件，不包括其他普通上传文件
     */
    async getUserUsedStorage(userId: string, forceRefresh = false): Promise<number> {
        const cacheKey = `${this.CACHE_PREFIX}:${userId}`;

        if (!forceRefresh) {
            const cached = await this.cacheService.get<number>(cacheKey);
            if (cached !== null && cached !== undefined) {
                return cached;
            }
        }

        // 只统计知识库文档关联的文件大小
        const result = await this.fileRepository
            .createQueryBuilder("file")
            .innerJoin("datasets_documents", "doc", "doc.file_id = file.id")
            .innerJoin("datasets", "dataset", "dataset.id = doc.dataset_id")
            .select("SUM(file.size)", "total")
            .where("dataset.created_by = :userId", { userId })
            .getRawOne();

        const usedStorage = Number(result?.total || 0);

        await this.cacheService.set(cacheKey, usedStorage, this.CACHE_TTL);

        return usedStorage;
    }

    /**
     * 获取用户总存储容量
     */
    async getUserTotalCapacity(userId: string): Promise<number> {
        const [baseStorage, membershipStorage] = await Promise.all([
            this.getUserBaseStorage(userId),
            this.getUserMembershipStorage(userId),
        ]);

        return baseStorage + membershipStorage;
    }

    /**
     * 获取用户剩余存储空间
     */
    async getUserRemainingStorage(userId: string): Promise<number> {
        const [totalCapacity, usedStorage] = await Promise.all([
            this.getUserTotalCapacity(userId),
            this.getUserUsedStorage(userId),
        ]);

        return Math.max(0, totalCapacity - usedStorage);
    }

    /**
     * 检查用户是否可以上传指定大小的文件
     */
    async canUpload(userId: string, fileSize: number): Promise<boolean> {
        const [totalCapacity, usedStorage] = await Promise.all([
            this.getUserTotalCapacity(userId),
            this.getUserUsedStorage(userId),
        ]);

        return usedStorage + fileSize <= totalCapacity;
    }

    /**
     * 获取用户完整容量信息
     */
    async getUserCapacityInfo(userId: string): Promise<UserCapacityInfo> {
        const [baseStorage, membershipStorage, usedStorage] = await Promise.all([
            this.getUserBaseStorage(userId),
            this.getUserMembershipStorage(userId),
            this.getUserUsedStorage(userId),
        ]);

        const totalStorage = baseStorage + membershipStorage;
        const remainingStorage = Math.max(0, totalStorage - usedStorage);
        const usagePercent = totalStorage > 0 ? (usedStorage / totalStorage) * 100 : 0;

        return {
            totalStorage,
            usedStorage,
            remainingStorage,
            usagePercent: Number(usagePercent.toFixed(2)),
            membershipActive: membershipStorage > 0,
            baseStorage,
            membershipExtraStorage: membershipStorage,
        };
    }

    /**
     * 清除用户容量缓存
     */
    async clearUserStorageCache(userId: string): Promise<void> {
        const cacheKey = `${this.CACHE_PREFIX}:${userId}`;
        await this.cacheService.del(cacheKey);
        this.logger.log(`Cleared storage cache for user: ${userId}`);
    }

    /**
     * 强制刷新用户已使用存储（忽略缓存，重新统计）
     */
    async refreshUserUsedStorage(userId: string): Promise<number> {
        await this.clearUserStorageCache(userId);
        return this.getUserUsedStorage(userId, true);
    }

    /**
     * 更新用户已使用存储（在文件上传/删除后调用）
     */
    async updateUserStorage(userId: string, sizeDelta: number): Promise<void> {
        const cacheKey = `${this.CACHE_PREFIX}:${userId}`;
        const currentUsed = await this.getUserUsedStorage(userId);
        const newUsed = Math.max(0, currentUsed + sizeDelta);
        await this.cacheService.set(cacheKey, newUsed, this.CACHE_TTL);
    }
}
