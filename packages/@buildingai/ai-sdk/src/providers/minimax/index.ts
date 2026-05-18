import type { LanguageModelV3 } from "@ai-sdk/provider";
import { createMinimax } from "vercel-minimax-ai-provider";

import type { AIProvider, BaseProviderSettings, ProviderModelInfo } from "../../types";
import { fetchProviderModels } from "../../utils/fetch-models";
import { createMiniMaxSpeechModel } from "./speech-model";

export interface MiniMaxProviderSettings extends BaseProviderSettings {
    baseURL?: string;
    speechBaseURL?: string;
}

class MiniMaxProviderImpl implements AIProvider {
    readonly id = "minimax";
    readonly name = "MiniMax";

    private settings: MiniMaxProviderSettings;
    private baseProvider: ReturnType<typeof createMinimax>;

    constructor(settings: MiniMaxProviderSettings = {}) {
        this.settings = settings;
        this.baseProvider = createMinimax({
            apiKey: settings.apiKey,
            baseURL: settings.baseURL || "https://api.minimax.io/anthropic/v1",
            headers: settings.headers,
        });
    }

    languageModel(modelId: string): LanguageModelV3 {
        return this.baseProvider.languageModel(modelId) as unknown as LanguageModelV3;
    }

    speech(modelId: string) {
        return createMiniMaxSpeechModel(this.settings, modelId);
    }

    async listModels(): Promise<ProviderModelInfo[]> {
        return fetchProviderModels({
            ...this.settings,
            baseURL: this.settings.baseURL || "https://api.minimax.io/anthropic/v1",
        });
    }
}

export function minimax(settings: MiniMaxProviderSettings = {}): AIProvider {
    return new MiniMaxProviderImpl(settings);
}
