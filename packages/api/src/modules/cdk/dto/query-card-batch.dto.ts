import { CardRedeemType } from "@buildingai/db/entities";
import { PaginationDto } from "@buildingai/dto/pagination.dto";
import { Transform, Type } from "class-transformer";
import { IsDate, IsEnum, IsOptional, IsString } from "class-validator";

/**
 * 查询卡密批次DTO
 */
export class QueryCardBatchDto extends PaginationDto {
    /**
     * 批次编号
     */
    @IsString({ message: "批次编号必须是字符串" })
    @IsOptional()
    batchNo?: string;

    /**
     * 卡密名称
     */
    @IsString({ message: "卡密名称必须是字符串" })
    @IsOptional()
    name?: string;

    /**
     * 兑换类型
     */
    @Transform(({ value }) => parseInt(value))
    @IsEnum(CardRedeemType, { message: "兑换类型必须为 1-订阅会员 2-积分余额" })
    @IsOptional()
    redeemType?: CardRedeemType;

    /**
     * 开始时间
     */
    @Type(() => Date)
    @IsDate({ message: "开始时间必须是有效日期" })
    @IsOptional()
    startTime?: Date;

    /**
     * 结束时间
     */
    @Type(() => Date)
    @IsDate({ message: "结束时间必须是有效日期" })
    @IsOptional()
    endTime?: Date;
}
