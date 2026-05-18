import crypto from "node:crypto";

import { RedisService } from "@buildingai/cache";
import {
    type AliyunSmsConfig,
    SmsProvider,
    type SmsSceneTemplateConfig,
    type SmsSceneType,
    type TencentSmsConfig,
} from "@buildingai/constants/shared/sms.constant";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import { SmsConfig } from "@buildingai/db/entities/sms-config.entity";
import { Repository } from "@buildingai/db/typeorm";
import { HttpErrorFactory } from "@buildingai/errors";
import { isDevelopment } from "@buildingai/utils";
import { Injectable, Logger } from "@nestjs/common";

import { SmsSendResult } from "../interfaces/sms-provider.interface";
import { AliyunSmsProvider } from "../providers/aliyun-sms.provider";
import { TencentSmsProvider } from "../providers/tencent-sms.provider";

@Injectable()
export class SmsService {
    private readonly CACHE_PREFIX = "sms";

    private readonly CODE_PREFIX_TIME = 5 * 60;
    private readonly CODE_RESEND_LIMIT = 60;
    private readonly CODE_LENGTH = 6;

    private readonly logger = new Logger(SmsService.name);

    constructor(
        private readonly redisService: RedisService,
        @InjectRepository(SmsConfig)
        private readonly smsConfigRepository: Repository<SmsConfig>,
        private readonly aliyunSmsProvider: AliyunSmsProvider,
        private readonly tencentSmsProvider: TencentSmsProvider,
    ) {}

    private generateCode(length: number) {
        let result = "";
        for (let i = 0; i < length; i++) {
            result += crypto.randomInt(0, 10);
        }
        return result;
    }

    private getCacheKey(phone: string, areaCode: string, scene: SmsSceneType) {
        return `${this.CACHE_PREFIX}:${scene}:${areaCode}-${phone}`;
    }

    private getRateLimitKey(phone: string, areaCode: string, scene: SmsSceneType) {
        const today = new Date().toISOString().split("T")[0];
        return `${this.CACHE_PREFIX}:limit:${areaCode}-${phone}:${today}`;
    }

    private async checkRateLimit(phone: string, areaCode: string, scene: SmsSceneType) {
        const key = this.getRateLimitKey(phone, areaCode, scene);
        const count = await this.redisService.incr(key);

        if (count === 1) {
            await this.redisService.expire(key, this.CODE_PREFIX_TIME);
        }

        const limit = 10;
        if (count > limit) {
            throw HttpErrorFactory.tooManyRequests();
        }
    }

    /**
     * 获取场景模板配置
     */
    private getSceneTemplate(
        scene: SmsSceneType,
        config: { sceneTemplates?: Partial<Record<SmsSceneType, SmsSceneTemplateConfig>> },
    ): SmsSceneTemplateConfig | undefined {
        const sceneTemplates =
            (config.sceneTemplates as Partial<Record<SmsSceneType, SmsSceneTemplateConfig>>) || {};
        return sceneTemplates[scene];
    }

    /**
     * 渲染场景短信内容
     */
    private renderSceneContent(
        sceneTemplate: SmsSceneTemplateConfig | undefined,
        code: string,
    ): string {
        if (!sceneTemplate?.content) {
            return code;
        }

        return sceneTemplate.content.replace(/\$\{code\}/g, code);
    }

    /**
     * 解析阿里云模板编码
     */
    private getAliyunTemplateCode(scene: SmsSceneType, providerConfig: AliyunSmsConfig): string {
        const sceneTemplate = this.getSceneTemplate(scene, providerConfig);
        if (sceneTemplate && sceneTemplate.enable === false) {
            throw HttpErrorFactory.badRequest("当前场景短信通知未开启");
        }

        const templateMap: Partial<Record<SmsSceneType, string | undefined>> = {
            1: sceneTemplate?.templateId || providerConfig.loginTemplateCode,
            2: sceneTemplate?.templateId || providerConfig.registerTemplateCode,
            3: sceneTemplate?.templateId || providerConfig.bindMobileTemplateCode,
            4: sceneTemplate?.templateId || providerConfig.changeMobileTemplateCode,
            5: sceneTemplate?.templateId || providerConfig.findPasswordTemplateCode,
        };

        const templateCode = templateMap[scene] || providerConfig.templateCode;
        if (!templateCode) {
            throw HttpErrorFactory.badRequest("阿里云短信模板未配置");
        }

        return templateCode;
    }

    /**
     * 解析腾讯云模板编码
     */
    private getTencentTemplateCode(scene: SmsSceneType, providerConfig: TencentSmsConfig): string {
        const sceneTemplate = this.getSceneTemplate(scene, providerConfig);
        if (sceneTemplate && sceneTemplate.enable === false) {
            throw HttpErrorFactory.badRequest("当前场景短信通知未开启");
        }

        const templateCode = sceneTemplate?.templateId || providerConfig.templateCode;
        if (!templateCode) {
            throw HttpErrorFactory.badRequest("腾讯云短信模板未配置");
        }

        return templateCode;
    }

