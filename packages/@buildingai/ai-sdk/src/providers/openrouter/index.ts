import type { EmbeddingModelV3, LanguageModelV3 } from "@ai-sdk/provider";
import {
    createOpenRouter,
    type OpenRouterProvider as AISDKOpenRouterProvider,
} from "@openrouter/ai-sdk-provider";

import type { AIProvider, BaseProviderSettings, ProviderModelInfo } from "../../types";
import { fetchProviderModels } from "../../utils/fetch-models";

export interface OpenRouterProviderSettings extends BaseProviderSettings {}

class OpenRouterProviderImpl implements AIProvider {
    readonly id = "openrouter";
    readonly name = "OpenRouter";

    private baseProvider: AISDKOpenRouterProvider;
    private settings: OpenRouterProviderSettings;

    constructor(settings: OpenRouterProviderSettings = {}) {
        this.settings = {
            ...settings,
            baseURL: settings.baseURL || "https://openrouter.ai/api/v1",
        };

        this.baseProvider = createOpenRouter({
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

    async listModels(): Promise<ProviderModelInfo[]> {
        return fetchProviderModels(this.settings);
    }
}

export function openrouter(settings: OpenRouterProviderSettings = {}): AIProvider {
    return new OpenRouterProviderImpl(settings);
}
