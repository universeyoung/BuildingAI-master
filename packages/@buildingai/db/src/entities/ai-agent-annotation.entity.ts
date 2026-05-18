import { Exclude } from "class-transformer";

import { AppEntity } from "../decorators/app-entity.decorator";
import { Column, Index, JoinColumn, ManyToOne } from "../typeorm";
import { BaseEntity } from "./base";
import { User } from "./user.entity";

@AppEntity({ name: "ai_agent_annotation", comment: "智能体标注管理" })
export class AgentAnnotation extends BaseEntity {
    @Column({ type: "uuid", comment: "智能体ID" })
    @Index()
    agentId: string;

    @Column({ type: "text", comment: "提问内容" })
    @Index("idx_annotation_question", { synchronize: false })
    question: string;

    @Column({ type: "text", comment: "答案内容" })
    @Index("idx_annotation_answer", { synchronize: false })
    answer: string;

    @Column({ type: "int", default: 0, comment: "命中次数" })
    @Index("idx_annotation_hit_count")
    hitCount: number;

    @Exclude()
    @Column({ type: "float", array: true, nullable: true, comment: "问题向量" })
    embedding: number[] | null;

    @Column({
        type: "varchar",
        length: 100,
        nullable: true,
        comment: "向量化使用的模型ID",
    })
    embeddingModelId: string | null;

    @Column({ type: "boolean", default: true, comment: "是否启用" })
    enabled: boolean;

    @Column({
        type: "uuid",
        comment: "创建者ID，匿名用户时为空",
        nullable: true,
    })
    createdBy?: string;

    @Column({
        type: "varchar",
        length: 255,
        comment: "匿名用户标识，如设备ID或访问令牌的hash",
        nullable: true,
    })
    @Index("idx_annotation_anonymous_id")
    anonymousIdentifier?: string;

    @ManyToOne(() => User, { onDelete: "CASCADE", nullable: true })
    @JoinColumn({ name: "created_by" })
    user?: User;
}
