import { AppEntity } from "../decorators/app-entity.decorator";
import { Column } from "../typeorm";
import { BaseEntity } from "./base";

/**
 * 智能体状态枚举
 */
export enum AgentStatus {
    /** 可用 */
    AVAILABLE = "available",
    /** 忙碌 */
    BUSY = "busy",
    /** 不可用 */
    UNAVAILABLE = "unavailable",
    /** 错误 */
    ERROR = "error",
}

/**
 * 本地智能体实体
 * 存储本地智能体信息
 */
@AppEntity({ name: "local_agent", comment: "本地智能体" })
export class LocalAgent extends BaseEntity {
    /**
     * 智能体名称
     */
    @Column({ type: "varchar", length: 100, comment: "智能体名称" })
    name: string;

    /**
     * 版本
     */
    @Column({ type: "varchar", length: 20, comment: "版本" })
    version: string;

    /**
     * 描述
     */
    @Column({ type: "text", nullable: true, comment: "描述" })
    description?: string;

    /**
     * 源路径
     */
    @Column({ type: "varchar", length: 500, comment: "源路径" })
    sourcePath: string;

    /**
     * 技能
     */
    @Column({ type: "json", default: () => "'[]'", comment: "技能" })
    skills: Array<{ name: string; description: string; tags: string[] }>;

    /**
     * 工具
     */
    @Column({ type: "json", default: () => "'[]'", comment: "工具" })
    tools: Array<{ name: string; type: string; path: string }>;

    /**
     * 输入模式
     */
    @Column({ type: "json", nullable: true, comment: "输入模式" })
    inputSchema?: Record<string, unknown>;

    /**
     * 输出模式
     */
    @Column({ type: "json", nullable: true, comment: "输出模式" })
    outputSchema?: Record<string, unknown>;

    /**
     * 状态
     */
    @Column({
        type: "enum",
        enum: AgentStatus,
        default: AgentStatus.AVAILABLE,
        comment: "状态",
    })
    status: AgentStatus;

    /**
     * 最大并发数
     */
    @Column({ type: "int", default: 3, comment: "最大并发数" })
    maxConcurrent: number;

    /**
     * 统计信息
     */
    @Column({ type: "json", default: () => "'{}'", comment: "统计信息" })
    stats: Record<string, unknown>;
}
