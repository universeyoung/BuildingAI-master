import { BaseController } from "@buildingai/base";
import { StorageType } from "@buildingai/constants/shared/storage-config.constant";
import { HttpErrorFactory } from "@buildingai/errors";
import { UUIDValidationPipe } from "@buildingai/pipe/param-validate.pipe";
import { ConsoleController, Permissions } from "@common/decorators";
import { UpdateStorageConfigDto } from "@modules/system/dto/update-storage-config.dto";
import { Body, Get, Inject, Param, Patch } from "@nestjs/common";

import { StorageConfigService } from "../../services/storage-config.service";

@ConsoleController("system-storage-config", "存储配置")
export class StorageConfigController extends BaseController {
    @Inject(StorageConfigService)
    private storageService: StorageConfigService;

    @Get()
    @Permissions({ code: "list", name: "存储列表", description: "现在有的存储配置" })
    storageConfigList() {
        return this.storageService.getAllConfigs();
    }

    @Get(":id")
    @Permissions({ code: "detail", name: "存储详情", description: "当前存储的详细信息" })
    async getDetail(@Param("id", UUIDValidationPipe) id: string) {
        const storageConfig = await this.storageService.getStorageDetail(id);
        if (!storageConfig) {
            throw HttpErrorFactory.notFound("Storage config is not found");
        }
        if (storageConfig.storageType === StorageType.LOCAL) {
            const relativeLocalPath = "./storage/uploads";
            return {
                ...storageConfig,
                config: {
                    localStorage: relativeLocalPath,
                    domain: `${process.env.APP_DOMAIN ?? "http://localhost:4090"}/uploads`,
                },
            };
        }

        return storageConfig;
    }

    @Patch(":id")
    @Permissions({ code: "set", name: "设置存储配置", description: "修改存储配置" })
    async updateStorageConfig(
        @Param("id", UUIDValidationPipe) id: string,
        @Body() body: UpdateStorageConfigDto,
    ) {
        await this.storageService.updateConfig(id, body);
    }
}
