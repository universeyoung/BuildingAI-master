import { IsBoolean, IsOptional, IsString } from "class-validator";

/**
 * 更新卡密设置DTO
 */
export class UpdateCardSettingDto {
    /**
     * 是否启用卡密功能
     */
    @IsBoolean({ message: "启用状态必须是布尔值" })
    @IsOptional()
    enabled?: boolean;

    /**
     * 兑换须知
     */
    @IsString({ message: "兑换须知必须是字符串" })
    @IsOptional()
    notice?: string;
}
