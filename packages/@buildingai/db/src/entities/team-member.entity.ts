import { AppEntity } from "../decorators/app-entity.decorator";
import { Column, ManyToOne } from "../typeorm";
import { BaseEntity } from "./base";
import { Team } from "./team.entity";

/**
 * 团队成员实体
 * 表示团队中的成员（智能体）
 */
@AppEntity({ name: "team_member", comment: "团队成员" })
export class TeamMember extends BaseEntity {
    /**
     * 团队ID
     */
    @Column({ type: "uuid", comment: "团队ID" })
    teamId: string;

    /**
     * 智能体ID
     */
    @Column({ type: "uuid", comment: "智能体ID" })
    agentId: string;

    /**
     * 角色
     */
    @Column({ type: "varchar", length: 100, nullable: true, comment: "角色" })
    role?: string;

    /**
     * 是否激活
     */
    @Column({ type: "boolean", default: true, comment: "是否激活" })
    isActive: boolean;

    /**
     * 关联的团队
     */
    @ManyToOne(() => Team, team => team.members)
    team: Team;
}
