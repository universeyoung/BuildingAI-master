/**
 * MCP 通信传输方式
 */
export type McpCommunicationType = "sse" | "streamable-http" | "stdio";

/**
 * MCP 服务器配置接口
 */
export interface McpServerConfig {
    /**
     * 服务器 ID
     */
    id: string;
    /**
     * 服务器名称
     */
    name: string;
    /**
     * 服务器描述
     */
    description?: string;
    /**
     * 服务器 URL（SSE/HTTP） 或 命令（stdio）
     */
    url: string;
    /**
     * 通信传输方式
     */
    communicationType: McpCommunicationType;
    /**
     * 请求头
     */
    headers?: Record<string, string>;
    /**
     * 命令参数（仅 stdio 传输使用）
     */
    args?: string[];
    /**
     * 环境变量（仅 stdio 传输使用）
     */
    env?: Record<string, string>;
}

/**
 * MCP 客户端传输配置
 * 支持多种传输方式
 */
export type McpTransportConfig =
    | {
          type: "sse";
          url: string;
          headers?: Record<string, string>;
      }
    | {
          type: "http";
          url: string;
          headers?: Record<string, string>;
      }
    | {
          type: "stdio";
          command: string;
          args?: string[];
          env?: Record<string, string>;
      }
    | {
          type: "custom";
          transport: unknown; // 允许自定义传输，如 tuari 客户端
      };

/**
 * Raw MCP tool definition returned by listTools
 */
export interface McpToolInfo {
    name: string;
    description?: string;
    inputSchema?: Record<string, unknown>;
}

/**
 * MCP 客户端接口
 * 提供统一的客户端操作接口
 */
export interface McpClient {
    /**
     * 获取 AI SDK 格式的工具集合
     */
    tools(): Promise<Record<string, unknown>>;
    /**
     * 获取原始 MCP 工具定义列表
     */
    listTools(): Promise<McpToolInfo[]>;
    /**
     * 关闭客户端连接
     */
    close(): Promise<void>;
}

/**
 * MCP 客户端创建选项
 */
export interface CreateMcpClientOptions {
    /**
     * 传输配置
     */
    transport: McpTransportConfig;
    /**
     * 客户端名称（可选）
     */
    name?: string;
    /**
     * 客户端版本（可选）
     */
    version?: string;
}
