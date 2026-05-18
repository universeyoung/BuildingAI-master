import { DECORATOR_KEYS } from "@common/constants/decorators-key.constant";
import { SetMetadata } from "@nestjs/common";

import {
    type AgentPublicAccessEntry,
    agentPublicAccessRegistry,
} from "./agent-public-access.registry";

export interface AgentPublicAccessOptions {
    route: string;
    targetPath: string;
    method?: AgentPublicAccessEntry["httpMethod"];
}

export function AgentPublicAccess(options: AgentPublicAccessOptions): MethodDecorator {
    return (target: object, key: string | symbol, descriptor: PropertyDescriptor) => {
        const entry: AgentPublicAccessEntry = {
            aliasPath: options.route,
            targetPath: options.targetPath,
            httpMethod: options.method ?? "POST",
        };
        const exists = agentPublicAccessRegistry.some(
            (e) => e.aliasPath === entry.aliasPath && e.httpMethod === entry.httpMethod,
        );
        if (!exists) {
            agentPublicAccessRegistry.push(entry);
        }

        SetMetadata(DECORATOR_KEYS.AGENT_API_KEY_ENABLED, true)(target, key, descriptor);

        return descriptor;
    };
}

export function AgentApiKey(): MethodDecorator {
    return (target: object, key: string | symbol, descriptor: PropertyDescriptor) => {
        SetMetadata(DECORATOR_KEYS.AGENT_API_KEY_ENABLED, true)(target, key, descriptor);
        return descriptor;
    };
}
