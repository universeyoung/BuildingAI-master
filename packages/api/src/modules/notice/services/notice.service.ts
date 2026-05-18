import { BaseService } from "@buildingai/base";
import {
    type AliyunSmsConfig as AliyunProviderConfig,
    SmsProvider,
    type SmsProviderType,
    SmsScene,
    type SmsSceneTemplateConfig,
    type SmsSceneType,
    type TencentSmsConfig as TencentProviderConfig,
} from "@buildingai/constants/shared/sms.constant";
import { NoticeSetting } from "@buildingai/db/entities";
import { SmsConfig } from "@buildingai/db/entities/sms-config.entity";
import { Repository } from "@buildingai/db/typeorm";
import { HttpErrorFactory } from "@buildingai/errors";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";

type AliyunSmsViewConfig = {
    sign: string;
    accessKeyId: string;
    accessKeySecret: string;
    templateCode?: string;
    loginTemplateCode?: string;
    registerTemplateCode?: string;
    bindMobileTemplateCode?: string;
    changeMobileTemplateCode?: string;
    findPasswordTemplateCode?: string;
    enable: boolean;
};

type TencentSmsViewConfig = {
    sign: string;
    appId: string;
    accessKeyId: string;
    accessKeySecret: string;
    templateCode?: string;
    enable: boolean;
};

type SmsViewConfig = AliyunSmsViewConfig | TencentSmsViewConfig;

type SmsSceneSettingView = {
    scene: SmsSceneType;
    sceneName: string;
    noticeType: "验证码";
    smsEnabled: boolean;
    smsTemplateId: string;
    smsContent: string;
    emailEnabled: boolean | null;
};

type SmsSceneMeta = {
    scene: SmsSceneType;
    sceneName: string;
    emailEnabled: boolean | null;
    defaultContent: string;
};

const SMS_SCENE_META_LIST: SmsSceneMeta[] = [
    {
        scene: SmsScene.LOGIN,
        sceneName: "登录/注册验证码",
        emailEnabled: true,
        defaultContent: "您正在登录，验证码为${code}，请勿泄露给他人，5分钟内有效。",
    },
    {
        scene: SmsScene.BIND_MOBILE,
        sceneName: "绑定手机验证码",
        emailEnabled: null,
        defaultContent: "您正在绑定手机号，验证码为${code}，请勿泄露给他人，5分钟内有效。",
    },
    {
        scene: SmsScene.CHANGE_MOBILE,
        sceneName: "变更手机验证码",
        emailEnabled: null,
        defaultContent: "您正在变更手机号，验证码为${code}，请勿泄露给他人，5分钟内有效。",
    },
    {
        scene: SmsScene.FIND_PASSWORD,
        sceneName: "找回登录密码验证码",
        emailEnabled: true,
        defaultContent: "您正在找回登录密码，验证码为${code}，请勿泄露给他人，5分钟内有效。",
    },
    // {
    //     scene: SmsScene.REGISTER,
    //     sceneName: "注册验证码",
    //     emailEnabled: true,
    //     defaultContent: "您正在注册账号，验证码为${code}，请勿泄露给他人，5分钟内有效。",
    // },
];

@Injectable()
export class NoticeService extends BaseService<NoticeSetting> {
    constructor(
        @InjectRepository(NoticeSetting)
        private readonly noticeSettingRepository: Repository<NoticeSetting>,
        @InjectRepository(SmsConfig)
        private readonly smsConfigRepository: Repository<SmsConfig>,
    ) {
        super(noticeSettingRepository);
    }

    /**
     * 获取通知设置应绑定的短信服务商配置：优先当前启用渠道，其次回退阿里云
     */
    private async getSceneTemplateProviderEntity(): Promise<SmsConfig | null> {
        const enabledConfig = await this.smsConfigRepository.findOne({
            where: { enable: true },
            order: { sort: "ASC", createdAt: "ASC" },
        });
        if (enabledConfig) {
            return enabledConfig;
        }

        return this.smsConfigRepository.findOne({
            where: { provider: SmsProvider.ALIYUN },
        });
    }

