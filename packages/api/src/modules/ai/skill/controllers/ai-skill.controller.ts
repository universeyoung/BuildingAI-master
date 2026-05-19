import { Controller, Get, Query } from "@nestjs/common";
import { AiSkillService, type MatchedSkill, type Skill } from "../services/ai-skill.service";

@Controller("/api/ai/skill")
export class AiSkillController {
    constructor(private readonly skillService: AiSkillService) {}

    @Get()
    async getAllSkills(): Promise<Skill[]> {
        return this.skillService.getAllEnabledSkills();
    }

    @Get("/match")
    async matchSkills(
        @Query("prompt") prompt: string,
        @Query("filePath") filePath?: string,
        @Query("fileContent") fileContent?: string,
    ): Promise<MatchedSkill[]> {
        return this.skillService.matchSkills(prompt, { filePath, fileContent });
    }

    @Get("/reload")
    async reloadSkills(): Promise<{ success: boolean; message: string }> {
        await this.skillService.reloadSkills();
        return { success: true, message: "Skills reloaded successfully" };
    }

    @Get("/:name")
    async getSkill(@Query("name") name: string): Promise<Skill | null> {
        return this.skillService.getSkillByName(name);
    }

    @Get("/:name/reference/:referenceName")
    async getReference(
        @Query("name") name: string,
        @Query("referenceName") referenceName: string,
    ): Promise<string | null> {
        return this.skillService.getReferenceContent(name, referenceName);
    }
}
