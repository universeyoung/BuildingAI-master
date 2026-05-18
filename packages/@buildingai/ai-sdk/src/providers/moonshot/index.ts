import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModelV3 } from "@ai-sdk/provider";

import type { AIProvider, BaseProviderSettings, ProviderModelInfo } from "../../types";
import { fetchProviderModels } from "../../utils/fetch-models";

export interface MoonshotProviderSettings extends BaseProviderSettings {}

class MoonshotProviderImpl implements AIProvider {
    readonly id = "moonshot";
    readonly name = "月之暗面";

    private baseProvider: ReturnType<typeof createOpenAICompatible>;
    private settings: MoonshotProviderSettings;

    constructor(settings: MoonshotProviderSettings = {}) {
        this.settings = {
            ...settings,
            baseURL: settings.baseURL || "https://api.moonshot.cn/v1",
        };

        this.baseProvider = createOpenAICompatible({
            name: "moonshot",
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

export function moonshot(settings: MoonshotProviderSettings = {}): AIProvider {
    return new MoonshotProviderImpl(settings);
}
