import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { EmbeddingModelV3, LanguageModelV3, RerankingModelV3 } from "@ai-sdk/provider";

import type { AIProvider, BaseProviderSettings, ProviderModelInfo } from "../../types";
import { fetchProviderModels } from "../../utils/fetch-models";
import { createOpenAIRerankModel } from "../openai/rerank-model";

export interface WenXinProviderSettings extends BaseProviderSettings {}

class WenXinProviderImpl implements AIProvider {
    readonly id = "wenxin";
    readonly name = "文心一言";

    private baseProvider: ReturnType<typeof createOpenAICompatible>;
    private settings: WenXinProviderSettings;

    constructor(settings: WenXinProviderSettings = {}) {
        this.settings = {
            ...settings,
            baseURL: settings.baseURL || "https://qianfan.baidubce.com/v2",
        };

        this.baseProvider = createOpenAICompatible({
            name: "wenxin",
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

    async listModels(): Promise<ProviderModelInfo[]> {
        return fetchProviderModels(this.settings);
    }
}

export function wenxin(settings: WenXinProviderSettings = {}): AIProvider {
    return new WenXinProviderImpl(settings);
}
