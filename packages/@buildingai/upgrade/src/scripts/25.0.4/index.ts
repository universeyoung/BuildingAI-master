import { Menu, MenuSourceType, MenuType } from "@buildingai/db/entities";
import { Repository } from "@buildingai/db/typeorm";

import { BaseUpgradeScript, UpgradeContext } from "../../index";

/**
 * Upgrade script 25.0.4
 *
 * Add DIY design preview menu item.
 *
 * Menu hierarchy:
 * - diy-center (DIY Center)
 *   - diy-micropage (Micro Page) <- parent menu
 *     - diy-design (Design Page)
 *     - diy-design-view (Preview Page) <- new menu added in this version
 *     - diy-create (Create Button)
 *     - diy-edit (Edit Button)
 */
export class Upgrade extends BaseUpgradeScript {
    readonly version = "25.0.4";

    /**
     * Execute upgrade logic.
     *
     * @param context Upgrade context.
     */
    async execute(context: UpgradeContext): Promise<void> {
        this.log("Start upgrading to version 25.0.4");

        await this.updateSystemMenu(context);
    }

    async updateSystemMenu(context: UpgradeContext) {
        try {
            const { dataSource } = context;
            const menuRepository: Repository<Menu> = dataSource.getRepository(Menu);

            // Find parent menu diy-micropage (Micro Page menu)
            const parentMenu = await menuRepository.findOne({
                where: { code: "diy-micropage" },
            });

            if (!parentMenu) {
                this.log("Parent menu diy-micropage not found, skip adding menu");
                return;
            }

            // Check whether the menu already exists
            const existingMenu = await menuRepository.findOne({
                where: { code: "diy-design-view" },
            });

            if (existingMenu) {
                this.log("Menu diy-design-view already exists, skip adding");
                return;
            }

            // Create new menu item
            const newMenu = menuRepository.create({
                name: "console-common.check",
                code: "diy-design-view",
                path: "preview",
                icon: "",
                component: "/console/decorate/design/view",
                parentId: parentMenu.id,
                sort: 0,
                isHidden: 1,
                type: MenuType.MENU,
                sourceType: MenuSourceType.SYSTEM,
            } as Partial<Menu>);

            await menuRepository.save(newMenu);

            this.success("Menu diy-design-view added successfully");
        } catch (error) {
            this.error("Upgrade failed", error);
            throw error;
        }
    }
}

export default Upgrade;
