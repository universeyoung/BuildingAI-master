import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModelV3 } from "@ai-sdk/provider";

import type { AIProvider, BaseProviderSettings, ProviderModelInfo } from "../../types";
import { fetchProviderModels } from "../../utils/fetch-models";

export interface SparkProviderSettings extends BaseProviderSettings {}

class SparkProviderImpl implements AIProvider {
    readonly id = "spark";
    readonly name = "讯飞星火";

    private baseProvider: ReturnType<typeof createOpenAICompatible>;
    private settings: SparkProviderSettings;

    constructor(settings: SparkProviderSettings = {}) {
        this.settings = {
            ...settings,
            baseURL: settings.baseURL || "https://spark-api-open.xf-yun.com/v1",
        };

        this.baseProvider = createOpenAICompatible({
            name: "spark",
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

    async listModels(): Promise<ProviderModelInfo[]> {
        return fetchProviderModels(this.settings);
    }
}

export function spark(settings: SparkProviderSettings = {}): AIProvider {
    return new SparkProviderImpl(settings);
}
