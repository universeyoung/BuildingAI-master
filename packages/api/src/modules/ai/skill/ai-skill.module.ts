import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AiSkill } from "@buildingai/db";
import { AiSkillService } from "./services/ai-skill.service";
import { AiSkillController } from "./controllers/ai-skill.controller";

@Module({
    imports: [TypeOrmModule.forFeature([AiSkill])],
    providers: [AiSkillService],
    controllers: [AiSkillController],
    exports: [AiSkillService],
})
export class AiSkillModule {}