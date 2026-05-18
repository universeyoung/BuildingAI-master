import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

/**
 * 阿里云短信配置 DTO
 */
export class UpdateAliyunSmsConfigDto {
    /** 短信签名 */
    @IsNotEmpty({ message: "短信签名不能为空" })
    @IsString({ message: "短信签名必须为字符串" })
    @MaxLength(64, { message: "短信签名长度不能超过64" })
    sign: string;

    /** 阿里云 AccessKeyId（前端字段名沿用 accessKeyId） */
    @IsNotEmpty({ message: "APP_KEY不能为空" })
    @IsString({ message: "APP_KEY必须为字符串" })
    @MaxLength(128, { message: "APP_KEY长度不能超过128" })
    accessKeyId: string;

    /** 阿里云 AccessKeySecret（前端字段名沿用 accessKeySecret） */
    @IsNotEmpty({ message: "SECRET_KEY不能为空" })
    @IsString({ message: "SECRET_KEY必须为字符串" })
    @MaxLength(128, { message: "SECRET_KEY长度不能超过128" })
    accessKeySecret: string;

    /** 阿里云默认模板编码 */
    @IsOptional()
    @IsString({ message: "默认模板编码必须为字符串" })
    @MaxLength(128, { message: "默认模板编码长度不能超过128" })
    templateCode?: string;

    /** 登录模板编码 */
    @IsOptional()
    @IsString({ message: "登录模板编码必须为字符串" })
    @MaxLength(128, { message: "登录模板编码长度不能超过128" })
    loginTemplateCode?: string;

    /** 注册模板编码 */
    @IsOptional()
    @IsString({ message: "注册模板编码必须为字符串" })
    @MaxLength(128, { message: "注册模板编码长度不能超过128" })
    registerTemplateCode?: string;

    /** 绑定手机号模板编码 */
    @IsOptional()
    @IsString({ message: "绑定手机号模板编码必须为字符串" })
    @MaxLength(128, { message: "绑定手机号模板编码长度不能超过128" })
    bindMobileTemplateCode?: string;

    /** 修改手机号模板编码 */
    @IsOptional()
    @IsString({ message: "修改手机号模板编码必须为字符串" })
    @MaxLength(128, { message: "修改手机号模板编码长度不能超过128" })
    changeMobileTemplateCode?: string;

    /** 找回密码模板编码 */
    @IsOptional()
    @IsString({ message: "找回密码模板编码必须为字符串" })
    @MaxLength(128, { message: "找回密码模板编码长度不能超过128" })
    findPasswordTemplateCode?: string;
}

/**
 * 腾讯云短信配置 DTO
 */
export class UpdateTencentSmsConfigDto {
    /** 短信签名 */
    @IsNotEmpty({ message: "短信签名不能为空" })
    @IsString({ message: "短信签名必须为字符串" })
    @MaxLength(64, { message: "短信签名长度不能超过64" })
    sign: string;

    /** 腾讯云 AppId */
    @IsNotEmpty({ message: "APP_ID不能为空" })
    @IsString({ message: "APP_ID必须为字符串" })
    @MaxLength(128, { message: "APP_ID长度不能超过128" })
    appId: string;

    /** 腾讯云 SecretId（前端字段名沿用 accessKeyId） */
    @IsNotEmpty({ message: "SECRET_ID不能为空" })
    @IsString({ message: "SECRET_ID必须为字符串" })
    @MaxLength(128, { message: "SECRET_ID长度不能超过128" })
    accessKeyId: string;

    /** 腾讯云 SecretKey（前端字段名沿用 accessKeySecret） */
    @IsNotEmpty({ message: "SECRET_KEY不能为空" })
    @IsString({ message: "SECRET_KEY必须为字符串" })
    @MaxLength(128, { message: "SECRET_KEY长度不能超过128" })
    accessKeySecret: string;
}

/**
 * 短信渠道启用状态 DTO
 */
export class UpdateSmsConfigStatusDto {
    /** 是否启用 */
    @IsOptional()
    @IsBoolean({ message: "enable必须为布尔值" })
    enable?: boolean;
}

/**
 * 更新单个通知场景短信模板配置 DTO
 */
export class UpdateSmsSceneTemplateDto {
    /** 是否启用短信通知 */
    @IsBoolean({ message: "enable必须为布尔值" })
    enable: boolean;

    /** 模板 ID */
    @IsNotEmpty({ message: "模板ID不能为空" })
    @IsString({ message: "模板ID必须为字符串" })
    @MaxLength(128, { message: "模板ID长度不能超过128" })
    templateId: string;

    /** 短信内容 */
    @IsNotEmpty({ message: "短信内容不能为空" })
    @IsString({ message: "短信内容必须为字符串" })
    @MaxLength(500, { message: "短信内容长度不能超过500" })
    content: string;
}
