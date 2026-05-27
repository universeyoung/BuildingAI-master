import { AppEntity } from "../decorators/app-entity.decorator";
import { Column } from "../typeorm";
import { BaseEntity } from "./base";

/**
 * API密钥状态枚举
 */
export enum ApiKeyStatus {
    /** 活跃 */
    ACTIVE = "active",
    /** 已撤销 */
    REVOKED = "revoked",
    /** 已过期 */
    EXPIRED = "expired",
}

/**
 * API密钥实体
 * 存储API密钥信息
 */
@AppEntity({ name: "api_key", comment: "API密钥" })
export class ApiKey extends BaseEntity {
    /**
     * 团队ID
     */
    @Column({ type: "uuid", comment: "团队ID" })
    teamId: string;

    /**
     * 密钥名称
     */
    @Column({ type: "varchar", length: 100, comment: "密钥名称" })
    name: string;

    /**
     * 密钥值
     */
    @Column({ type: "varchar", length: 500, comment: "密钥值" })
    key: string;

    /**
     * 密钥哈希
     */
    @Column({ type: "varchar", length: 500, comment: "密钥哈希" })
    keyHash: string;

    /**
     * 状态
     */
    @Column({
        type: "enum",
        enum: ApiKeyStatus,
        default: ApiKeyStatus.ACTIVE,
        comment: "状态",
    })
    status: ApiKeyStatus;

    /**
     * 权限
     */
    @Column({ type: "json", default: () => "'[]'", comment: "权限" })
    permissions: string[];

    /**
     * 过期时间
     */
    @Column({ type: "timestamptz", nullable: true, comment: "过期时间" })
    expiresAt?: Date | null;

    /**
     * 最后使用时间
     */
    @Column({ type: "timestamptz", nullable: true, comment: "最后使用时间" })
    lastUsedAt?: Date | null;
}
