import { Column, Index, JoinColumn, ManyToOne, OneToMany } from "typeorm";

import { AppEntity } from "../decorators/app-entity.decorator";
import { BaseEntity } from "./base";
import { CDK } from "./cdk.entity";
import { MembershipLevels } from "./membership-levels.entity";
import type { Duration } from "./membership-plans.entity";
import { MembershipPlanDuration } from "./membership-plans.entity";

/**
 * 卡密兑换类型枚举
 */
export enum CardRedeemType {
    /** 订阅会员 */
    MEMBERSHIP = 1,
    /** 积分余额 */
    POINTS = 2,
}

/**
 * 会员时长配置
 */
export interface MembershipDuration {
    /** 时长数值 */
    value: number;
    /** 时长单位（day/month/year） */
    unit: string;
}

/**
 * 卡密批次实体
 */
@AppEntity({ name: "card_batch", comment: "卡密批次" })
export class CardBatch extends BaseEntity {
    /**
     * 批次编号：年月日+随机4位数字
     */
    @Column({
        type: "varchar",
        length: 12,
        unique: true,
        comment: "批次编号",
    })
    @Index()
    batchNo: string;

    /**
     * 卡密名称
     */
    @Column({
        type: "varchar",
        length: 100,
        comment: "卡密名称",
    })
    name: string;

    /**
     * 兑换类型：1-订阅会员 2-积分余额
     */
    @Column({
        type: "enum",
        enum: CardRedeemType,
        comment: "兑换类型",
    })
    redeemType: CardRedeemType;

    /**
     * 会员等级ID（兑换类型为订阅会员时使用）
     */
    @Column({
        type: "uuid",
        name: "level_id",
        nullable: true,
        comment: "会员等级ID",
    })
    levelId: string | null;

    /**
     * 会员等级关联
     */
    @ManyToOne(() => MembershipLevels, { nullable: true })
    @JoinColumn({ name: "level_id" })
    level: MembershipLevels | null;

    /**
     * 会员时长配置：1-月度 2-季度 3-半年 4-年度 5-终身 6-自定义
     */
    @Column({
        type: "enum",
        enum: MembershipPlanDuration,
        nullable: true,
        comment: "会员时长配置",
    })
    membershipDuration: MembershipPlanDuration | null;

    /**
     * 自定义会员时长（当membershipDuration为6时使用）
     */
    @Column({
        type: "jsonb",
        nullable: true,
        comment: "自定义会员时长",
    })
    customDuration: Duration | null;

    /**
     * 积分数量（兑换类型为积分余额时使用）
     */
    @Column({
        type: "int",
        nullable: true,
        comment: "积分数量",
    })
    pointsAmount: number | null;

    /**
     * 到期时间
     */
    @Column({
        type: "timestamptz",
        comment: "到期时间",
    })
    expireAt: Date;

    /**
     * 生成数量
     */
    @Column({
        type: "int",
        comment: "生成数量",
    })
    totalCount: number;

    /**
     * 备注
     */
    @Column({
        type: "text",
        nullable: true,
        comment: "备注",
    })
    remark: string | null;

    /**
     * 关联的卡密列表
     */
    @OneToMany("CDK", "batch")
    cardKeys: CDK[];
}
