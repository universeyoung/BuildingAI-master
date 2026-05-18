import crypto from "node:crypto";

import { HttpErrorFactory } from "@buildingai/errors";
import { Injectable, Logger } from "@nestjs/common";

import {
    SendVerificationCodeOptions,
    SmsProvider,
    SmsSendResult,
} from "../interfaces/sms-provider.interface";

@Injectable()
export class AliyunSmsProvider implements SmsProvider {
    private readonly endpoint = "https://dysmsapi.aliyuncs.com/";

    private readonly logger = new Logger(AliyunSmsProvider.name);

    /**
     * 阿里云签名编码规则
     */
    private percentEncode(value: string): string {
        return encodeURIComponent(value)
            .replace(/\+/g, "%20")
            .replace(/\*/g, "%2A")
            .replace(/%7E/g, "~");
    }

    /**
     * 构建阿里云 RPC 请求签名
     */
    private buildSignature(params: Record<string, string>, accessKeySecret: string): string {
        const sortedKeys = Object.keys(params).sort();
        const canonicalizedQueryString = sortedKeys
            .map((key) => `${this.percentEncode(key)}=${this.percentEncode(params[key])}`)
            .join("&");

        const stringToSign = `POST&${this.percentEncode("/")}&${this.percentEncode(canonicalizedQueryString)}`;

        return Buffer.from(
            crypto.createHmac("sha1", `${accessKeySecret}&`).update(stringToSign).digest(),
        ).toString("base64");
    }

    /**
     * 生成 ISO8601 UTC 时间字符串
     */
    private getIsoTimestamp(): string {
        return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    }

    async sendVerificationCode(
        phone: string,
        phoneAreaCode: string,
        code: string,
        options: SendVerificationCodeOptions,
    ): Promise<SmsSendResult> {
        try {
            const { accessKeyId, accessKeySecret, signName, templateCode, templateParams } =
                options;

            if (!accessKeyId || !accessKeySecret || !signName || !templateCode) {
                throw HttpErrorFactory.badRequest("阿里云短信配置不完整，请先在控制台完成配置");
            }

            if (phoneAreaCode !== "86") {
                throw HttpErrorFactory.badRequest("当前仅支持中国大陆手机号短信发送");
            }

            const requestParams: Record<string, string> = {
                AccessKeyId: accessKeyId,
                Action: "SendSms",
                Format: "JSON",
                PhoneNumbers: phone,
                RegionId: "cn-hangzhou",
                SignName: signName,
                SignatureMethod: "HMAC-SHA1",
                SignatureNonce: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
                SignatureVersion: "1.0",
                TemplateCode: templateCode,
                TemplateParam: JSON.stringify(templateParams || { code }),
                Timestamp: this.getIsoTimestamp(),
                Version: "2017-05-25",
            };

            requestParams.Signature = this.buildSignature(requestParams, accessKeySecret);

            const body = new URLSearchParams(requestParams).toString();

            const response = await fetch(this.endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body,
            });

            if (!response.ok) {
                const raw = await response.text();
                this.logger.error(`阿里云短信请求失败: ${response.status} ${raw}`);
                throw HttpErrorFactory.internal("阿里云短信发送失败");
            }

            const result = (await response.json()) as {
                Code?: string;
                Message?: string;
                BizId?: string;
            };

            if (result.Code !== "OK") {
                this.logger.error(`阿里云短信发送失败: ${result.Code} ${result.Message}`);
                throw HttpErrorFactory.badRequest(result.Message || "阿里云短信发送失败");
            }

            return {
                success: true,
                message: result.Message || "验证码发送成功",
                bizId: result.BizId,
            };
        } catch (error) {
            this.logger.error(`SMS failed to send: ${error.message}`, error.stack);
            throw error;
        }
    }
}
