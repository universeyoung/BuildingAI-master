import { getProviderForSpeech, getProviderForTranscription } from "@buildingai/ai-sdk";
import { SecretService } from "@buildingai/core/modules";
import { HttpErrorFactory } from "@buildingai/errors";
import { getProviderSecret } from "@buildingai/utils";
import { Injectable } from "@nestjs/common";
import {
    experimental_generateSpeech as generateSpeech,
    experimental_transcribe as transcribe,
} from "ai";

import { AiModelService } from "../../model/services/ai-model.service";
import { AgentsService } from "./agents.service";

export interface TranscribeResult {
    text: string;
    language?: string;
    duration?: number;
}

export interface SpeechOptions {
    modelId?: string;
    voice?: string;
    speed?: number;
    responseFormat?: "mp3" | "opus" | "aac" | "flac" | "wav" | "pcm";
}

@Injectable()
export class AgentVoiceService {
    constructor(
        private readonly agentsService: AgentsService,
        private readonly aiModelService: AiModelService,
        private readonly secretService: SecretService,
    ) {}

    async transcribe(
        agentId: string,
        audio: Buffer | Blob,
        language?: string,
    ): Promise<TranscribeResult> {
        const agent = await this.agentsService.findOne({
            where: { id: agentId },
        });
        if (!agent) throw HttpErrorFactory.notFound("智能体不存在");

        const sttConfig = agent.voiceConfig?.stt;
        if (!sttConfig?.modelId) {
            throw HttpErrorFactory.badRequest("智能体未配置语音识别 (STT) 模型");
        }

        const { model } = await this.resolveTranscriptionModel(sttConfig.modelId);
        const blob =
            audio instanceof Buffer ? new Blob([audio as unknown as BlobPart]) : (audio as Blob);
        const audioData = new Uint8Array(await blob.arrayBuffer());

        const result = await transcribe({
            model,
            audio: audioData,
            providerOptions: {
                openai: {
                    language: language ?? sttConfig.language,
                    response_format: "json",
                },
            },
        });

        return {
            text: result.text,
            language: result.language,
            duration: result.durationInSeconds,
        };
    }

    async speech(
        agentId: string,
        text: string,
        options?: SpeechOptions,
    ): Promise<{ audio: ArrayBuffer; format: string }> {
        const agent = await this.agentsService.findOne({
            where: { id: agentId },
        });
        if (!agent) throw HttpErrorFactory.notFound("智能体不存在");

        const ttsConfig = agent.voiceConfig?.tts;
        const effectiveModelId = options?.modelId ?? ttsConfig?.modelId;
        if (!effectiveModelId) {
            throw HttpErrorFactory.badRequest("智能体未配置语音合成 (TTS) 模型");
        }

        const { model } = await this.resolveSpeechModel(effectiveModelId);
        const result = await generateSpeech({
            model,
            text,
            voice: options?.voice ?? ttsConfig?.voiceId ?? "alloy",
            speed: options?.speed ?? ttsConfig?.speed ?? 1,
            outputFormat: (options?.responseFormat ?? "mp3") as "mp3" | "wav",
        });

        const audio = result.audio as { uint8Array: Uint8Array; format: string };
        return {
            audio: audio.uint8Array.buffer as ArrayBuffer,
            format: audio.format,
        };
    }

    private async resolveTranscriptionModel(modelId: string) {
        const model = await this.aiModelService.findOne({
            where: { id: modelId, isActive: true },
            relations: ["provider"],
        });
        if (!model?.provider?.isActive) {
            throw HttpErrorFactory.badRequest("语音识别模型不可用或未配置");
        }

        const providerSecret = await this.secretService.getConfigKeyValuePairs(
            model.provider.bindSecretId,
        );
        const getTranscription = getProviderForTranscription(model.provider.provider, {
            apiKey: getProviderSecret("apiKey", providerSecret),
            baseURL: getProviderSecret("baseUrl", providerSecret) || undefined,
        });
        return getTranscription(model.model);
    }

    private async resolveSpeechModel(modelId: string) {
        const model = await this.aiModelService.findOne({
            where: { id: modelId, isActive: true },
            relations: ["provider"],
        });
        if (!model?.provider?.isActive) {
            throw HttpErrorFactory.badRequest("语音合成模型不可用或未配置");
        }

        const providerSecret = await this.secretService.getConfigKeyValuePairs(
            model.provider.bindSecretId,
        );
        const getSpeech = getProviderForSpeech(model.provider.provider, {
            apiKey: getProviderSecret("apiKey", providerSecret),
            baseURL: getProviderSecret("baseUrl", providerSecret) || undefined,
        });
        return getSpeech(model.model);
    }
}