    /**
     * 按服务商构造空短信配置
     */
    private getEmptyProviderConfig(
        provider: SmsProviderType,
    ): AliyunProviderConfig | TencentProviderConfig {
        if (provider === SmsProvider.ALIYUN) {
            return {
                signName: "",
                appKey: "",
                secretKey: "",
                templateCode: "",
                loginTemplateCode: "",
                registerTemplateCode: "",
                bindMobileTemplateCode: "",
                changeMobileTemplateCode: "",
                findPasswordTemplateCode: "",
                sceneTemplates: {},
            };
        }

        return {
            signName: "",
            appId: "",
            secretId: "",
            secretKey: "",
            templateCode: "",
            sceneTemplates: {},
        };
    }

    private getSceneMeta(scene: SmsSceneType) {
        const meta = SMS_SCENE_META_LIST.find((item) => item.scene === scene);
        if (!meta) {
            return null;
        }
        return meta;
    }

    private getLegacyTemplateCode(config: AliyunProviderConfig, scene: SmsSceneType) {
        switch (scene) {
            case SmsScene.LOGIN:
                return config.loginTemplateCode;
            case SmsScene.REGISTER:
                return config.registerTemplateCode;
            case SmsScene.BIND_MOBILE:
                return config.bindMobileTemplateCode;
            case SmsScene.CHANGE_MOBILE:
                return config.changeMobileTemplateCode;
            case SmsScene.FIND_PASSWORD:
                return config.findPasswordTemplateCode;
            default:
                return "";
        }
    }

    private setLegacyTemplateCode(
        config: AliyunProviderConfig,
        scene: SmsSceneType,
        templateId: string,
    ) {
        switch (scene) {
            case SmsScene.LOGIN:
                config.loginTemplateCode = templateId;
                break;
            case SmsScene.REGISTER:
                config.registerTemplateCode = templateId;
                break;
            case SmsScene.BIND_MOBILE:
                config.bindMobileTemplateCode = templateId;
                break;
            case SmsScene.CHANGE_MOBILE:
                config.changeMobileTemplateCode = templateId;
                break;
            case SmsScene.FIND_PASSWORD:
                config.findPasswordTemplateCode = templateId;
                break;
            default:
                break;
        }
    }

    private mapSmsSceneSetting(
        meta: SmsSceneMeta,
        provider: SmsProviderType,
        providerConfig: AliyunProviderConfig | TencentProviderConfig,
    ): SmsSceneSettingView {
        const sceneTemplates =
            (providerConfig.sceneTemplates as Partial<
                Record<SmsSceneType, SmsSceneTemplateConfig>
            >) || {};
        const sceneTemplate = sceneTemplates[meta.scene];
        const legacyTemplate =
            provider === SmsProvider.ALIYUN
                ? this.getLegacyTemplateCode(providerConfig as AliyunProviderConfig, meta.scene) ||
                  ""
                : "";
        const smsTemplateId = sceneTemplate?.templateId || legacyTemplate;

        return {
            scene: meta.scene,
            sceneName: meta.sceneName,
            noticeType: "验证码",
            smsEnabled: sceneTemplate?.enable ?? Boolean(legacyTemplate),
            smsTemplateId,
            smsContent: sceneTemplate?.content || meta.defaultContent,
            emailEnabled: meta.emailEnabled,
        };
    }

    /**
     * 获取通知设置页短信场景配置列表
     */
    async getSmsSceneSettings(): Promise<SmsSceneSettingView[]> {
        const providerEntity = await this.getSceneTemplateProviderEntity();
        const provider = providerEntity?.provider || SmsProvider.ALIYUN;
        const providerConfig =
            (providerEntity?.providerConfig as
                | AliyunProviderConfig
                | TencentProviderConfig
                | null) || this.getEmptyProviderConfig(provider);

        return SMS_SCENE_META_LIST.map((meta) =>
            this.mapSmsSceneSetting(meta, provider, providerConfig),
        );
    }

