import { type UserPlayground } from "@buildingai/db";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import { Agent, User } from "@buildingai/db/entities";
import { HttpErrorFactory } from "@buildingai/errors";
import { getOverrideMetadata } from "@buildingai/utils";
import { DECORATOR_KEYS } from "@common/constants/decorators-key.constant";
import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { Repository } from "typeorm";

@Injectable()
export class AgentGuard implements CanActivate {
    constructor(
        private reflector: Reflector,
        @InjectRepository(Agent)
        private readonly agentRepository: Repository<Agent>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const isAgentApiKeyEnabled = getOverrideMetadata<boolean>(
            this.reflector,
            DECORATOR_KEYS.AGENT_API_KEY_ENABLED,
            context,
        );
        if (!isAgentApiKeyEnabled) {
            return true;
        }

        const request = context.switchToHttp().getRequest<Request>();
        if (request["user"]) {
            return true;
        }

        const apiKey = this.extractTokenFromHeader(request);
        if (!apiKey) {
            throw HttpErrorFactory.unauthorized("Invalid authentication token or API key");
        }

        const agentId = typeof request.params?.id === "string" ? request.params.id : undefined;
        const result = await this.resolveUserByPublishBearer(apiKey, agentId);
        if (!result) {
            throw HttpErrorFactory.unauthorized("Invalid authentication token or API key");
        }

        request["user"] = result.user;
        return true;
    }

    private async resolveUserByPublishBearer(
        token: string,
        agentId?: string,
    ): Promise<{ user: UserPlayground; agentId: string } | null> {
        const query = this.agentRepository.createQueryBuilder("agent").where(
            `(
                    (agent.publish_config ->> 'apiKey' = :token AND agent.publish_config ->> 'enableApiKey' = 'true')
                    OR
                    (agent.publish_config ->> 'accessToken' = :token AND agent.publish_config ->> 'enableSite' = 'true')
                )`,
            { token },
        );

        if (agentId) {
            query.andWhere("agent.id = :agentId", { agentId });
        }

        const agent = await query.getOne();
        if (!agent) return null;

        const user = await this.userRepository.findOne({ where: { id: agent.createBy } });
        if (!user) return null;

        return {
            agentId: agent.id,
            user: {
                id: user.id,
                username: user.username,
                isRoot: user.isRoot,
                permissions: [],
                role: null,
            },
        };
    }

    private extractTokenFromHeader(request: Request): string | undefined {
        const [type, token] = request.headers.authorization?.split(" ") ?? [];
        return type === "Bearer" ? token : undefined;
    }
}
