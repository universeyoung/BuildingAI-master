import type { Duration } from "@buildingai/db/entities";
import { CardRedeemType, MembershipPlanDuration } from "@buildingai/db/entities";
import { Type } from "class-transformer";
import {
    IsDate,
    IsEnum,
    IsInt,
    IsObject,
    IsOptional,
    IsString,
    IsUUID,
    Min,
    ValidateIf,
} from "class-validator";

/**
 * 创建卡密批次DTO
 */
export class CreateCardBatchDto {
    /**
     * 卡密名称
     */
    @IsString({ message: "卡密名称必须是字符串" })
    name: string;

    /**
     * 兑换类型：1-订阅会员 2-积分余额
     */
    @IsEnum(CardRedeemType, { message: "兑换类型必须为 1-订阅会员 2-积分余额" })
    redeemType: CardRedeemType;

    /**
     * 会员等级ID（兑换类型为订阅会员时必填）
     */
    @ValidateIf((o) => o.redeemType === CardRedeemType.MEMBERSHIP)
    @IsUUID("4", { message: "会员等级ID必须是有效的UUID" })
    levelId?: string;

    /**
     * 会员时长配置：1-月度 2-季度 3-半年 4-年度 5-终身 6-自定义
     */
    @ValidateIf((o) => o.redeemType === CardRedeemType.MEMBERSHIP)
    @IsEnum(MembershipPlanDuration, { message: "会员时长配置必须为有效枚举值" })
    membershipDuration?: MembershipPlanDuration;

    /**
     * 自定义会员时长（当membershipDuration为6时必填）
     */
    @ValidateIf((o) => o.membershipDuration === MembershipPlanDuration.CUSTOM)
    @IsObject({ message: "自定义会员时长必须是对象" })
    customDuration?: Duration;

    /**
     * 积分数量（兑换类型为积分余额时必填）
     */
    @ValidateIf((o) => o.redeemType === CardRedeemType.POINTS)
    @IsInt({ message: "积分数量必须是整数" })
    @Min(1, { message: "积分数量必须大于0" })
    pointsAmount?: number;

    /**
     * 到期时间
     */
    @Type(() => Date)
    @IsDate({ message: "到期时间必须是有效日期" })
    expireAt: Date;

    /**
     * 生成数量
     */
    @IsInt({ message: "生成数量必须是整数" })
    @Min(1, { message: "生成数量必须大于0" })
    totalCount: number;

    /**
     * 备注
     */
    @IsString({ message: "备注必须是字符串" })
    @IsOptional()
    remark?: string;
}
