import type { AnnotationConfig } from "@buildingai/types/ai/agent-config.interface";
import { Injectable } from "@nestjs/common";

import { AgentAnnotationService } from "../services/agent-annotation.service";

@Injectable()
export class AnnotationReplyHandler {
    constructor(private readonly annotationService: AgentAnnotationService) {}

    async getAnnotationReply(
        agentId: string,
        query: string,
        config: AnnotationConfig | undefined,
    ): Promise<string | null> {
        if (!config?.enabled || !config?.vectorModelId?.trim() || !(query || "").trim()) {
            return null;
        }
        const hit = await this.annotationService.searchByQuery(agentId, query, {
            vectorModelId: config.vectorModelId,
            threshold: config.threshold,
        });
        if (hit) {
            await this.annotationService.incrementHitCount(agentId, hit.id);
            return hit.answer?.trim() ?? null;
        }
        return null;
    }
}
