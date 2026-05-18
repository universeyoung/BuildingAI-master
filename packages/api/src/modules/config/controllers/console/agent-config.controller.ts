import { BaseController } from "@buildingai/base";
import { ConsoleController } from "@common/decorators/controller.decorator";
import { Permissions } from "@common/decorators/permissions.decorator";
import { Body, Get, Post } from "@nestjs/common";

import { UpdateAgentConfigDto } from "../../dto/agent-config.dto";
import { AgentConfigService } from "../../services/agent-config.service";

/** 控制台智能体设置配置接口 */
@ConsoleController("agent-config", "智能体设置")
export class AgentConfigConsoleController extends BaseController {
    constructor(private readonly agentConfigService: AgentConfigService) {
        super();
    }

    /** 获取智能体设置 */
    @Get()
    @Permissions({ code: "get", name: "获取智能体设置", description: "获取智能体设置" })
    async get() {
        return await this.agentConfigService.getConfig();
    }

    /** 保存智能体设置 */
    @Post()
    @Permissions({ code: "set", name: "设置智能体设置", description: "设置智能体设置" })
    async set(@Body() dto: UpdateAgentConfigDto) {
        return await this.agentConfigService.setConfig(dto);
    }
}
