import type {
    EmbeddingModelV3,
    ImageModelV3,
    LanguageModelV3,
    ProviderV3,
    RerankingModelV3,
    SpeechModelV3,
    TranscriptionModelV3,
} from "@ai-sdk/provider";

import type { ModerationModelV1 } from "./moderation";

export interface BaseProviderSettings {
    apiKey?: string;
    baseURL?: string;
    headers?: Record<string, string>;
    timeout?: number;
}

export interface AIProvider extends Partial<ProviderV3> {
    readonly id: string;
    readonly name: string;
    languageModel(modelId: string): LanguageModelV3;
    embeddingModel?(modelId: string): EmbeddingModelV3;
    image?(modelId: string): ImageModelV3;
    speech?(modelId: string): SpeechModelV3;
    transcription?(modelId: string): TranscriptionModelV3;
    rerank?(modelId: string): RerankingModelV3;
    moderation?(modelId: string): ModerationModelV1;
    listModels?(): Promise<ProviderModelInfo[]>;
}

export interface ProviderModelInfo {
    id: string;
    object?: string;
    created?: number;
    owned_by?: string;
}

export type ProviderFactory<T extends BaseProviderSettings = BaseProviderSettings> = (
    settings?: T,
) => AIProvider;

export interface ProviderRegistryEntry {
    id: string;
    factory: ProviderFactory;
    description?: string;
}
