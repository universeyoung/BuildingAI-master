import { Column, Index, JoinColumn, ManyToOne } from "typeorm";

import { AppEntity } from "../decorators/app-entity.decorator";
import { BaseEntity } from "./base";
import { CardBatch } from "./card-batch.entity";
import { User } from "./user.entity";

/**
 * 卡密使用状态枚举
 */
export enum CardKeyStatus {
    /** 未使用 */
    UNUSED = 0,
    /** 已使用 */
    USED = 1,
    /** 已过期 */
    EXPIRED = 2,
}

/**
 * 卡密实体
 */
@AppEntity({ name: "cdk", comment: "卡密" })
export class CDK extends BaseEntity {
    /**
     * 卡密编号：随机12位数字字母组合
     */
    @Column({
        type: "varchar",
        length: 12,
        unique: true,
        comment: "卡密编号",
    })
    @Index()
    keyCode: string;

    /**
     * 批次ID
     */
    @Column({
        type: "uuid",
        name: "batch_id",
        comment: "批次ID",
    })
    @Index()
    batchId: string;

    /**
     * 批次关联
     */
    @ManyToOne(() => CardBatch, (batch) => batch.cardKeys)
    @JoinColumn({ name: "batch_id" })
    batch: CardBatch;

    /**
     * 使用状态：0-未使用 1-已使用 2-已过期
     */
    @Column({
        type: "enum",
        enum: CardKeyStatus,
        default: CardKeyStatus.UNUSED,
        comment: "使用状态",
    })
    @Index()
    status: CardKeyStatus;

    /**
     * 使用用户ID
     */
    @Column({
        type: "uuid",
        name: "user_id",
        nullable: true,
        comment: "使用用户ID",
    })
    @Index()
    userId: string | null;

    /**
     * 使用用户关联
     */
    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: "user_id" })
    user: User | null;

    /**
     * 使用时间
     */
    @Column({
        type: "timestamptz",
        nullable: true,
        comment: "使用时间",
    })
    usedAt: Date | null;
}
