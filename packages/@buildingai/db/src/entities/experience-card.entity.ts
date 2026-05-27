import { AppEntity } from "../decorators/app-entity.decorator";
import { Column } from "../typeorm";
import { BaseEntity } from "./base";

/**
 * 经验类别枚举
 */
export enum ExperienceCategory {
    /** 技术 */
    TECHNICAL = "technical",
    /** 流程 */
    PROCESS = "process",
    /** 沟通 */
    COMMUNICATION = "communication",
    /** 工具 */
    TOOL = "tool",
}

/**
 * 经验来源枚举
 */
export enum ExperienceSource {
    /** 任务 */
    TASK = "task",
    /** 团队 */
    TEAM = "team",
    /** 个人 */
    PERSONAL = "personal",
}

/**
 * 经验卡片实体
 * 存储从任务中提取的经验
 */
@AppEntity({ name: "experience_card", comment: "经验卡片" })
export class ExperienceCard extends BaseEntity {
    /**
     * 团队ID
     */
    @Column({ type: "uuid", comment: "团队ID" })
    teamId: string;

    /**
     * 任务ID
     */
    @Column({ type: "uuid", nullable: true, comment: "任务ID" })
    taskId?: string | null;

    /**
     * 标题
     */
    @Column({ type: "varchar", length: 200, comment: "标题" })
    title: string;

    /**
     * 内容
     */
    @Column({ type: "text", comment: "内容" })
    content: string;

    /**
     * 类别
     */
    @Column({
        type: "enum",
        enum: ExperienceCategory,
        default: ExperienceCategory.TECHNICAL,
        comment: "类别",
    })
    category: ExperienceCategory;

    /**
     * 来源
     */
    @Column({
        type: "enum",
        enum: ExperienceSource,
        default: ExperienceSource.TASK,
        comment: "来源",
    })
    source: ExperienceSource;

    /**
     * 标签
     */
    @Column({ type: "json", default: () => "'[]'", comment: "标签" })
    tags: string[];

    /**
     * 评分
     */
    @Column({ type: "int", nullable: true, comment: "评分" })
    rating?: number | null;

    /**
     * 使用次数
     */
    @Column({ type: "int", default: 0, comment: "使用次数" })
    usageCount: number;
}