    /**
     * 构建阿里云模板变量
     */
    private buildAliyunTemplateParams(
        sceneTemplate: SmsSceneTemplateConfig | undefined,
        code: string,
    ): Record<string, string> {
        const content = this.renderSceneContent(sceneTemplate, code);
        if (content.length > 20) {
            this.logger.warn("场景短信内容超过阿里云模板变量长度限制(20)，已降级仅传验证码变量");
            return { code };
        }

        return {
            code,
            content,
        };
    }

    async verifyCode(phone: string, areaCode: string, code: string, scene: SmsSceneType) {
        const key = this.getCacheKey(phone, areaCode, scene);
        const storedCode = await this.redisService.get<string>(key);

        if (!storedCode || storedCode !== code) {
            throw HttpErrorFactory.badRequest("The CAPTCHA has expired or does not exist");
        }

        await this.redisService.del(key);

        return true;
    }

    async clearCode(phone: string, areaCode: string, scene: SmsSceneType) {
        const key = this.getCacheKey(phone, areaCode, scene);
        await this.redisService.del(key);
    }

    async sendCode(phone: string, areaCode: string, scene: SmsSceneType): Promise<SmsSendResult> {
        try {
            await this.checkRateLimit(phone, areaCode, scene);
            const key = this.getCacheKey(phone, areaCode, scene);
            const ttl = await this.redisService.ttl(key);

            // 验证码有效期：5 分钟（300 秒）
            // 如果验证码还剩 4 分钟以上（240 秒），说明刚发送不久
            const threshold = this.CODE_PREFIX_TIME - this.CODE_RESEND_LIMIT;
            if (ttl > threshold) {
                throw HttpErrorFactory.tooManyRequests(`Please try again after ${ttl} seconds`);
            }

            const code = this.generateCode(this.CODE_LENGTH);

            if (!isDevelopment()) {
                await this.sendSmsViaProvider(phone, areaCode, code, scene);
            } else {
                await this.sendSmsViaProvider(phone, areaCode, code, scene);
                this.logger.warn(`[开发环境] 短信验证码 ${areaCode}-${phone}: ${code}`);
            }

            await this.redisService.set(key, code, this.CODE_PREFIX_TIME);

            return { success: true };
        } catch (error) {
            this.logger.error(`Failed to send code ${phone}, ${scene}`);
            throw error;
        }
    }

    /**
     * 通过已启用的云短信通道发送验证码
     */
    private async sendSmsViaProvider(
        phone: string,
        areaCode: string,
        code: string,
        scene: SmsSceneType,
    ): Promise<void> {
        const enabledProvider = await this.smsConfigRepository.findOne({
            where: { enable: true },
            order: { sort: "ASC", createdAt: "ASC" },
        });

        if (!enabledProvider) {
            throw HttpErrorFactory.badRequest("未启用短信服务商，请先在控制台配置");
        }

        if (enabledProvider.provider === SmsProvider.ALIYUN) {
            const providerConfig = enabledProvider.providerConfig as AliyunSmsConfig | null;
            if (!providerConfig) {
                throw HttpErrorFactory.badRequest("阿里云短信配置缺失，请先在控制台配置");
            }

            const sceneTemplate = this.getSceneTemplate(scene, providerConfig);
            const templateCode = this.getAliyunTemplateCode(scene, providerConfig);
            const templateParams = this.buildAliyunTemplateParams(sceneTemplate, code);
            const result = await this.aliyunSmsProvider.sendVerificationCode(
                phone,
                areaCode,
                code,
                {
                    accessKeyId: providerConfig.appKey,
                    accessKeySecret: providerConfig.secretKey,
                    signName: providerConfig.signName,
                    templateCode,
                    templateParams,
                },
            );

            if (!result.success) {
                throw HttpErrorFactory.internal(result.message || "验证码发送失败");
            }
            return;
        }

        if (enabledProvider.provider === SmsProvider.TENCENT) {
            const providerConfig = enabledProvider.providerConfig as TencentSmsConfig | null;
            if (!providerConfig) {
                throw HttpErrorFactory.badRequest("腾讯云短信配置缺失，请先在控制台配置");
            }
            const templateCode = this.getTencentTemplateCode(scene, providerConfig);
            const result = await this.tencentSmsProvider.sendVerificationCode(
                phone,
                areaCode,
                code,
                {
                    appId: providerConfig.appId,
                    accessKeyId: providerConfig.secretId,
                    accessKeySecret: providerConfig.secretKey,
                    signName: providerConfig.signName,
                    templateCode,
                    templateParams: { code },
                },
            );

            if (!result.success) {
                throw HttpErrorFactory.internal(result.message || "验证码发送失败");
            }
            return;
        }

        throw HttpErrorFactory.badRequest("暂不支持当前短信服务商");
    }
}
