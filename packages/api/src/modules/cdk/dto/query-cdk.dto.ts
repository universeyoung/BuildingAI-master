import { CardKeyStatus } from "@buildingai/db/entities";
import { PaginationDto } from "@buildingai/dto/pagination.dto";
import { Transform, Type } from "class-transformer";
import { IsDate, IsEnum, IsOptional, IsString, IsUUID } from "class-validator";

/**
 * 查询卡密DTO
 */
export class QueryCDKDto extends PaginationDto {
    /**
     * 批次ID
     */
    @IsUUID("4", { message: "批次ID必须是有效的UUID" })
    @IsOptional()
    batchId?: string;

    /**
     * 卡密编号
     */
    @IsString({ message: "卡密编号必须是字符串" })
    @IsOptional()
    keyCode?: string;

    /**
     * 使用状态
     */
    @Transform(({ value }) => parseInt(value))
    @IsEnum(CardKeyStatus, { message: "使用状态必须为 0-未使用 1-已使用 2-已过期" })
    @IsOptional()
    status?: CardKeyStatus;

    /**
     * 用户ID
     */
    @IsUUID("4", { message: "用户ID必须是有效的UUID" })
    @IsOptional()
    userId?: string;

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
