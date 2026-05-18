import { IsNotEmpty, IsOptional, IsString, Length, Matches } from "class-validator";

/**
 * 发送绑定手机号验证码 DTO
 */
export class SendBindPhoneCodeDto {
    /** 手机号（不含区号） */
    @IsNotEmpty({ message: "手机号不能为空" })
    @IsString({ message: "手机号必须为字符串" })
    @Matches(/^1[3-9]\d{9}$/, { message: "请输入有效的手机号" })
    mobile: string;

    /** 区号，默认 86 */
    @IsOptional()
    @IsString({ message: "区号必须为字符串" })
    areaCode: string = "86";
}

/**
 * 绑定手机号 DTO
 */
export class BindPhoneDto extends SendBindPhoneCodeDto {
    /** 短信验证码 */
    @IsNotEmpty({ message: "验证码不能为空" })
    @IsString({ message: "验证码必须为字符串" })
    @Length(6, 6, { message: "验证码必须为6位" })
    code: string;
}
