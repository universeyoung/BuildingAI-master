export type ModelFeatureType =
    | "agent-thought"
    | "audio"
    | "document"
    | "multi-tool-call"
    | "stream-tool-call"
    | "structured-output"
    | "tool-call"
    | "video"
    | "vision";

export const MODEL_FEATURES: Record<string, ModelFeatureType> = {
    AGENT_THOUGHT: "agent-thought",
    AUDIO: "audio",
    DOCUMENT: "document",
    MULTI_TOOL_CALL: "multi-tool-call",
    STREAM_TOOL_CALL: "stream-tool-call",
    STRUCTURED_OUTPUT: "structured-output",
    TOOL_CALL: "tool-call",
    VIDEO: "video",
    VISION: "vision",
};

export const MODEL_FEATURE_DESCRIPTIONS: Record<
    ModelFeatureType,
    { name: string; label: string; description: string }
> = {
    "agent-thought": {
        name: "Agent 思考",
        label: "AGENT_THOUGHT",
        description: "支持 Agent 思考过程可见化",
    },
    audio: {
        name: "音频",
        label: "AUDIO",
        description: "支持音频输入/输出",
    },
    document: {
        name: "文档",
        label: "DOCUMENT",
        description: "支持文档解析和理解",
    },
    "multi-tool-call": {
        name: "多工具调用",
        label: "MULTI_TOOL_CALL",
        description: "支持同时调用多个工具",
    },
    "stream-tool-call": {
        name: "流式工具调用",
        label: "STREAM_TOOL_CALL",
        description: "支持流式返回工具调用结果",
    },
    "structured-output": {
        name: "结构化输出",
        label: "STRUCTURED_OUTPUT",
        description: "支持 JSON Schema 等结构化输出格式",
    },
    "tool-call": {
        name: "工具调用",
        label: "TOOL_CALL",
        description: "支持函数/工具调用",
    },
    video: {
        name: "视频",
        label: "VIDEO",
        description: "支持视频输入理解",
    },
    vision: {
        name: "视觉",
        label: "VISION",
        description: "支持图像输入理解",
    },
};

export function getAllModelFeatures(): ModelFeatureType[] {
    return Object.values(MODEL_FEATURES);
}

export function getModelFeaturesWithDescriptions(): Array<{
    type: ModelFeatureType;
    name: string;
    description: string;
}> {
    return getAllModelFeatures().map((type) => ({
        type,
        ...MODEL_FEATURE_DESCRIPTIONS[type],
    }));
}
