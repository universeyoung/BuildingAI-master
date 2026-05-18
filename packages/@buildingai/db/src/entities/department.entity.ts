import { AppEntity } from "../decorators/app-entity.decorator";
import { Column } from "../typeorm";
import { BaseEntity } from "./base";

@AppEntity({ name: "department", comment: "部门" })
export class Department extends BaseEntity {
    @Column({ comment: "部门名称" })
    name: string;

    @Column({ type: "uuid", comment: "父部门ID", nullable: true })
    parentId: string;

    @Column({ type: "integer", comment: "部门层级", default: 1 })
    level: number;

    @Column({ type: "integer", comment: "是否系统部门", default: 0 })
    system: number;
}
