import { experimental_createMCPClient as createMCPClient } from "@ai-sdk/mcp";
import { Experimental_StdioMCPTransport } from "@ai-sdk/mcp/mcp-stdio";

import type { CreateMcpClientOptions, McpClient, McpToolInfo } from "./types";

export async function createMcpClient(options: CreateMcpClientOptions): Promise<McpClient> {
    const { transport, name, version } = options;

    let mcpTransport: Parameters<typeof createMCPClient>[0]["transport"];

    switch (transport.type) {
        case "sse": {
            mcpTransport = {
                type: "sse" as const,
                url: transport.url,
                ...(transport.headers && { headers: transport.headers }),
            };
            break;
        }
        case "http": {
            mcpTransport = {
                type: "http" as const,
                url: transport.url,
                ...(transport.headers && { headers: transport.headers }),
            };
            break;
        }
        case "stdio": {
            mcpTransport = new Experimental_StdioMCPTransport({
                command: transport.command,
                args: transport.args,
                ...(transport.env && { env: transport.env }),
            });
            break;
        }
        case "custom": {
            mcpTransport = transport.transport as Parameters<
                typeof createMCPClient
            >[0]["transport"];
            break;
        }
        default: {
            const _exhaustive: never = transport;
            throw new Error(`Unsupported transport type: ${JSON.stringify(_exhaustive)}`);
        }
    }

    const client = await createMCPClient({
        transport: mcpTransport,
        ...(name && { name }),
        ...(version && { version }),
    });

    return {
        tools: async () => await client.tools(),
        listTools: async (): Promise<McpToolInfo[]> => {
            const result = await client.listTools();
            return result.tools.map((tool) => ({
                name: tool.name,
                description: tool.description,
                inputSchema: tool.inputSchema as Record<string, unknown> | undefined,
            }));
        },
        close: async () => await client.close(),
    };
}
