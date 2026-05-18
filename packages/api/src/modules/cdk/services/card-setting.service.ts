import { DictService } from "@buildingai/dict";
import { Injectable } from "@nestjs/common";

import { UpdateCardSettingDto } from "../dto/update-card-setting.dto";

/**
 * 卡密设置服务
 */
@Injectable()
export class CardSettingService {
    private readonly CARD_KEY_GROUP = "card_key";
    private readonly ENABLED_KEY = "card_key_enabled";
    private readonly NOTICE_KEY = "card_key_notice";

    constructor(private readonly dictService: DictService) {}

    /**
     * 获取卡密设置
     */
    async getSettings() {
        const enabled = await this.dictService.get(this.ENABLED_KEY, false, this.CARD_KEY_GROUP);
        const notice = await this.dictService.get(this.NOTICE_KEY, "", this.CARD_KEY_GROUP);

        return {
            enabled: enabled || false,
            notice: notice || "",
        };
    }

    /**
     * 更新卡密设置
     */
    async updateSettings(updateDto: UpdateCardSettingDto) {
        const { enabled, notice } = updateDto;

        if (enabled !== undefined) {
            await this.dictService.set(this.ENABLED_KEY, JSON.stringify(enabled), {
                group: this.CARD_KEY_GROUP,
                description: "卡密功能开关",
            });
        }

        if (notice !== undefined) {
            await this.dictService.set(this.NOTICE_KEY, notice, {
                group: this.CARD_KEY_GROUP,
                description: "卡密兑换须知",
            });
        }

        return this.getSettings();
    }
}
