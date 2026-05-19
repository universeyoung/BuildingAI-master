import { AppEntity } from "../decorators/app-entity.decorator";
import { Column } from "../typeorm";
import { BaseEntity } from "./base";

/**
 * 技能实体
 * 
 * 存储从 SKILL.md 文件解析的技能元数据
 */
@AppEntity({ name: "ai_skill", comment: "技能管理" })
export class AiSkill extends BaseEntity {
    /**
     * 技能名称（唯一标识）
     */
    @Column({ length: 100, unique: true, comment: "技能名称" })
    name: string;

    /**
     * 技能描述
     */
    @Column({ type: "text", comment: "技能描述" })
    description: string;

    /**
     * 技能类型
     */
    @Column({ length: 50, comment: "技能类型" })
    type: string;

    /**
     * 触发关键词列表（JSON数组）
     */
    @Column({ type: "jsonb", nullable: true, comment: "触发关键词列表" })
    keywords?: string[];

    /**
     * 意图模式（正则表达式）
     */
    @Column({ type: "jsonb", nullable: true, comment: "意图模式" })
    intentPatterns?: string[];

    /**
     * 文件路径模式（glob）
     */
    @Column({ type: "jsonb", nullable: true, comment: "文件路径模式" })
    filePathPatterns?: string[];

    /**
     * 内容模式（正则表达式）
     */
    @Column({ type: "jsonb", nullable: true, comment: "内容模式" })
    contentPatterns?: string[];

    /**
     * 执行优先级
     */
    @Column({ length: 20, default: "medium", comment: "执行优先级" })
    priority: string;

    /**
     * 执行级别
     */
    @Column({ length: 20, default: "suggest", comment: "执行级别" })
    enforcement: string;

    /**
     * 技能内容（markdown）
     */
    @Column({ type: "text", nullable: true, comment: "技能内容" })
    content?: string;

    /**
     * 引用文件列表
     */
    @Column({ type: "jsonb", nullable: true, comment: "引用文件列表" })
    reference_list?: Array<{ name: string; path: string }>;

    /**
     * 是否启用
     */
    @Column({ type: "boolean", default: true, comment: "是否启用" })
    isEnabled: boolean;

    /**
     * 排序权重
     */
    @Column({ type: "int", default: 0, comment: "排序权重" })
    sortOrder: number;

    /**
     * 技能文件路径
     */
    @Column({ length: 500, nullable: true, comment: "技能文件路径" })
    filePath?: string;
}