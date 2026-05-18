import type { ChatUIMessage } from "@buildingai/types";
import type { AIRawResponse } from "@buildingai/types/ai/agent-config.interface";

import { AppEntity } from "../decorators/app-entity.decorator";
import { Column, Index, JoinColumn, ManyToOne, OneToMany, type Relation } from "../typeorm";
import { Agent } from "./ai-agent.entity";
import { AgentChatMessageFeedback } from "./ai-agent-chat-message-feedback.entity";
import { AgentChatRecord } from "./ai-agent-chat-record.entity";
import { BaseEntity } from "./base";
import { User } from "./user.entity";

/**
 * 智能体对话消息实体
 * 记录智能体对话中的每条消息，message 为 ChatUIMessage（含 role、parts、metadata、usage、userConsumedPower）
 */
@AppEntity({ name: "ai_agent_chat_message", comment: "智能体对话消息" })
@Index(["conversationId", "createdAt"])
export class AgentChatMessage extends BaseEntity {
    /**
     * 对话记录ID
     */
    @Column({
        type: "uuid",
        comment: "对话记录ID",
    })
    @Index()
    conversationId: string;

    /**
     * 智能体ID
     */
    @Column({
        type: "uuid",
        comment: "智能体ID",
    })
    @Index()
    agentId: string;

    /**
     * 父消息 ID
     * 用于消息重新生成时记录版本关系，多个 assistant 消息可共享同一 parentId（同一 user 消息的不同回复版本）
     */
    @Column({
        type: "uuid",
        comment: "父消息ID，用于重新生成版本管理",
        nullable: true,
    })
    @Index()
    parentId?: string;

    /**
     * 用户ID (注册用户时使用)
     */
    @Column({
        type: "uuid",
        comment: "用户ID，匿名用户时为空",
        nullable: true,
    })
    @Index()
    userId?: string;

    /**
     * 匿名用户标识 (匿名用户时使用)
     */
    @Column({
        type: "varchar",
        length: 128,
        comment: "匿名用户标识，如设备ID或访问令牌的hash",
        nullable: true,
    })
    @Index()
    anonymousIdentifier?: string;

    @Column({
        type: "jsonb",
        comment: "消息内容（ChatUIMessage：含 role、parts、metadata、usage、userConsumedPower）",
    })
    message: ChatUIMessage;

    @Column({
        type: "varchar",
        length: 20,
        default: "completed",
        comment: "消息状态: streaming-流式传输中, completed-已完成, failed-失败",
    })
    status: "streaming" | "completed" | "failed";

    /**
     * 原始AI响应
     */
    @Column({
        type: "jsonb",
        nullable: true,
        comment: "原始AI响应数据",
    })
    rawResponse?: AIRawResponse;

    /**
     * 表单变量
     */
    @Column({
        type: "jsonb",
        nullable: true,
        comment: "用于角色设定的表单变量",
    })
    formVariables?: Record<string, string>;

    /**
     * 表单字段输入值
     */
    @Column({
        type: "jsonb",
        nullable: true,
        comment: "表单字段输入值",
    })
    formFieldsInputs?: Record<string, any>;

    /**
     * 关联的用户 (注册用户时使用)
     */
    @ManyToOne(() => User, {
        onDelete: "CASCADE",
        nullable: true,
    })
    @JoinColumn({ name: "user_id" })
    user?: User;

    /**
     * 关联的智能体
     */
    @ManyToOne(() => Agent, {
        onDelete: "CASCADE",
    })
    @JoinColumn({ name: "agent_id" })
    agent: Agent;

    @ManyToOne(() => AgentChatRecord, "messages", {
        onDelete: "CASCADE",
    })
    @JoinColumn({ name: "conversation_id" })
    conversation: Relation<AgentChatRecord>;

    @OneToMany(() => AgentChatMessageFeedback, (f) => f.message)
    feedbacks?: Relation<AgentChatMessageFeedback[]>;
}
