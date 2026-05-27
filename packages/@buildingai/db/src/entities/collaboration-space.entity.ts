import { AppEntity } from "../decorators/app-entity.decorator";
import { Column, ManyToOne, OneToMany } from "../typeorm";
import { BaseEntity } from "./base";
import { Team } from "./team.entity";
import { Message } from "./message.entity";
import { SharedMemoryEntry } from "./shared-memory-entry.entity";

/**
 * 协作空间实体
 * 团队的协作空间，包含消息和共享记忆
 */
@AppEntity({ name: "collaboration_space", comment: "协作空间" })
export class CollaborationSpace extends BaseEntity {
    /**
     * 团队ID
     */
    @Column({ type: "uuid", comment: "团队ID" })
    teamId: string;

    /**
     * 名称
     */
    @Column({ type: "varchar", length: 200, comment: "名称" })
    name: string;

    /**
     * 配置
     */
    @Column({ type: "json", default: () => "'{}'", comment: "配置" })
    config: Record<string, unknown>;

    /**
     * 关联的团队
     */
    @ManyToOne(() => Team, team => team.spaces)
    team: Team;

    /**
     * 消息列表
     */
    @OneToMany(() => Message, message => message.space)
    messages: Message[];

    /**
     * 共享记忆列表
     */
    @OneToMany(() => SharedMemoryEntry, entry => entry.space)
    sharedMemory: SharedMemoryEntry[];
}
