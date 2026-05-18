import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { EmbeddingModelV3, LanguageModelV3 } from "@ai-sdk/provider";

import type { AIProvider, BaseProviderSettings, ProviderModelInfo } from "../../types";
import { fetchProviderModels } from "../../utils/fetch-models";

export interface VolcengineProviderSettings extends BaseProviderSettings {}

class VolcengineProviderImpl implements AIProvider {
    readonly id = "volcengine";
    readonly name = "火山引擎";

    private baseProvider: ReturnType<typeof createOpenAICompatible>;
    private settings: VolcengineProviderSettings;

    constructor(settings: VolcengineProviderSettings = {}) {
        this.settings = {
            ...settings,
            baseURL: settings.baseURL || "https://ark.cn-beijing.volces.com/api/v3",
        };

        this.baseProvider = createOpenAICompatible({
            name: "volcengine",
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

export function volcengine(settings: VolcengineProviderSettings = {}): AIProvider {
    return new VolcengineProviderImpl(settings);
}
