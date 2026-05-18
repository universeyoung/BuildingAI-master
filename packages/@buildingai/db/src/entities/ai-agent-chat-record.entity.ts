import { AppEntity } from "../decorators/app-entity.decorator";
import { Column, Index, JoinColumn, ManyToOne, OneToMany, type Relation } from "../typeorm";
import { Agent } from "./ai-agent.entity";
import { AgentChatMessage } from "./ai-agent-chat-message.entity";
import { BaseEntity } from "./base";
import { User } from "./user.entity";

@AppEntity({ name: "ai_agent_chat_record", comment: "智能体对话记录" })
@Index(["userId", "createdAt"])
@Index(["isDeleted", "createdAt"])
@Index(["agentId", "createdAt"])
export class AgentChatRecord extends BaseEntity {
    @Column({ type: "varchar", length: 200, comment: "对话标题", nullable: true })
    title: string;

    @Column({ type: "uuid", comment: "用户ID，匿名用户时为空", nullable: true })
    @Index()
    userId?: string;

    @Column({ type: "varchar", length: 128, comment: "匿名用户标识", nullable: true })
    @Index()
    anonymousIdentifier?: string;

    @Column({ type: "uuid", comment: "关联的智能体ID" })
    @Index()
    agentId: string;

    @Column({ type: "text", nullable: true, comment: "对话摘要" })
    summary?: string;

    @Column({ type: "int", default: 0, comment: "对话中的消息总数" })
    messageCount: number;

    @Column({ type: "int", default: 0, comment: "本次对话消耗的总Token数" })
    totalTokens: number;

    @Column({ type: "int", default: 0, comment: "本次对话累计消耗的积分" })
    consumedPower: number;

    @Column({ type: "jsonb", nullable: true, comment: "对话相关配置" })
    config?: Record<string, any>;

    @Column({ type: "boolean", default: false, comment: "是否已删除" })
    @Index()
    isDeleted: boolean;

    @Column({ type: "jsonb", nullable: true, comment: "扩展数据字段" })
    metadata?: Record<string, any>;

    @Column({ type: "jsonb", nullable: true, comment: "对话内点赞/踩汇总" })
    feedbackStatus?: { like: number; dislike: number };

    @ManyToOne(() => User, { onDelete: "CASCADE", nullable: true })
    @JoinColumn({ name: "user_id" })
    user?: User;

    @ManyToOne(() => Agent, { onDelete: "CASCADE" })
    @JoinColumn({ name: "agent_id" })
    agent: Agent;

    @OneToMany(() => AgentChatMessage, (message) => message.conversation, { cascade: true })
    messages?: Relation<AgentChatMessage[]>;
}
