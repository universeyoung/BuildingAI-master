export interface SmsSendResult {
    success: boolean;
    message?: string;
    bizId?: string;
}

/**
 * 发送验证码所需的通道参数
 */
export interface SendVerificationCodeOptions {
    accessKeyId: string;
    accessKeySecret: string;
    signName: string;
    templateCode: string;
    templateParams?: Record<string, string>;
    appId?: string;
}

export interface SmsProvider {
    sendVerificationCode(
        phone: string,
        phoneAreaCode: string,
        code: string,
        options: SendVerificationCodeOptions,
    ): Promise<SmsSendResult>;
}