    /**
     * 更新单个场景的短信模板配置
     */
    async updateSmsSceneSetting(
        scene: SmsSceneType,
        payload: {
            enable: boolean;
            templateId: string;
            content: string;
        },
    ): Promise<SmsSceneSettingView> {
        const meta = this.getSceneMeta(scene);
        if (!meta) {
            throw HttpErrorFactory.badRequest("不支持的短信通知场景");
        }

        let providerEntity = await this.getSceneTemplateProviderEntity();
        const provider = providerEntity?.provider || SmsProvider.ALIYUN;
        const providerConfig =
            (providerEntity?.providerConfig as
                | AliyunProviderConfig
                | TencentProviderConfig
                | null) || this.getEmptyProviderConfig(provider);

        const sceneTemplates =
            (providerConfig.sceneTemplates as Partial<
                Record<SmsSceneType, SmsSceneTemplateConfig>
            >) || {};

        sceneTemplates[scene] = {
            enable: payload.enable,
            templateId: payload.templateId,
            content: payload.content,
        };

        providerConfig.sceneTemplates = sceneTemplates;

        if (provider === SmsProvider.ALIYUN) {
            this.setLegacyTemplateCode(
                providerConfig as AliyunProviderConfig,
                scene,
                payload.templateId,
            );
        }

        if (!providerEntity) {
            providerEntity = this.smsConfigRepository.create({
                provider,
                enable: false,
                sort: 0,
                providerConfig,
            });
        } else {
            providerEntity.providerConfig = providerConfig;
        }

        await this.smsConfigRepository.save(providerEntity);

        return this.mapSmsSceneSetting(meta, provider, providerConfig);
    }

    private getDefaultConfig(provider: SmsProviderType): SmsViewConfig {
        if (provider === SmsProvider.ALIYUN) {
            return {
                sign: "",
                accessKeyId: "",
                accessKeySecret: "",
                templateCode: "",
                loginTemplateCode: "",
                registerTemplateCode: "",
                bindMobileTemplateCode: "",
                changeMobileTemplateCode: "",
                findPasswordTemplateCode: "",
                enable: false,
            };
        }

        return {
            sign: "",
            appId: "",
            accessKeyId: "",
            accessKeySecret: "",
            templateCode: "",
            enable: false,
        };
    }

    /**
     * 获取短信配置（从 Dict 配置表中读取）
     *
     * @param provider 短信服务商 aliyun | tencent
     */
    async getSmsConfig(provider: SmsProviderType): Promise<SmsViewConfig> {
        const config = await this.smsConfigRepository.findOne({
            where: { provider },
        });

        const fallback = this.getDefaultConfig(provider);

        if (!config || !config.providerConfig) {
            return fallback;
        }

        const enable = config.enable ?? false;
        const providerConfig = config.providerConfig as
            | AliyunProviderConfig
            | TencentProviderConfig;

        if (provider === SmsProvider.ALIYUN) {
            const aliyun = providerConfig as AliyunProviderConfig;
            return {
                sign: aliyun.signName ?? "",
                accessKeyId: aliyun.appKey ?? "",
                accessKeySecret: aliyun.secretKey ?? "",
                templateCode: aliyun.templateCode ?? "",
                loginTemplateCode: aliyun.loginTemplateCode ?? "",
                registerTemplateCode: aliyun.registerTemplateCode ?? "",
                bindMobileTemplateCode: aliyun.bindMobileTemplateCode ?? "",
                changeMobileTemplateCode: aliyun.changeMobileTemplateCode ?? "",
                findPasswordTemplateCode: aliyun.findPasswordTemplateCode ?? "",
                enable,
            };
        }

        const tencent = providerConfig as TencentProviderConfig;
        return {
            sign: tencent.signName ?? "",
            appId: tencent.appId ?? "",
            accessKeyId: tencent.secretId ?? "",
            accessKeySecret: tencent.secretKey ?? "",
            templateCode: tencent.templateCode ?? "",
            enable,
        };
    }

