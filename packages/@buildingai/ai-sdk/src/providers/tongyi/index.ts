import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type {
    EmbeddingModelV3,
    LanguageModelV3,
    LanguageModelV3Middleware,
    RerankingModelV3,
    TranscriptionModelV3,
} from "@ai-sdk/provider";
import { wrapLanguageModel } from "ai";

import type { AIProvider, BaseProviderSettings, ProviderModelInfo } from "../../types";
import { fetchProviderModels } from "../../utils/fetch-models";
import {
    createTongyiSupportedUrls,
    transformTongyiCallOptionsForVideo,
    transformTongyiRequestBody,
} from "./message-transformer";
import { createTongYiRerankModel } from "./rerank-model";
import { createTongYiSpeechModel } from "./speech-model";
import { createTongYiTranscriptionModel } from "./transcription-model";

export interface TongYiProviderSettings extends BaseProviderSettings {
    speechBaseURL?: string;
}

const wrapTongyiLanguageModel = (baseModel: LanguageModelV3): LanguageModelV3 => {
    const middleware: LanguageModelV3Middleware = {
        specificationVersion: "v3",
        overrideSupportedUrls: () => createTongyiSupportedUrls(baseModel.supportedUrls),
        transformParams: async ({ params }) => transformTongyiCallOptionsForVideo(params),
    };

    return wrapLanguageModel({ model: baseModel, middleware });
};

class TongYiProviderImpl implements AIProvider {
    readonly id = "tongyi";
    readonly name = "通义千问";

    private baseProvider: ReturnType<typeof createOpenAICompatible>;
    private settings: TongYiProviderSettings;

    constructor(settings: TongYiProviderSettings = {}) {
        this.settings = settings;
        const baseURL = settings.baseURL || "https://dashscope.aliyuncs.com/compatible-mode/v1";

        this.baseProvider = createOpenAICompatible({
            name: "tongyi",
            baseURL,
            headers: {
                Authorization:
                    settings?.apiKey && settings?.apiKey.includes("Bearer ")
                        ? settings.apiKey
                        : `Bearer ${settings.apiKey}`,
                ...settings.headers,
            },
            transformRequestBody: transformTongyiRequestBody,
        });
    }

    languageModel(modelId: string): LanguageModelV3 {
        return wrapTongyiLanguageModel(this.baseProvider.languageModel(modelId));
    }

    embeddingModel(modelId: string): EmbeddingModelV3 {
        return this.baseProvider.embeddingModel(modelId);
    }

    rerank(modelId: string): RerankingModelV3 {
        return createTongYiRerankModel(this.settings, modelId);
    }

    speech(modelId: string) {
        return createTongYiSpeechModel(this.settings, modelId);
    }

    transcription(modelId: string): TranscriptionModelV3 {
        return createTongYiTranscriptionModel(this.settings, modelId);
    }

    async listModels(): Promise<ProviderModelInfo[]> {
        return fetchProviderModels({
            ...this.settings,
            baseURL: this.settings.baseURL || "https://dashscope.aliyuncs.com/compatible-mode/v1",
        });
    }
}

export function tongyi(settings: TongYiProviderSettings = {}): AIProvider {
    return new TongYiProviderImpl(settings);
}
