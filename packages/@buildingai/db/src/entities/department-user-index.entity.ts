import { AppEntity } from "../decorators/app-entity.decorator";
import { Column } from "../typeorm";
import { BaseEntity } from "./base";

@AppEntity({ name: "department_user_index", comment: "部门用户索引" })
export class DepartmentUserIndex extends BaseEntity {
    @Column({ type: "uuid", comment: "部门ID" })
    departmentId: string;

    @Column({ type: "uuid", comment: "userId" })
    userId: string;
}
