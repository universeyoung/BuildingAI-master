import { IsString } from "class-validator";

/**
 * 兑换卡密DTO
 */
export class RedeemCDKDto {
    /**
     * 卡密编号
     */
    @IsString({ message: "卡密编号必须是字符串" })
    keyCode: string;
}
