import { AppEntity } from "../decorators/app-entity.decorator";
import { Column, ManyToOne, OneToMany } from "../typeorm";
import { BaseEntity } from "./base";
import { Team } from "./team.entity";
import { Subtask } from "./subtask.entity";

/**
 * 任务状态枚举
 */
export enum TaskStatus {
    /** 已创建 */
    CREATED = "created",
    /** 规划中 */
    PLANNING = "planning",
    /** 就绪 */
    READY = "ready",
    /** 进行中 */
    IN_PROGRESS = "in_progress",
    /** 已暂停 */
    PAUSED = "paused",
    /** 已完成 */
    COMPLETED = "completed",
    /** 失败 */
    FAILED = "failed",
    /** 已取消 */
    CANCELLED = "cancelled",
}

/**
 * 任务实体
 * 表示团队中的一个任务
 */
@AppEntity({ name: "task", comment: "任务" })
export class Task extends BaseEntity {
    /**
     * 团队ID
     */
    @Column({ type: "uuid", comment: "团队ID" })
    teamId: string;

    /**
     * 任务名称
     */
    @Column({ type: "varchar", length: 200, comment: "任务名称" })
    name: string;

    /**
     * 任务描述
     */
    @Column({ type: "text", nullable: true, comment: "任务描述" })
    description?: string;

    /**
     * 任务状态
     */
    @Column({
        type: "enum",
        enum: TaskStatus,
        default: TaskStatus.CREATED,
        comment: "任务状态",
    })
    status: TaskStatus;

    /**
     * 协作模式
     */
    @Column({ type: "json", default: () => "'{}'", comment: "协作模式" })
    collaborationModes: Record<string, boolean>;

    /**
     * 创建者
     */
    @Column({ type: "varchar", length: 20, default: "human", comment: "创建者类型" })
    createdBy: string;

    /**
     * 开始时间
     */
    @Column({ type: "timestamptz", nullable: true, comment: "开始时间" })
    startedAt?: Date | null;

    /**
     * 完成时间
     */
    @Column({ type: "timestamptz", nullable: true, comment: "完成时间" })
    completedAt?: Date | null;

    /**
     * 关联的团队
     */
    @ManyToOne(() => Team, team => team.tasks)
    team: Team;

    /**
     * 子任务列表
     */
    @OneToMany(() => Subtask, subtask => subtask.task)
    subtasks: Subtask[];
}
