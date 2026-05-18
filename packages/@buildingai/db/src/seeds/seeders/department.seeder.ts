import { Department } from "../../entities/department.entity";
import { DataSource } from "../../typeorm";
import { BaseSeeder } from "./base.seeder";

/**
 * Department seeder
 *
 * Initializes default department data
 */
export class DepartmentSeeder extends BaseSeeder {
    readonly name = "DepartmentSeeder";
    readonly priority = 15;

    async run(dataSource: DataSource): Promise<void> {
        const departmentRepository = dataSource.getRepository(Department);

        try {
            const existingCount = await departmentRepository.count();

            if (existingCount > 0) {
                this.logInfo("Department data already exists, skipping initialization");
                return;
            }

            const rootDepartment = departmentRepository.create({
                name: "总公司",
                parentId: null,
                level: 1,
                system: 1,
            });

            await departmentRepository.save(rootDepartment);

            this.logSuccess("Default department initialized successfully");
        } catch (error) {
            this.logError(`Department initialization failed: ${error.message}`);
            throw error;
        }
    }
}
