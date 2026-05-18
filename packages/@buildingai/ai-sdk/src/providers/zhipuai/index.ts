import type {
    EmbeddingModelV3,
    LanguageModelV3,
    RerankingModelV3,
    SpeechModelV3,
    TranscriptionModelV3,
} from "@ai-sdk/provider";
import { createZhipu, type ZhipuProvider as AISDKZhipuProvider } from "zhipu-ai-provider";

import type { AIProvider, BaseProviderSettings, ProviderModelInfo } from "../../types";
import { fetchProviderModels } from "../../utils/fetch-models";
import { createOpenAIRerankModel } from "../openai/rerank-model";
import { createZhipuSpeechModel } from "./speech-model";
import { createZhipuTranscriptionModel } from "./transcription-model";

export interface ZhipuAIProviderSettings extends BaseProviderSettings {}

class ZhipuAIProviderImpl implements AIProvider {
    readonly id = "zhipuai";
    readonly name = "智谱AI";

    private baseProvider: AISDKZhipuProvider;
    private settings: ZhipuAIProviderSettings;

    constructor(settings: ZhipuAIProviderSettings = {}) {
        this.settings = {
            ...settings,
            baseURL: settings.baseURL || "https://open.bigmodel.cn/api/paas/v4",
        };

        this.baseProvider = createZhipu({
            apiKey: this.settings.apiKey,
            baseURL: this.settings.baseURL,
            headers: this.settings.headers,
        });
    }

    languageModel(modelId: string): LanguageModelV3 {
        return this.baseProvider(modelId) as unknown as LanguageModelV3;
    }

    embeddingModel(modelId: string): EmbeddingModelV3 {
        return this.baseProvider.textEmbeddingModel(modelId) as unknown as EmbeddingModelV3;
    }

    rerank(modelId: string): RerankingModelV3 {
        return createOpenAIRerankModel(this.settings, modelId);
    }

    speech(modelId: string): SpeechModelV3 {
        return createZhipuSpeechModel(this.settings, modelId);
    }

    transcription(modelId: string): TranscriptionModelV3 {
        return createZhipuTranscriptionModel(this.settings, modelId);
    }

    async listModels(): Promise<ProviderModelInfo[]> {
        return fetchProviderModels(this.settings);
    }
}

export function zhipuai(settings: ZhipuAIProviderSettings = {}): AIProvider {
    return new ZhipuAIProviderImpl(settings);
}
