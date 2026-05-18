import { Column, CreateDateColumn, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

import { AppEntity } from "../decorators/app-entity.decorator";

@AppEntity({ name: "notice", comment: "通知管理" })
export class NoticeSetting {
    /**
     * 配置id
     */
    @PrimaryGeneratedColumn("uuid")
    id: string;

    /**
     * 场景编码
     */
    @Column({
        type: "varchar",
        length: 16,
        comment: "场景编码",
    })
    sceneCode: number;

    /**
     * 场景名称
     */
    @Column({
        type: "varchar",
        length: 32,
        comment: "场景名称",
    })
    sceneName: string;

    /**
     * 场景名称
     */
    @Column({
        type: "varchar",
        length: 128,
        comment: "场景描述",
        nullable: true,
    })
    sceneDesc: string;

    @Column({
        type: "integer",
        comment: "接收者 1-用户 2-平台",
        default: 1,
    })
    recipient: number;

    @Column({
        type: "integer",
        comment: "通知类型: 1-验证码 2-业务通知",
        default: 1,
    })
    noticeType: number;

    @Column({
        type: "jsonb",
        comment: "短信通知配置",
        nullable: true,
        default: () => "'{}'",
    })
    smsNotice: any;

    /**
     * 创建时间
     */
    @CreateDateColumn({ type: "timestamp with time zone" })
    createdAt: Date;

    /**
     * 更新时间
     */
    @UpdateDateColumn({ type: "timestamp with time zone" })
    updatedAt: Date;
}
