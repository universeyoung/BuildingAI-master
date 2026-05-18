import { type UserPlayground } from "@buildingai/db";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import { AiModel, AiProvider, SquarePublishStatus, User } from "@buildingai/db/entities";
import { In, Repository } from "@buildingai/db/typeorm";
import { BuildFileUrl } from "@buildingai/decorators";
import { Playground } from "@buildingai/decorators/playground.decorator";
import { ConsoleController } from "@common/decorators/controller.decorator";
import { Permissions } from "@common/decorators/permissions.decorator";
import { UserService } from "@modules/user/services/user.service";
import { Body, Delete, Get, Param, Post, Query } from "@nestjs/common";

import { ListConsoleAgentsDto } from "../../dto/list-console-agents.dto";
import { AgentDashboardQueryDto } from "../../dto/web/agent/agent-dashboard-query.dto";
import { RejectSquarePublishDto } from "../../dto/web/publish/square-publish.dto";
import {
    type AgentDashboardResult,
    AgentDashboardService,
} from "../../services/agent-dashboard.service";
import { AgentsService } from "../../services/agents.service";

@ConsoleController("agents", "智能体")
export class AgentsConsoleController {
    constructor(
        private readonly agentsService: AgentsService,
        private readonly agentDashboardService: AgentDashboardService,
        private readonly userService: UserService,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(AiModel)
        private readonly aiModelRepository: Repository<AiModel>,
        @InjectRepository(AiProvider)
        private readonly aiProviderRepository: Repository<AiProvider>,
    ) {}

    @Get()
    @BuildFileUrl(["**.avatar", "**.chatAvatar"])
    @Permissions({ code: "list", name: "智能体列表", description: "分页查询智能体列表" })
    async list(@Query() dto: ListConsoleAgentsDto) {
        const result = await this.agentsService.listForConsole(dto);

        // Collect all unique creator IDs
        const creatorIds = [...new Set(result.items.map((item) => item.createBy).filter(Boolean))];

        // Batch fetch user information
        const users =
            creatorIds.length > 0
                ? await this.userRepository.find({
                      where: { id: In(creatorIds) },
                      select: ["id", "username", "nickname"],
                  })
                : [];
        //获取模型信息
        const modelIds = [
            ...new Set(result.items.map((item) => item.modelConfig?.id).filter(Boolean)),
        ] as string[];
        const models =
            modelIds.length > 0
                ? await this.aiModelRepository.find({
                      where: { id: In(modelIds) },
                      select: ["id", "name", "providerId"],
                  })
                : [];
        const providers = await this.aiProviderRepository.find({
            select: ["id", "name", "provider", "iconUrl"],
        });

        // Create a map for quick lookup
        const userMap = new Map(users.map((user) => [user.id, user]));
        const modelMap = new Map(models.map((model) => [model.id, model]));
        const providerMap = new Map(providers.map((provider) => [provider.id, provider]));
        return {
            ...result,
            items: result.items.map((item) => {
                const user = item.createBy ? userMap.get(item.createBy) : null;
                const modelId = item.modelConfig?.id;
                const model = modelId ? modelMap.get(modelId) : null;
                return {
                    id: item.id,
                    name: item.name,
                    description: item.description ?? null,
                    avatar: item.avatar ?? null,
                    modelName: model?.name ?? null,
                    modelProvider: model?.providerId
                        ? (providerMap.get(model.providerId)?.provider ?? null)
                        : null,
                    iconUrl: model?.providerId ? providerMap.get(model.providerId)?.iconUrl : null,
                    rolePrompt: item.rolePrompt ?? null,
                    openingStatement: item.openingStatement ?? null,
                    openingQuestions: item.openingQuestions ?? [],
                    quickCommands: item.quickCommands ?? [],
                    creatorName: user ? user.nickname || user.username : "-",
                    publishedToSquare: item.publishedToSquare ?? false,
                    squarePublishStatus: item.squarePublishStatus ?? SquarePublishStatus.NONE,
                    squareRejectReason: item.squareRejectReason ?? null,
                    updatedAt: item.updatedAt,
                    publishedAt: item.publishedAt ?? null,
                    createMode: item.createMode ?? "manual",
                    userCount: item.userCount ?? 0,
                    tags: item.tags ?? [],
                };
            }),
        };
    }

    @Get(":id/dashboard")
    @Permissions({ code: "dashboard", name: "智能体数据", description: "查看智能体统计数据" })
    async dashboard(
        @Param("id") agentId: string,
        @Query() query: AgentDashboardQueryDto,
    ): Promise<AgentDashboardResult> {
        await this.agentsService.getAgentByIdOrThrow(agentId);
        return this.agentDashboardService.getDashboard(agentId, query.startTime, query.endTime);
    }

    @Post(":id/approve-square")
    @Permissions({ code: "review", name: "审核", description: "智能体广场发布审核" })
    async approveSquare(@Param("id") agentId: string, @Playground() user: UserPlayground) {
        return this.agentsService.approveSquarePublish(agentId, user.id);
    }

    @Post(":id/reject-square")
    @Permissions({ code: "review", name: "审核", description: "智能体广场发布审核" })
    async rejectSquare(
        @Param("id") agentId: string,
        @Body() dto: RejectSquarePublishDto,
        @Playground() user: UserPlayground,
    ) {
        return this.agentsService.rejectSquarePublish(agentId, user.id, dto.reason);
    }

    @Post(":id/publish-square")
    @Permissions({ code: "publish", name: "上架智能体", description: "管理员上架智能体到广场" })
    async publishSquare(@Param("id") agentId: string) {
        return this.agentsService.publishSquareByAdmin(agentId);
    }

    @Post(":id/unpublish-square")
    @Permissions({ code: "unpublish", name: "下架智能体", description: "管理员下架智能体广场展示" })
    async unpublishSquare(@Param("id") agentId: string) {
        return this.agentsService.unpublishSquareByAdmin(agentId);
    }

    @Delete(":id")
    @Permissions({ code: "delete", name: "删除智能体", description: "删除智能体" })
    async delete(@Param("id") agentId: string, @Playground() user: UserPlayground) {
        return this.agentsService.deleteAgent(agentId, user.id);
    }
}
