import { Column, Index, JoinColumn, ManyToOne, Unique } from "typeorm";

import { AppEntity } from "../decorators/app-entity.decorator";
import { BaseEntity } from "./base";
import { MembershipLevels } from "./membership-levels.entity";
import { MembershipOrder } from "./membership-order.entity";
import { User } from "./user.entity";

/**
 * 用户订阅（会员状态聚合表）
 * @description 同一用户同一会员等级只允许一条记录，通过 (userId, levelId) 唯一约束保证。
 * 会员来源、变更历史等信息应查询 membership_order 表，本表仅存储聚合后的会员状态。
 */
@AppEntity({
    name: "user_subscription",
    comment: "用户订阅",
})
@Unique("UQ_user_subscription_user_level", ["userId", "levelId"])
export class UserSubscription extends BaseEntity {
    /**
     * 用户ID
     */
    @Column({
        comment: "用户ID",
    })
    @Index()
    userId: string;

    /**
     * 会员等级ID
     * @description 不允许为空，普通用户通过"无有效订阅记录"表达，不在本表存储
     */
    @Column({
        type: "uuid",
        comment: "会员等级ID",
    })
    levelId: string;

    /**
     * 最近一次影响该订阅的订单ID（弱关联，仅作参考）
     */
    @Column({ nullable: true })
    orderId: string | null;

    /**
     * 订阅开始时间（首次开通该等级的时间）
     */
    @Column({ type: "timestamptz", comment: "开始时间" })
    startTime: Date;

    /**
     * 订阅到期时间（聚合后的最终到期时间）
     */
    @Column({ type: "timestamptz", comment: "到期时间" })
    endTime: Date;

    @ManyToOne(() => MembershipOrder, (order) => order.subscriptions, { nullable: true })
    order: MembershipOrder;

    /**
     * 关联的用户
     */
    @ManyToOne(() => User, {
        onDelete: "CASCADE",
    })
    @JoinColumn({ name: "user_id" })
    user: User;

    /**
     * 关联的会员等级
     */
    @ManyToOne(() => MembershipLevels, { nullable: true })
    @JoinColumn({ name: "level_id" })
    level: MembershipLevels | null;
}
