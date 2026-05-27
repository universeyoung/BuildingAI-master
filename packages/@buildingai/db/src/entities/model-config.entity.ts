import { AppEntity } from "../decorators/app-entity.decorator";
import { Column } from "../typeorm";
import { BaseEntity } from "./base";

/**
 * 模型配置实体
 * 存储团队的模型配置
 */
@AppEntity({ name: "model_config", comment: "模型配置" })
export class ModelConfig extends BaseEntity {
    /**
     * 团队ID
     */
    @Column({ type: "uuid", comment: "团队ID" })
    teamId: string;

    /**
     * 模型名称
     */
    @Column({ type: "varchar", length: 100, comment: "模型名称" })
    model: string;

    /**
     * 提供商
     */
    @Column({ type: "varchar", length: 50, comment: "提供商" })
    provider: string;

    /**
     * API端点
     */
    @Column({ type: "varchar", length: 500, comment: "API端点" })
    apiEndpoint: string;

    /**
     * API密钥
     */
    @Column({ type: "varchar", length: 500, comment: "API密钥" })
    apiKey: string;

    /**
     * 配置
     */
    @Column({ type: "json", default: () => "'{}'", comment: "配置" })
    config: Record<string, unknown>;

    /**
     * 是否默认
     */
    @Column({ type: "boolean", default: false, comment: "是否默认" })
    isDefault: boolean;
}
