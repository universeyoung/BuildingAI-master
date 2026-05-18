import { Dict } from "../../entities/dict.entity";
import { DataSource } from "../../typeorm";
import { BaseSeeder } from "./base.seeder";

const DICT_GROUP = "decorate";
const DICT_KEY = "menu-config";

/**
 * Page configuration seeder
 *
 * Initializes the frontend home page menu configuration
 */
export class PageSeeder extends BaseSeeder {
    readonly name = "PageSeeder";
    readonly priority = 40;

    async run(dataSource: DataSource): Promise<void> {
        const dictRepository = dataSource.getRepository(Dict);

        try {
            // Check whether the menu configuration already exists
            const existing = await dictRepository.findOne({
                where: { key: DICT_KEY, group: DICT_GROUP },
            });

            if (existing) {
                this.logInfo("Menu configuration already exists, skipping initialization");
                return;
            }

            // Load menu configuration from file
            const menuConfig = await this.loadConfig("web-menu.json");

            const config = dictRepository.create({
                key: DICT_KEY,
                value: JSON.stringify(menuConfig),
                group: DICT_GROUP,
                description: "前台菜单配置",
                isEnabled: true,
                sort: 0,
            });

            await dictRepository.save(config);

            this.logSuccess("Menu configuration initialized successfully");
        } catch (error) {
            this.logError(`Menu configuration initialization failed: ${error.message}`);
            throw error;
        }
    }
}
