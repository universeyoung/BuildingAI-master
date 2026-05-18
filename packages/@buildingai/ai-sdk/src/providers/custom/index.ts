import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { EmbeddingModelV3, LanguageModelV3, RerankingModelV3 } from "@ai-sdk/provider";

import type {
    AIProvider,
    BaseProviderSettings,
    ModerationModelV1,
    ProviderModelInfo,
} from "../../types";
import { fetchProviderModels } from "../../utils/fetch-models";
import { createOpenAIImageModel } from "../openai/image-model";
import { createOpenAIModerationModel } from "../openai/moderation-model";
import { createOpenAIRerankModel } from "../openai/rerank-model";
import { createOpenAISpeechModel } from "../openai/speech-model";
import { createOpenAITranscriptionModel } from "../openai/transcription-model";

export interface CustomProviderSettings extends BaseProviderSettings {
    id?: string;
    name?: string;
}

class CustomProviderImpl implements AIProvider {
    readonly id: string;
    readonly name: string;

    private baseProvider: ReturnType<typeof createOpenAICompatible>;
    private settings: CustomProviderSettings;

    constructor(settings: CustomProviderSettings = {}) {
        this.id = settings.id || "custom";
        this.name = settings.name || "Custom";
        this.settings = settings;

        if (!settings.baseURL) {
            throw new Error("自定义模型厂商必须提供 baseUrl");
        }

        this.baseProvider = createOpenAICompatible({
            name: this.id,
            baseURL: settings.baseURL,
            headers: {
                ...(settings.apiKey
                    ? {
                          Authorization: settings.apiKey.includes("Bearer ")
                              ? settings.apiKey
                              : settings?.apiKey && settings?.apiKey.includes("Bearer ")
                                ? settings.apiKey
                                : `Bearer ${settings.apiKey}`,
                      }
                    : {}),
                ...settings.headers,
            },
        });
    }

    languageModel(modelId: string): LanguageModelV3 {
        return this.baseProvider.languageModel(modelId);
    }

    embeddingModel(modelId: string): EmbeddingModelV3 {
        return this.baseProvider.embeddingModel(modelId);
    }

    speech(modelId: string) {
        return createOpenAISpeechModel(this.settings, modelId);
    }

    transcription(modelId: string) {
        return createOpenAITranscriptionModel(this.settings, modelId);
    }

    rerank(modelId: string): RerankingModelV3 {
        return createOpenAIRerankModel(this.settings, modelId);
    }

    moderation(modelId: string): ModerationModelV1 {
        return createOpenAIModerationModel(this.settings, modelId);
    }

    image(modelId: string) {
        return createOpenAIImageModel(this.settings, modelId);
    }

    async listModels(): Promise<ProviderModelInfo[]> {
        return fetchProviderModels(this.settings);
    }
}

export function custom(settings: CustomProviderSettings = {}): AIProvider {
    return new CustomProviderImpl(settings);
}
