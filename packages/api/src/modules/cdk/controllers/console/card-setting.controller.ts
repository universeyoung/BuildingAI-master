import { BaseController } from "@buildingai/base";
import { ConsoleController } from "@common/decorators";
import { Permissions } from "@common/decorators/permissions.decorator";
import { Body, Get, Patch } from "@nestjs/common";

import { UpdateCardSettingDto } from "../../dto/update-card-setting.dto";
import { CardSettingService } from "../../services/card-setting.service";

/**
 * 卡密设置控制器
 */
@ConsoleController("card-setting", "卡密设置")
export class CardSettingController extends BaseController {
    constructor(private readonly cardSettingService: CardSettingService) {
        super();
    }

    /**
     * 获取卡密设置
     */
    @Get()
    @Permissions({
        code: "get",
        name: "获取卡密设置",
        description: "获取卡密设置",
    })
    async getSettings() {
        return this.cardSettingService.getSettings();
    }

    /**
     * 更新卡密设置
     */
    @Patch()
    @Permissions({
        code: "update",
        name: "更新卡密设置",
        description: "更新卡密设置",
    })
    async updateSettings(@Body() updateDto: UpdateCardSettingDto) {
        return this.cardSettingService.updateSettings(updateDto);
    }
}
