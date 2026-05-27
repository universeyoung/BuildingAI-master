import { Get, Param, Query } from "@nestjs/common";
import { WebController } from "@common/decorators/controller.decorator";
import { SummaryLearningService } from "../services/summary-learning.service";
import { ExperienceCategory } from "@buildingai/db/entities";

@WebController("summary")
export class SummaryLearningController {
    constructor(private readonly summaryService: SummaryLearningService) {}

    @Get(":id")
    async getSummary(@Param("id") id: string) {
        return this.summaryService.generateSummary(id);
    }

    @Get(":id/ratings")
    async getMemberRatings(@Param("id") id: string) {
        return this.summaryService.rateMembers(id);
    }

    @Get(":teamId/experiences")
    async getExperiences(@Param("teamId") teamId: string, @Query("query") query: string, @Query("category") category?: ExperienceCategory) {
        return this.summaryService.searchExperiences(teamId, query, category);
    }
}
