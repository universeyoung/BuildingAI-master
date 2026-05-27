import { AppEntity } from "../decorators/app-entity.decorator";
import { Column, ManyToOne } from "../typeorm";
import { BaseEntity } from "./base";
import { Subtask } from "./subtask.entity";

/**
 * 依赖类型枚举
 */
export enum DependencyType {
    /** 完成到开始 */
    FINISH_TO_START = "finish_to_start",
    /** 开始到开始 */
    START_TO_START = "start_to_start",
    /** 完成到完成 */
    FINISH_TO_FINISH = "finish_to_finish",
    /** 开始到完成 */
    START_TO_FINISH = "start_to_finish",
}

/**
 * 子任务依赖实体
 * 表示子任务之间的依赖关系
 */
@AppEntity({ name: "subtask_dependency", comment: "子任务依赖" })
export class SubtaskDependency extends BaseEntity {
    /**
     * 来源子任务ID
     */
    @Column({ type: "uuid", comment: "来源子任务ID" })
    fromSubtaskId: string;

    /**
     * 目标子任务ID
     */
    @Column({ type: "uuid", comment: "目标子任务ID" })
    toSubtaskId: string;

    /**
     * 依赖类型
     */
    @Column({
        type: "enum",
        enum: DependencyType,
        default: DependencyType.FINISH_TO_START,
        comment: "依赖类型",
    })
    type: DependencyType;

    /**
     * 条件
     */
    @Column({ type: "text", nullable: true, comment: "条件" })
    condition?: string | null;

    /**
     * 来源子任务
     */
    @ManyToOne(() => Subtask, subtask => subtask.dependencies)
    fromSubtask: Subtask;

    /**
     * 目标子任务
     */
    @ManyToOne(() => Subtask, subtask => subtask.dependents)
    toSubtask: Subtask;
}
