import { TypeOrmModule } from "@buildingai/db/@nestjs/typeorm";
import { Agent, AgentChatMessage, AiModel, Dict, Extension, User } from "@buildingai/db/entities";
import { DictService } from "@buildingai/dict";
import { ChatConfigService } from "@modules/ai/chat/services/chat-config.service";
import { AgentConfigConsoleController } from "@modules/config/controllers/console/agent-config.controller";
import { AgentDecorateConsoleController } from "@modules/config/controllers/console/agent-decorate.controller";
import { AppsDecorateConsoleController } from "@modules/config/controllers/console/apps-decorate.controller";
import { DatasetsConfigConsoleController } from "@modules/config/controllers/console/datasets-config.controller";
import { AgentConfigWebController } from "@modules/config/controllers/web/agent-config.controller";
import { AgentDecorateWebController } from "@modules/config/controllers/web/agent-decorate.controller";
import { AppsDecorateWebController } from "@modules/config/controllers/web/apps-decorate.controller";
import { ConfigWebController } from "@modules/config/controllers/web/config.controller";
import { AgentConfigService } from "@modules/config/services/agent-config.service";
import { AgentDecorateService } from "@modules/config/services/agent-decorate.service";
import { AppsDecorateService } from "@modules/config/services/apps-decorate.service";
import { DatasetsConfigService } from "@modules/config/services/datasets-config.service";
import { Module } from "@nestjs/common";

import { WebsiteService } from "../system/services/website.service";

/**
 * 前台配置模块
 *
 * 处理前台网站配置信息获取相关功能，含字典配置（含知识库配置 datasets_config）。
 */
@Module({
    imports: [
        // 注册字典实体
        TypeOrmModule.forFeature([Dict, Extension, Agent, User, AgentChatMessage, AiModel]),
    ],
    controllers: [
        ConfigWebController,
        AgentConfigConsoleController,
        AgentConfigWebController,
        AgentDecorateWebController,
        AgentDecorateConsoleController,
        AppsDecorateWebController,
        AppsDecorateConsoleController,
        DatasetsConfigConsoleController,
    ],
    providers: [
        WebsiteService,
        DictService,
        ChatConfigService,
        AgentConfigService,
        AgentDecorateService,
        AppsDecorateService,
        DatasetsConfigService,
    ],
    exports: [
        WebsiteService,
        ChatConfigService,
        AgentConfigService,
        AgentDecorateService,
        AppsDecorateService,
        DatasetsConfigService,
    ],
})
export class ConfigModule {}
