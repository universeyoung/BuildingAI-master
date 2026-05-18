export interface AgentPublicAccessEntry {
    aliasPath: string;
    targetPath: string;
    httpMethod: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
}

export const agentPublicAccessRegistry: AgentPublicAccessEntry[] = [];
