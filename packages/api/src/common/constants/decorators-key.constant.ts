/**
 * 装饰器元数据键常量对象
 */
export const DECORATOR_KEYS = {
    /**
     * 用户类型元数据键
     */
    CLIENT_SOURCE_KEY: "decorator:client-source",

    /**
     * Playground信息元数据键
     */
    PLAYGROUND_INFO_KEY: "decorator:playground-info",

    /**
     * 前台控制器元数据键
     */
    WEB_CONTROLLER_KEY: "decorator:web-controller",

    /**
     * 后台控制器元数据键
     */
    CONSOLE_CONTROLLER_KEY: "decorator:console-controller",

    /**
     * 权限控制元数据键
     */
    PERMISSIONS_KEY: "decorator:router-permissions",

    /**
     * 公共控制器元数据键
     */
    IS_PUBLIC_KEY: "decorator:is-public-controller",

    /**
     * 插件后台控制器元数据键
     */
    EXTENSION_CONSOLE_CONTROLLER_KEY: "decorator:extension-console-controller",

    /**
     * 插件前台控制器元数据键
     */
    EXTENSION_WEB_CONTROLLER_KEY: "decorator:extension-web-controller",

    /**
     * 插件权限控制元数据键
     */
    EXTENSION_PERMISSIONS_KEY: "decorator:extension-permissions",

    /**
     * 跳过权限检查元数据键
     */
    IS_SKIP_PERMISSIONS_KEY: "decorator:is-skip-permissions",

    /**
     * 权限组别元数据键
     */
    PERMISSION_GROUP_KEY: "decorator:permission-group",

    /**
     * 插件包名key
     */
    EXTENSION_PACK_NAME_KEY: "decorator:extension-pack-name",

    /**
     * 会员专属功能元数据键
     */
    MEMBER_ONLY_KEY: "decorator:member-only",

    /**
     * 开放 API 控制器元数据键
     * 用于标记外部发布的 API 控制器，通过 apiKey 鉴权
     */
    OPENAPI_CONTROLLER_KEY: "decorator:openapi-controller",

    /**
     * 智能体 API Key 鉴权元数据键
     * 标记路由支持通过 publishConfig.apiKey（enableApiKey）或 publishConfig.accessToken（enableSite）鉴权，鉴权通过后以创建人身份执行
     */
    AGENT_API_KEY_ENABLED: "decorator:agent-api-key-enabled",
} as const;

/**
 * 装饰器元数据键类型
 */
export type DecoratorKeyType = (typeof DECORATOR_KEYS)[keyof typeof DECORATOR_KEYS];
