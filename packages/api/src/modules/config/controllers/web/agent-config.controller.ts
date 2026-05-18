import { BaseController } from "@buildingai/base";
import { Public } from "@buildingai/decorators/public.decorator";
import { WebController } from "@common/decorators/controller.decorator";
import { Get } from "@nestjs/common";

import { AgentConfigService } from "../../services/agent-config.service";

@WebController("agent-config")
export class AgentConfigWebController extends BaseController {
    constructor(private readonly agentConfigService: AgentConfigService) {
        super();
    }

    @Get()
    @Public()
    async get() {
        return await this.agentConfigService.getConfig();
    }
}
