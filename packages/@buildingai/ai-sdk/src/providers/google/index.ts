import { createGoogleGenerativeAI, type GoogleGenerativeAIProvider } from "@ai-sdk/google";
import type { EmbeddingModelV3, LanguageModelV3 } from "@ai-sdk/provider";

import type { AIProvider, BaseProviderSettings, ProviderModelInfo } from "../../types";

export interface GoogleProviderSettings extends BaseProviderSettings {}

class GoogleProviderImpl implements AIProvider {
    readonly id = "google";
    readonly name = "Google";

    private baseProvider: GoogleGenerativeAIProvider;

    constructor(settings: GoogleProviderSettings = {}) {
        this.baseProvider = createGoogleGenerativeAI({
            apiKey: settings.apiKey,
            baseURL: settings.baseURL || "https://generativelanguage.googleapis.com/v1beta",
            headers: settings.headers,
        });
    }

    languageModel(modelId: string): LanguageModelV3 {
        return this.baseProvider.languageModel(modelId);
    }

    embeddingModel(modelId: string): EmbeddingModelV3 {
        return this.baseProvider.embeddingModel(modelId);
    }

    async listModels(): Promise<ProviderModelInfo[]> {
        return [];
    }
}

export function google(settings: GoogleProviderSettings = {}): AIProvider {
    return new GoogleProviderImpl(settings);
}
