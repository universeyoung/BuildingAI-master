import { AppEntity } from "../decorators/app-entity.decorator";
import { Column, ManyToOne } from "../typeorm";
import { BaseEntity } from "./base";
import { CollaborationSpace } from "./collaboration-space.entity";

/**
 * 消息发送者类型枚举
 */
export enum MessageSenderType {
    /** 人类 */
    HUMAN = "human",
    /** AI */
    AI = "ai",
    /** 系统 */
    SYSTEM = "system",
}

/**
 * 消息内容类型枚举
 */
export enum MessageContentType {
    /** 文本 */
    TEXT = "text",
    /** 代码 */
    CODE = "code",
    /** 图片 */
    IMAGE = "image",
    /** 文件 */
    FILE = "file",
    /** 结构化数据 */
    STRUCTURED = "structured",
}

/**
 * 消息实体
 * 协作空间中的消息
 */
@AppEntity({ name: "message", comment: "消息" })
export class Message extends BaseEntity {
    /**
     * 空间ID
     */
    @Column({ type: "uuid", comment: "空间ID" })
    spaceId: string;

    /**
     * 频道ID
     */
    @Column({ type: "varchar", length: 100, nullable: true, comment: "频道ID" })
    channelId?: string | null;

    /**
     * 发送者类型
     */
    @Column({
        type: "enum",
        enum: MessageSenderType,
        default: MessageSenderType.AI,
        comment: "发送者类型",
    })
    senderType: MessageSenderType;

    /**
     * 发送者ID
     */
    @Column({ type: "uuid", nullable: true, comment: "发送者ID" })
    senderId?: string | null;

    /**
     * 内容类型
     */
    @Column({
        type: "enum",
        enum: MessageContentType,
        default: MessageContentType.TEXT,
        comment: "内容类型",
    })
    contentType: MessageContentType;

    /**
     * 内容
     */
    @Column({ type: "json", comment: "内容" })
    content: Record<string, unknown>;

    /**
     * 关联的协作空间
     */
    @ManyToOne(() => CollaborationSpace, space => space.messages)
    space: CollaborationSpace;
}
