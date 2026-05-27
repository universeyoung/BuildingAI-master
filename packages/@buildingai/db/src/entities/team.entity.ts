import { AppEntity } from "../decorators/app-entity.decorator";
import { Column, OneToMany } from "../typeorm";
import { BaseEntity } from "./base";
import { TeamMember } from "./team-member.entity";
import { Task } from "./task.entity";
import { CollaborationSpace } from "./collaboration-space.entity";

/**
 * 团队领导类型枚举
 */
export enum LeadType {
    /** 人类领导 */
    HUMAN = "human",
    /** AI 领导 */
    AI = "ai",
    /** 双领导 */
    DUAL = "dual",
}

/**
 * 团队状态枚举
 */
export enum TeamStatus {
    /** 活跃 */
    ACTIVE = "active",
    /** 已归档 */
    ARCHIVED = "archived",
}

/**
 * 团队实体
 * 表示一个协作团队，包含多个智能体成员
 */
@AppEntity({ name: "team", comment: "团队管理" })
export class Team extends BaseEntity {
    /**
     * 团队名称
     */
    @Column({ type: "varchar", length: 100, comment: "团队名称" })
    name: string;

    /**
     * 团队描述
     */
    @Column({ type: "text", nullable: true, comment: "团队描述" })
    description?: string;

    /**
     * 领导类型
     */
    @Column({
        type: "enum",
        enum: LeadType,
        default: LeadType.HUMAN,
        comment: "领导类型",
    })
    leadType: LeadType;

    /**
     * 领导智能体ID
     */
    @Column({ type: "uuid", nullable: true, comment: "领导智能体ID" })
    leadAgentId?: string;

    /**
     * 团队状态
     */
    @Column({
        type: "enum",
        enum: TeamStatus,
        default: TeamStatus.ACTIVE,
        comment: "团队状态",
    })
    status: TeamStatus;

    /**
     * 协作配置
     */
    @Column({ type: "json", default: () => "'{}'", comment: "协作配置" })
    collaborationConfig: Record<string, boolean>;

    /**
     * 团队成员列表
     */
    @OneToMany(() => TeamMember, member => member.team)
    members: TeamMember[];

    /**
     * 团队任务列表
     */
    @OneToMany(() => Task, task => task.team)
    tasks: Task[];

    /**
     * 团队协作空间列表
     */
    @OneToMany(() => CollaborationSpace, space => space.team)
    spaces: CollaborationSpace[];
}
