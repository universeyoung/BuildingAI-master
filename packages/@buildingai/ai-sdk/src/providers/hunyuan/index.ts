import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { EmbeddingModelV3, LanguageModelV3 } from "@ai-sdk/provider";

import type { AIProvider, BaseProviderSettings, ProviderModelInfo } from "../../types";
import { fetchProviderModels } from "../../utils/fetch-models";

export interface HunyuanProviderSettings extends BaseProviderSettings {}

class HunyuanProviderImpl implements AIProvider {
    readonly id = "hunyuan";
    readonly name = "腾讯混元";

    private baseProvider: ReturnType<typeof createOpenAICompatible>;
    private settings: HunyuanProviderSettings;

    constructor(settings: HunyuanProviderSettings = {}) {
        this.settings = {
            ...settings,
            baseURL: settings.baseURL || "https://api.hunyuan.cloud.tencent.com/v1",
        };

        this.baseProvider = createOpenAICompatible({
            name: "hunyuan",
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

    async listModels(): Promise<ProviderModelInfo[]> {
        return fetchProviderModels(this.settings);
    }
}

export function hunyuan(settings: HunyuanProviderSettings = {}): AIProvider {
    return new HunyuanProviderImpl(settings);
}
