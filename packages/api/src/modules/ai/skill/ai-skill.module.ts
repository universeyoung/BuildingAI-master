import { Module } from "@nestjs/common";
import { AiSkillService } from "./services/ai-skill.service";
import { AiSkillToolService } from "./services/ai-skill-tool.service";
import { AiSkillController } from "./controllers/ai-skill.controller";

@Module({
    providers: [AiSkillService, AiSkillToolService],
    controllers: [AiSkillController],
    exports: [AiSkillService, AiSkillToolService],
})
export class AiSkillModule {}
