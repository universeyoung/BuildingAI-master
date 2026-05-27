import { AppEntity } from "../decorators/app-entity.decorator";
import { Column, ManyToOne } from "../typeorm";
import { BaseEntity } from "./base";
import { CollaborationSpace } from "./collaboration-space.entity";

/**
 * 共享记忆条目实体
 * 协作空间中的共享记忆
 */
@AppEntity({ name: "shared_memory_entry", comment: "共享记忆条目" })
export class SharedMemoryEntry extends BaseEntity {
    /**
     * 空间ID
     */
    @Column({ type: "uuid", comment: "空间ID" })
    spaceId: string;

    /**
     * 键
     */
    @Column({ type: "varchar", length: 200, comment: "键" })
    key: string;

    /**
     * 值
     */
    @Column({ type: "json", comment: "值" })
    value: Record<string, unknown>;

    /**
     * 版本
     */
    @Column({ type: "int", default: 1, comment: "版本" })
    version: number;

    /**
     * 创建者
     */
    @Column({ type: "uuid", comment: "创建者" })
    createdBy: string;

    /**
     * 关联的协作空间
     */
    @ManyToOne(() => CollaborationSpace, space => space.sharedMemory)
    space: CollaborationSpace;
}
