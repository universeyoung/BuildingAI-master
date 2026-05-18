import { BaseService } from "@buildingai/base";
import { AppConfig } from "@buildingai/config/app.config";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import { Dict } from "@buildingai/db/entities";
import { Repository } from "@buildingai/db/typeorm";
import { DictService } from "@buildingai/dict";
import { Injectable } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";

import { UpdateWebsiteDto } from "../dto/update-website.dto";

@Injectable()
export class WebsiteService extends BaseService<Dict> {
    constructor(
        private readonly dictService: DictService,
        @InjectRepository(Dict) repository: Repository<Dict>,
    ) {
        super(repository);
    }

    /**
     * 获取网站配置
     * @returns 网站配置信息
     */
    async getConfig() {
        // 获取各组配置
        const webinfo = await this.getGroupConfig("webinfo", {
            name: "BuildingAI",
            description: "BuildingAI",
            icon: "",
            logo: "",
            customerServiceQrcode: "",
            version: "",
            isDemo: false,
            theme: "indigo",
        });
        const agreement = await this.getGroupConfig("agreement", {
            serviceTitle: "",
            serviceContent: "",
            privacyTitle: "",
            privacyContent: "",
            paymentTitle: "",
            paymentContent: "",
            updateAt: "",
        });
        const copyright = await this.getGroupConfig("copyright", [
            {
                displayName: "",
                iconUrl: "",
                url: "",
                copyrightText: "",
                copyrightBrand: "",
                copyrightUrl: "",
            },
        ]);
        const statistics = await this.getGroupConfig("statistics", {
            appid: "",
        });

        webinfo.version = AppConfig.version;
        webinfo.isDemo = process.env.SERVER_IS_DEMO_ENV === "true";
        return {
            webinfo,
            agreement,
            copyright,
            statistics,
        };
    }

    /**
     * 获取指定分组的配置
     * @param group 配置分组
     * @param defaultConfig 默认配置对象
     * @returns 配置对象
     */
    private async getGroupConfig<T = any>(group: string, defaultConfig: T): Promise<T> {
        try {
            const configs = await this.dictService.findAll({
                where: { group },
                order: { sort: "ASC" },
            });

            if (configs.length === 0) {
                return defaultConfig;
            }

            // 将配置转换为对象格式
            const result = {};
            for (const config of configs) {
                result[config.key] = this.parseValue(config.value);
            }

            // 合并默认配置和实际配置，确保返回完整的配置对象
            return { ...defaultConfig, ...result } as T;
        } catch (error) {
            this.logger.error(`获取分组 ${group} 的配置失败: ${error.message}`);
            return defaultConfig;
        }
    }

    /**
     * 将存储的字符串解析为适当的类型
     * @param value 存储的字符串值
     * @returns 解析后的值
     */
    private parseValue<T = any>(value: string): T {
        if (!value) {
            return null as unknown as T;
        }

        // 尝试解析为JSON
        try {
            // 判断是否可能是JSON
            if (
                (value.startsWith("{") && value.endsWith("}")) ||
                (value.startsWith("[") && value.endsWith("]")) ||
                value === "true" ||
                value === "false" ||
                value === "null" ||
                !isNaN(Number(value))
            ) {
                return JSON.parse(value) as T;
            }
        } catch {
            // 解析失败，忽略错误
        }

        // 如果不是JSON，返回原始字符串
        return value as unknown as T;
    }

    /**
     * 设置网站配置
     * @param updateWebsiteDto 更新网站配置DTO
     * @returns 更新结果
     */
    async setConfig(updateWebsiteDto: UpdateWebsiteDto) {
        const { webinfo, agreement, copyright, statistics } = updateWebsiteDto;

        // 只更新传递的配置组
        if (webinfo) {
            await this.updateGroupConfig("webinfo", webinfo);
        }
        if (agreement) {
            await this.updateGroupConfig("agreement", agreement);
        }
        if (copyright) {
            await this.updateGroupConfig("copyright", copyright);
        }
        if (statistics) {
            await this.updateGroupConfig("statistics", statistics);
        }

        return { success: true };
    }

    /**
     * 更新SPA加载模板中的图片源路径
     * @param targetDir 目标目录
     */
    private async updateSpaLoadingTemplate(targetDir: string): Promise<void> {
        try {
            const templatePath = path.join(targetDir, "index.html");

            // 检查模板文件是否存在
            if (!fs.existsSync(templatePath)) {
                this.logger.warn(`SPA加载模板文件不存在: ${templatePath}`);
                return;
            }

            // 读取模板文件内容
            const templateContent = await promisify(fs.readFile)(templatePath, "utf8");

            // 生成带时间戳的图片路径
            const timestamp = new Date().getTime();
            const imagePath = `/spa-loading.png?v=${timestamp}`;

            // 使用正则表达式替换img标签的src属性
            // 匹配 <img ... src="任意路径" ... /> 并替换为 src="/spa-loading.png?v=timestamp"
            const updatedContent = templateContent.replace(
                /(<img[^>]*\s+src=")[^"]*(")/gi,
                `$1${imagePath}$2`,
            );

            // 写回文件
            await promisify(fs.writeFile)(templatePath, updatedContent, "utf8");
            this.logger.debug(`成功更新SPA加载模板: ${templatePath}`);
        } catch (error) {
            this.logger.error(`更新SPA加载模板失败: ${error.message}`);
            // 这里不抛出错误，因为模板更新失败不应该影响主流程
        }
    }

    /**
     * File URL fields that need normalization for each config group
     */
    private readonly FILE_URL_FIELDS_MAP: Record<string, string[]> = {
        webinfo: ["icon", "logo"],
        copyright: ["**.iconUrl"],
    };

    private async updateGroupConfig(group: string, data: Record<string, any>) {
        if (!data) return;

        try {
            // 如果是协议配置，添加更新时间
            if (group === "agreement") {
                data.updateAt = new Date().toISOString();
            }

            // Get file URL fields for this group
            const fileUrlFields = this.FILE_URL_FIELDS_MAP[group];

            // 遍历对象的每个属性
            for (const [key, value] of Object.entries(data)) {
                // Check if this key needs file URL normalization
                const needsNormalization = fileUrlFields?.some(
                    (field) => field === key || field.startsWith("**."),
                );

                // 使用 dictService 的 set 方法更新或创建配置
                await this.dictService.set(key, value, {
                    group,
                    description: `网站${group}配置 - ${key}`,
                    sort: 0,
                    isEnabled: true,
                    ...(needsNormalization && {
                        normalizeFileUrlFields: fileUrlFields.includes(key)
                            ? ["**"]
                            : fileUrlFields,
                    }),
                });
            }
        } catch (error) {
            this.logger.error(`更新分组 ${group} 的配置失败: ${error.message}`);
            throw error; // 将错误向上抛出，便于控制器处理
        }
    }
}
