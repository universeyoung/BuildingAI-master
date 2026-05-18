import { AppEntity } from "../decorators/app-entity.decorator";
import { Column, Index, JoinColumn, ManyToOne } from "../typeorm";
import { Agent } from "./ai-agent.entity";
import { BaseEntity } from "./base";
import { User } from "./user.entity";

/**
 * 智能体专属记忆实体
 * 存储特定 Agent 与用户交互中产生的业务记忆
 */
@AppEntity({ name: "ai_agent_memory", comment: "智能体专属记忆" })
@Index(["userId", "agentId", "isActive", "createdAt"])
export class AgentMemory extends BaseEntity {
    @Column({ type: "uuid", comment: "用户ID" })
    @Index()
    userId: string;

    @Column({ type: "uuid", comment: "智能体ID" })
    @Index()
    agentId: string;

    @Column({ type: "text", comment: "记忆内容" })
    content: string;

    /**
     * business_context: 业务上下文
     * user_requirement: 用户需求
     * decision: 决策记录
     * fact: 事实信息
     */
    @Column({
        type: "varchar",
        length: 50,
        comment: "记忆分类",
    })
    category: string;

    @Column({
        type: "varchar",
        length: 255,
        nullable: true,
        comment: "来源会话ID",
    })
    source?: string;

    @Column({
        type: "jsonb",
        nullable: true,
        comment: "扩展元数据",
    })
    metadata?: Record<string, any>;

    @Column({
        type: "boolean",
        default: true,
        comment: "是否有效",
    })
    isActive: boolean;

    @ManyToOne(() => User, { onDelete: "CASCADE" })
    @JoinColumn({ name: "user_id" })
    user?: User;

    @ManyToOne(() => Agent, { onDelete: "CASCADE" })
    @JoinColumn({ name: "agent_id" })
    agent?: Agent;
}
