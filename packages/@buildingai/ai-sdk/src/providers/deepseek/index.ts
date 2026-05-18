import { createDeepSeek, type DeepSeekProvider as AISDKDeepSeekProvider } from "@ai-sdk/deepseek";
import type { LanguageModelV3 } from "@ai-sdk/provider";

import type { AIProvider, BaseProviderSettings, ProviderModelInfo } from "../../types";
import { fetchProviderModels } from "../../utils/fetch-models";

export interface DeepSeekProviderSettings extends BaseProviderSettings {}

class DeepSeekProviderImpl implements AIProvider {
    readonly id = "deepseek";
    readonly name = "DeepSeek";

    private baseProvider: AISDKDeepSeekProvider;
    private settings: DeepSeekProviderSettings;

    constructor(settings: DeepSeekProviderSettings = {}) {
        this.settings = {
            ...settings,
            baseURL: settings.baseURL || "https://api.deepseek.com/v1",
        };

        this.baseProvider = createDeepSeek({
            apiKey: this.settings.apiKey,
            baseURL: this.settings.baseURL,
            headers: this.settings.headers,
        });
    }

    languageModel(modelId: string): LanguageModelV3 {
        return this.baseProvider.languageModel(modelId);
    }

    async listModels(): Promise<ProviderModelInfo[]> {
        return fetchProviderModels(this.settings);
    }
}

export function deepseek(settings: DeepSeekProviderSettings = {}): AIProvider {
    return new DeepSeekProviderImpl(settings);
}
