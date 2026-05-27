import { AppEntity } from "../decorators/app-entity.decorator";
import { Column } from "../typeorm";
import { BaseEntity } from "./base";

/**
 * 密钥池状态枚举
 */
export enum KeyPoolStatus {
    /** 活跃 */
    ACTIVE = "active",
    /** 已禁用 */
    DISABLED = "disabled",
}

/**
 * 密钥池策略枚举
 */
export enum KeyPoolStrategy {
    /** 轮询 */
    ROUND_ROBIN = "round_robin",
    /** 随机 */
    RANDOM = "random",
    /** 最少使用 */
    LEAST_USED = "least_used",
}

/**
 * 密钥池实体
 * 存储密钥池信息
 */
@AppEntity({ name: "key_pool", comment: "密钥池" })
export class KeyPool extends BaseEntity {
    /**
     * 团队ID
     */
    @Column({ type: "uuid", comment: "团队ID" })
    teamId: string;

    /**
     * 密钥池名称
     */
    @Column({ type: "varchar", length: 100, comment: "密钥池名称" })
    name: string;

    /**
     * 提供商
     */
    @Column({ type: "varchar", length: 50, comment: "提供商" })
    provider: string;

    /**
     * 状态
     */
    @Column({
        type: "enum",
        enum: KeyPoolStatus,
        default: KeyPoolStatus.ACTIVE,
        comment: "状态",
    })
    status: KeyPoolStatus;

    /**
     * 策略
     */
    @Column({
        type: "enum",
        enum: KeyPoolStrategy,
        default: KeyPoolStrategy.ROUND_ROBIN,
        comment: "策略",
    })
    strategy: KeyPoolStrategy;

    /**
     * 密钥列表
     */
    @Column({ type: "json", default: () => "'[]'", comment: "密钥列表" })
    keys: Array<{ id: string; key: string; usage: number }>;
}
