import { AppEntity } from "../decorators/app-entity.decorator";
import { Column } from "../typeorm";
import { BaseEntity } from "./base";

@AppEntity({ name: "department_principal", comment: "部门负责人" })
export class DepartmentPrincipal extends BaseEntity {
    @Column({ type: "uuid", comment: "部门id" })
    departmentId: string;

    @Column({ type: "uuid", comment: "负责人id" })
    userId: string;
}
