import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { EmbeddingModelV3, LanguageModelV3, RerankingModelV3 } from "@ai-sdk/provider";

import type { AIProvider, BaseProviderSettings, ProviderModelInfo } from "../../types";
import { fetchProviderModels } from "../../utils/fetch-models";
import { createOpenAIImageModel } from "../openai/image-model";
import { createOpenAIRerankModel } from "../openai/rerank-model";
import { createSiliconflowSpeechModel } from "./speech-model";

export interface SiliconFlowProviderSettings extends BaseProviderSettings {}

class SiliconFlowProviderImpl implements AIProvider {
    readonly id = "siliconflow";
    readonly name = "硅基流动";

    private baseProvider: ReturnType<typeof createOpenAICompatible>;
    private settings: SiliconFlowProviderSettings;

    constructor(settings: SiliconFlowProviderSettings = {}) {
        this.settings = {
            ...settings,
            baseURL: settings.baseURL || "https://api.siliconflow.cn/v1",
        };

        this.baseProvider = createOpenAICompatible({
            name: "siliconflow",
            baseURL: this.settings.baseURL!,
            headers: {
                Authorization:
                    this.settings?.apiKey && this.settings?.apiKey.includes("Bearer ")
                        ? this.settings.apiKey
                        : `Bearer ${this.settings.apiKey}`,
                ...this.settings.headers,
            },
        });
    }

    languageModel(modelId: string): LanguageModelV3 {
        return this.baseProvider.languageModel(modelId);
    }

    embeddingModel(modelId: string): EmbeddingModelV3 {
        return this.baseProvider.embeddingModel(modelId);
    }

    rerank(modelId: string): RerankingModelV3 {
        return createOpenAIRerankModel(this.settings, modelId);
    }

    speech(modelId: string) {
        return createSiliconflowSpeechModel(this.settings, modelId);
    }

    image(modelId: string) {
        return createOpenAIImageModel(this.settings, modelId);
    }

    async listModels(): Promise<ProviderModelInfo[]> {
        return fetchProviderModels(this.settings);
    }
}

export function siliconflow(settings: SiliconFlowProviderSettings = {}): AIProvider {
    return new SiliconFlowProviderImpl(settings);
}