    /**
     * 更新短信服务商配置（不包含启用状态）
     *
     * @param provider 短信服务商 aliyun | tencent
     * @param payload 提交的配置内容
     */
    async updateSmsProviderConfig(
        provider: SmsProviderType,
        payload:
            | Omit<AliyunSmsViewConfig, "enable">
            | Pick<
                  TencentSmsViewConfig,
                  "sign" | "appId" | "accessKeyId" | "accessKeySecret" | "templateCode"
              >,
    ): Promise<SmsViewConfig> {
        const existedConfig = await this.smsConfigRepository.findOne({
            where: { provider },
        });
        let providerConfig: AliyunProviderConfig | TencentProviderConfig;

        if (provider === SmsProvider.ALIYUN) {
            const aliyunPayload = payload as Omit<AliyunSmsViewConfig, "enable">;
            const existedProviderConfig = (existedConfig?.providerConfig ||
                {}) as AliyunProviderConfig;
            providerConfig = {
                signName: aliyunPayload.sign ?? existedProviderConfig.signName ?? "",
                appKey: aliyunPayload.accessKeyId ?? existedProviderConfig.appKey ?? "",
                secretKey: aliyunPayload.accessKeySecret ?? existedProviderConfig.secretKey ?? "",
                templateCode:
                    aliyunPayload.templateCode ?? existedProviderConfig.templateCode ?? "",
                loginTemplateCode:
                    aliyunPayload.loginTemplateCode ??
                    existedProviderConfig.loginTemplateCode ??
                    "",
                registerTemplateCode:
                    aliyunPayload.registerTemplateCode ??
                    existedProviderConfig.registerTemplateCode ??
                    "",
                bindMobileTemplateCode:
                    aliyunPayload.bindMobileTemplateCode ??
                    existedProviderConfig.bindMobileTemplateCode ??
                    "",
                changeMobileTemplateCode:
                    aliyunPayload.changeMobileTemplateCode ??
                    existedProviderConfig.changeMobileTemplateCode ??
                    "",
                findPasswordTemplateCode:
                    aliyunPayload.findPasswordTemplateCode ??
                    existedProviderConfig.findPasswordTemplateCode ??
                    "",
                sceneTemplates: existedProviderConfig.sceneTemplates ?? {},
            };
        } else {
            const tencentPayload = payload as Pick<
                TencentSmsViewConfig,
                "sign" | "appId" | "accessKeyId" | "accessKeySecret" | "templateCode"
            >;
            const existedProviderConfig = (existedConfig?.providerConfig ||
                {}) as TencentProviderConfig;
            providerConfig = {
                signName: tencentPayload.sign ?? existedProviderConfig.signName ?? "",
                appId: tencentPayload.appId ?? existedProviderConfig.appId ?? "",
                secretId: tencentPayload.accessKeyId ?? existedProviderConfig.secretId ?? "",
                secretKey: tencentPayload.accessKeySecret ?? existedProviderConfig.secretKey ?? "",
                templateCode:
                    tencentPayload.templateCode ?? existedProviderConfig.templateCode ?? "",
                sceneTemplates: existedProviderConfig.sceneTemplates ?? {},
            };
        }

        let config = existedConfig;

        if (!config) {
            config = this.smsConfigRepository.create({
                provider,
                enable: false,
                sort: 0,
                providerConfig,
            });
        } else {
            config.providerConfig = providerConfig;
        }

        await this.smsConfigRepository.save(config);

        return this.getSmsConfig(provider);
    }

    /**
     * 更新短信渠道启用状态（互斥启用）
     *
     * @param provider 短信服务商 aliyun | tencent
     * @param enable 是否启用
     */
    async updateSmsProviderEnable(
        provider: SmsProviderType,
        enable: boolean,
    ): Promise<SmsViewConfig> {
        if (enable) {
            // 启用当前渠道时，自动禁用其它所有渠道
            await this.smsConfigRepository
                .createQueryBuilder()
                .update(SmsConfig)
                .set({ enable: false })
                .where("provider != :provider", { provider })
                .execute();
        }

        let config = await this.smsConfigRepository.findOne({
            where: { provider },
        });

        if (!config) {
            // 仅启用/禁用时，如果不存在记录也创建一条占位记录
            config = this.smsConfigRepository.create({
                provider,
                enable,
                sort: 0,
                providerConfig: null as any,
            });
        } else {
            config.enable = enable;
        }

        await this.smsConfigRepository.save(config);

        return this.getSmsConfig(provider);
    }
}
