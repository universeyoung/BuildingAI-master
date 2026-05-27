import { AppEntity } from "../decorators/app-entity.decorator";
import { Column, ManyToOne, OneToMany } from "../typeorm";
import { BaseEntity } from "./base";
import { Task } from "./task.entity";
import { SubtaskDependency } from "./subtask-dependency.entity";

/**
 * 子任务状态枚举
 */
export enum SubtaskStatus {
    /** 待处理 */
    PENDING = "pending",
    /** 进行中 */
    IN_PROGRESS = "in_progress",
    /** 被阻塞 */
    BLOCKED = "blocked",
    /** 已完成 */
    COMPLETED = "completed",
    /** 失败 */
    FAILED = "failed",
    /** 已取消 */
    CANCELLED = "cancelled",
}

/**
 * 子任务优先级枚举
 */
export enum SubtaskPriority {
    /** 低 */
    LOW = "low",
    /** 中 */
    MEDIUM = "medium",
    /** 高 */
    HIGH = "high",
    /** 紧急 */
    URGENT = "urgent",
}

/**
 * 子任务实体
 * 表示任务的一个子步骤
 */
@AppEntity({ name: "subtask", comment: "子任务" })
export class Subtask extends BaseEntity {
    /**
     * 任务ID
     */
    @Column({ type: "uuid", comment: "任务ID" })
    taskId: string;

    /**
     * 子任务名称
     */
    @Column({ type: "varchar", length: 200, comment: "子任务名称" })
    name: string;

    /**
     * 子任务描述
     */
    @Column({ type: "text", nullable: true, comment: "子任务描述" })
    description?: string;

    /**
     * 输入
     */
    @Column({ type: "json", nullable: true, comment: "输入" })
    input?: Record<string, unknown>;

    /**
     * 输出
     */
    @Column({ type: "json", nullable: true, comment: "输出" })
    output?: Record<string, unknown>;

    /**
     * 优先级
     */
    @Column({
        type: "enum",
        enum: SubtaskPriority,
        default: SubtaskPriority.MEDIUM,
        comment: "优先级",
    })
    priority: SubtaskPriority;

    /**
     * 状态
     */
    @Column({
        type: "enum",
        enum: SubtaskStatus,
        default: SubtaskStatus.PENDING,
        comment: "状态",
    })
    status: SubtaskStatus;

    /**
     * 分配给
     */
    @Column({ type: "uuid", nullable: true, comment: "分配给" })
    assignedTo?: string | null;

    /**
     * 预计小时数
     */
    @Column({ type: "int", default: 1, comment: "预计小时数" })
    estimatedHours: number;

    /**
     * 实际小时数
     */
    @Column({ type: "int", nullable: true, comment: "实际小时数" })
    actualHours?: number | null;

    /**
     * 审核反馈
     */
    @Column({ type: "text", nullable: true, comment: "审核反馈" })
    reviewFeedback?: string | null;

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
     * 关联的任务
     */
    @ManyToOne(() => Task, task => task.subtasks)
    task: Task;

    /**
     * 依赖列表
     */
    @OneToMany(() => SubtaskDependency, dep => dep.fromSubtask)
    dependencies: SubtaskDependency[];

    /**
     * 被依赖列表
     */
    @OneToMany(() => SubtaskDependency, dep => dep.toSubtask)
    dependents: SubtaskDependency[];
}
