import { type UserPlayground } from "@buildingai/db";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import { Agent, User } from "@buildingai/db/entities";
import { HttpErrorFactory } from "@buildingai/errors";
import { agentPublicAccessRegistry } from "@common/decorators/agent-public-access.registry";
import { Injectable, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { Repository } from "typeorm";

@Injectable()
export class AgentAliasRewriteMiddleware implements NestMiddleware {
    constructor(
        @InjectRepository(Agent)
        private readonly agentRepository: Repository<Agent>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
    ) {}

    async use(req: Request, _res: Response, next: NextFunction) {
        const entry = agentPublicAccessRegistry.find((e) => {
            if (req.method !== e.httpMethod) return false;
            const pattern = `^/v1/${e.aliasPath.replace(/:[^/]+/g, "[^/]+")}$`;
            return new RegExp(pattern).test(req.path);
        });

        if (!entry) {
            return next();
        }

        const token = this.extractBearerToken(req);
        if (!token) {
            throw HttpErrorFactory.unauthorized("API key or site access token is required");
        }

        const agent = await this.agentRepository
            .createQueryBuilder("agent")
            .where(
                `(
                    (agent.publish_config ->> 'apiKey' = :token AND agent.publish_config ->> 'enableApiKey' = 'true')
                    OR
                    (agent.publish_config ->> 'accessToken' = :token AND agent.publish_config ->> 'enableSite' = 'true')
                )`,
                { token },
            )
            .getOne();

        if (!agent) {
            throw HttpErrorFactory.unauthorized(
                "Invalid credential, or API key / site embedding access is not enabled",
            );
        }

        const user = await this.userRepository.findOne({ where: { id: agent.createBy } });
        if (!user) {
            throw HttpErrorFactory.unauthorized("Agent creator not found");
        }

        const playground: UserPlayground = {
            id: user.id,
            username: user.username,
            isRoot: user.isRoot,
            permissions: [],
            role: null,
        };

        req["user"] = playground;

        const webPrefix = process.env.VITE_APP_WEB_API_PREFIX?.replace(/^\/+/, "") ?? "api/web";

        const aliasParamNames = (entry.aliasPath.match(/:[^/]+/g) ?? []).map((p) => p.slice(1));
        const aliasPattern = `^/v1/${entry.aliasPath.replace(/:[^/]+/g, "([^/]+)")}$`;
        const matched = req.path.match(new RegExp(aliasPattern));

        let resolvedTarget = entry.targetPath.replace(":id", agent.id);
        aliasParamNames.forEach((name, i) => {
            resolvedTarget = resolvedTarget.replace(`:${name}`, matched?.[i + 1] ?? "");
        });

        const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
        req.url = `/${webPrefix}/ai-agents/${resolvedTarget}${qs}`;
        delete (req as any)._parsedUrl;

        return next();
    }

    private extractBearerToken(req: Request): string | undefined {
        const [type, token] = req.headers.authorization?.split(" ") ?? [];
        return type === "Bearer" ? token : undefined;
    }
}
