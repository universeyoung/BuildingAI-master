import type { EmbeddingModelV3, LanguageModelV3 } from "@ai-sdk/provider";
import { createOllama } from "ai-sdk-ollama";

import type { AIProvider, BaseProviderSettings, ProviderModelInfo } from "../../types";
import { fetchOllamaModels } from "../../utils/fetch-models";

export interface OllamaProviderSettings extends BaseProviderSettings {
    baseURL?: string;
}

class OllamaProviderImpl implements AIProvider {
    readonly id = "ollama";
    readonly name = "Ollama";

    private baseProvider: ReturnType<typeof createOllama>;
    private settings: OllamaProviderSettings;

    constructor(settings: OllamaProviderSettings = {}) {
        this.settings = {
            ...settings,
            baseURL: settings.baseURL || "http://localhost:11434/api",
        };

        this.baseProvider = createOllama({
            baseURL: this.settings.baseURL,
            headers: this.settings.headers,
        });
    }

    languageModel(modelId: string): LanguageModelV3 {
        return this.baseProvider.languageModel(modelId);
    }

    embeddingModel(modelId: string): EmbeddingModelV3 {
        return this.baseProvider.embeddingModel(modelId);
    }

    async listModels(): Promise<ProviderModelInfo[]> {
        return fetchOllamaModels(this.settings);
    }
}

export function ollama(settings: OllamaProviderSettings = {}): AIProvider {
    return new OllamaProviderImpl(settings);
}
