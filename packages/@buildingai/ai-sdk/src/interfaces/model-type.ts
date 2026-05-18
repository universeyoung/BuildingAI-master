export const MODEL_TYPES = {
    LLM: "llm",
    MODERATION: "moderation",
    RERANK: "rerank",
    SPEECH_TO_TEXT: "speech2text",
    TEXT_EMBEDDING: "text-embedding",
    TEXT_TO_IMAGE: "text-to-image",
    TTS: "tts",
} as const;

export type ModelType = (typeof MODEL_TYPES)[keyof typeof MODEL_TYPES];

export const MODEL_TYPE_DESCRIPTIONS: Record<
    ModelType,
    { name: string; nameEn: string; description: string }
> = {
    [MODEL_TYPES.LLM]: {
        name: "大语言模型",
        nameEn: "LLM",
        description: "文本生成、对话、推理等",
    },
    [MODEL_TYPES.MODERATION]: {
        name: "内容审核",
        nameEn: "MODERATION",
        description: "文本内容安全检测",
    },
    [MODEL_TYPES.RERANK]: {
        name: "重排序",
        nameEn: "RERANK",
        description: "文档相关性重排序",
    },
    [MODEL_TYPES.SPEECH_TO_TEXT]: {
        name: "语音识别",
        nameEn: "SPEECH_TO_TEXT",
        description: "语音转文本 (STT)",
    },
    [MODEL_TYPES.TEXT_EMBEDDING]: {
        name: "文本嵌入",
        nameEn: "TEXT_EMBEDDING",
        description: "文本向量化",
    },
    [MODEL_TYPES.TEXT_TO_IMAGE]: {
        name: "图像生成",
        nameEn: "TEXT_TO_IMAGE",
        description: "文本生成图像",
    },
    [MODEL_TYPES.TTS]: {
        name: "语音合成",
        nameEn: "TTS",
        description: "文本转语音 (TTS)",
    },
};

export function getAllModelTypes(): ModelType[] {
    return Object.values(MODEL_TYPES);
}

export function getModelTypesWithDescriptions(): Array<{
    type: ModelType;
    name: string;
    description: string;
}> {
    return getAllModelTypes().map((type) => ({
        type,
        ...MODEL_TYPE_DESCRIPTIONS[type],
    }));
}
