import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import { Agent } from "@buildingai/db/entities";
import { Not, Repository } from "@buildingai/db/typeorm";
import { Injectable, Logger } from "@nestjs/common";

import { DifyApiService } from "./dify-api.service";

export interface DifyAgentSyncResult {
    agent: Agent;
    status: "skipped" | "success" | "failed";
    errorMessage?: string;
}

/**
 * Dify 智能体信息同步服务。
 */
@Injectable()
export class DifyAgentSyncService {
    private readonly logger = new Logger(DifyAgentSyncService.name);

    constructor(
        @InjectRepository(Agent)
        private readonly agentRepository: Repository<Agent>,
        private readonly difyApiService: DifyApiService,
    ) {}

    /**
     * Extract supported upload types from Dify file_upload parameters.
     * Falls back to `['file']` when capabilities cannot be determined.
     */
    private extractSupportedUploadTypes(fileUpload?: Record<string, any>): string[] {
        const types: string[] = ["file"];
        try {
            if (fileUpload) {
                const imageEnabled = fileUpload.image?.enabled ?? fileUpload.enabled;
                if (imageEnabled) types.push("image");
                if (fileUpload.audio?.enabled) types.push("audio");
                if (fileUpload.video?.enabled) types.push("video");
            }
        } catch {
            // Ignore parsing errors, keep default
        }
        return [...new Set(types)];
    }

    private async shouldSyncName(agent: Agent, name?: string): Promise<boolean> {
        const nextName = name?.trim();
        if (!nextName) return false;

        const existingAgent = await this.agentRepository.findOne({
            where: {
                createBy: agent.createBy,
                name: nextName,
                id: Not(agent.id),
            },
        });

        return !existingAgent;
    }

    /**
     * 规范化并写回 Dify 基础配置。
     */
    normalizeConfig(agent: Agent): Agent {
        const normalized = this.difyApiService.normalizeConfig(agent.thirdPartyIntegration);
        agent.thirdPartyIntegration = {
            ...normalized,
            extendedConfig: {
                ...(normalized.extendedConfig ?? {}),
                difySyncStatus: this.difyApiService.hasValidConfig(normalized)
                    ? "pending"
                    : "skipped",
            },
        };
        return agent;
    }

    /**
     * 同步 Dify 应用基础信息到本地 Agent。
     */
    async syncAgentInfo(agentId: string): Promise<DifyAgentSyncResult> {
        const agent = await this.agentRepository.findOne({ where: { id: agentId } });
        if (!agent || agent.createMode !== "dify") {
            return {
                agent: agent as Agent,
                status: "skipped",
            };
        }

        const normalized = this.difyApiService.normalizeConfig(agent.thirdPartyIntegration);
        if (!this.difyApiService.hasValidConfig(normalized)) {
            const nextIntegration = {
                ...normalized,
                extendedConfig: {
                    ...(normalized.extendedConfig ?? {}),
                    difySyncStatus: "skipped",
                    difySyncError: "Dify API Key 未配置完整，已跳过同步",
                },
            };
            await this.agentRepository.save({
                ...agent,
                thirdPartyIntegration: nextIntegration,
            });
            const latest = await this.agentRepository.findOne({ where: { id: agentId } });
            return {
                agent: latest as Agent,
                status: "skipped",
                errorMessage: "Dify API Key 未配置完整，已跳过同步",
            };
        }

        try {
            const [appInfo, appParams] = await Promise.all([
                this.difyApiService.getAppInfo(normalized),
                this.difyApiService.getAppParameters(normalized),
            ]);
            const shouldSyncName = await this.shouldSyncName(agent, appInfo.name);

            const supportedUploadTypes = this.extractSupportedUploadTypes(appParams.fileUpload);
            const nextIntegration = {
                ...normalized,
                extendedConfig: {
                    ...(normalized.extendedConfig ?? {}),
                    difyAppInfo: appInfo.raw,
                    difyAppParameters: appParams.raw,
                    difySyncStatus: "success",
                    difySyncError: undefined,
                    difySyncedAt: new Date().toISOString(),
                    supportedUploadTypes,
                },
            };

            const payload: Partial<Agent> = {
                thirdPartyIntegration: nextIntegration,
            };

            if (shouldSyncName) payload.name = appInfo.name;
            if (shouldSyncName) payload.description = appInfo.description;
            if (appParams.openingStatement) payload.openingStatement = appParams.openingStatement;
            if (appParams.suggestedQuestions && appParams.suggestedQuestions.length > 0) {
                payload.openingQuestions = appParams.suggestedQuestions;
            }

            await this.agentRepository.save({
                ...agent,
                ...payload,
            });
            const latest = await this.agentRepository.findOne({ where: { id: agentId } });
            return {
                agent: latest as Agent,
                status: "success",
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.warn(
                `Sync Dify app info failed: agentId=${agentId}, error=${errorMessage}`,
            );

            const nextIntegration = {
                ...normalized,
                extendedConfig: {
                    ...(normalized.extendedConfig ?? {}),
                    difySyncStatus: "failed",
                    difySyncError: errorMessage,
                    difySyncedAt: new Date().toISOString(),
                },
            };
            await this.agentRepository.save({
                ...agent,
                thirdPartyIntegration: nextIntegration,
            });
            const latest = await this.agentRepository.findOne({ where: { id: agentId } });
            return {
                agent: latest as Agent,
                status: "failed",
                errorMessage,
            };
        }
    }
}
