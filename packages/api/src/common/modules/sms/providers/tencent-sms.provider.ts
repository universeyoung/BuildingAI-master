import crypto from "node:crypto";

import { HttpErrorFactory } from "@buildingai/errors";
import { Injectable, Logger } from "@nestjs/common";

import {
    SendVerificationCodeOptions,
    SmsProvider,
    SmsSendResult,
} from "../interfaces/sms-provider.interface";

/**
 * 腾讯云短信发送提供者（SMS 国际/国内统一接口）
 */
@Injectable()
export class TencentSmsProvider implements SmsProvider {
    private readonly endpoint = "https://sms.tencentcloudapi.com";

    private readonly host = "sms.tencentcloudapi.com";

    private readonly service = "sms";

    private readonly region = "ap-guangzhou";

    private readonly action = "SendSms";

    private readonly version = "2021-01-11";

    private readonly algorithm = "TC3-HMAC-SHA256";

    private readonly logger = new Logger(TencentSmsProvider.name);

    /**
     * TC3-HMAC-SHA256 签名中间 HMAC
     */
    private hmacSha256(key: Buffer | string, msg: string): Buffer {
        return crypto.createHmac("sha256", key).update(msg).digest();
    }

    /**
     * 生成腾讯云签名
     */
    private buildAuthorization(
        secretId: string,
        secretKey: string,
        timestamp: number,
        body: string,
    ): string {
        const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
        const hashedRequestPayload = crypto.createHash("sha256").update(body).digest("hex");

        const canonicalRequest = [
            "POST",
            "/",
            "",
            "content-type:application/json; charset=utf-8\nhost:sms.tencentcloudapi.com\nx-tc-action:sendsms\n",
            "content-type;host;x-tc-action",
            hashedRequestPayload,
        ].join("\n");

        const credentialScope = `${date}/${this.service}/tc3_request`;
        const hashedCanonicalRequest = crypto
            .createHash("sha256")
            .update(canonicalRequest)
            .digest("hex");
        const stringToSign = [
            this.algorithm,
            String(timestamp),
            credentialScope,
            hashedCanonicalRequest,
        ].join("\n");

        const secretDate = this.hmacSha256(`TC3${secretKey}`, date);
        const secretService = this.hmacSha256(secretDate, this.service);
        const secretSigning = this.hmacSha256(secretService, "tc3_request");
        const signature = crypto
            .createHmac("sha256", secretSigning)
            .update(stringToSign)
            .digest("hex");

        return `${this.algorithm} Credential=${secretId}/${credentialScope}, SignedHeaders=content-type;host;x-tc-action, Signature=${signature}`;
    }

    async sendVerificationCode(
        phone: string,
        phoneAreaCode: string,
        code: string,
        options: SendVerificationCodeOptions,
    ): Promise<SmsSendResult> {
        try {
            const { appId, accessKeyId, accessKeySecret, signName, templateCode, templateParams } =
                options;

            if (!appId || !accessKeyId || !accessKeySecret || !signName || !templateCode) {
                throw HttpErrorFactory.badRequest("腾讯云短信配置不完整，请先在控制台完成配置");
            }

            const templateParamCode = templateParams?.code || code;
            const phoneNumber = `+${phoneAreaCode}${phone}`;
            const requestBodyObject = {
                SmsSdkAppId: appId,
                SignName: signName,
                TemplateId: templateCode,
                TemplateParamSet: [templateParamCode],
                PhoneNumberSet: [phoneNumber],
            };
            const requestBody = JSON.stringify(requestBodyObject);

            const timestamp = Math.floor(Date.now() / 1000);
            const authorization = this.buildAuthorization(
                accessKeyId,
                accessKeySecret,
                timestamp,
                requestBody,
            );

            const response = await fetch(this.endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json; charset=utf-8",
                    Authorization: authorization,
                    "X-TC-Action": this.action,
                    "X-TC-Timestamp": String(timestamp),
                    "X-TC-Version": this.version,
                    "X-TC-Region": this.region,
                },
                body: requestBody,
            });

            const raw = await response.text();
            let parsed: any = null;
            try {
                parsed = JSON.parse(raw);
            } catch {
                parsed = null;
            }

            if (!response.ok) {
                this.logger.error(`腾讯云短信请求失败: ${response.status} ${raw}`);
                throw HttpErrorFactory.internal("腾讯云短信发送失败");
            }

            const apiError = parsed?.Response?.Error;
            if (apiError) {
                this.logger.error(`腾讯云短信发送失败: ${apiError.Code} ${apiError.Message}`);
                throw HttpErrorFactory.badRequest(apiError.Message || "腾讯云短信发送失败");
            }

            const sendStatus = parsed?.Response?.SendStatusSet?.[0];
            if (!sendStatus || sendStatus.Code !== "Ok") {
                const message = sendStatus?.Message || "腾讯云短信发送失败";
                this.logger.error(
                    `腾讯云短信发送失败: ${sendStatus?.Code || "Unknown"} ${message}`,
                );
                throw HttpErrorFactory.badRequest(message);
            }

            return {
                success: true,
                message: sendStatus.Message || "验证码发送成功",
                bizId: String(parsed?.Response?.RequestId || ""),
            };
        } catch (error) {
            this.logger.error(`SMS failed to send: ${error.message}`, error.stack);
            throw error;
        }
    }
}
