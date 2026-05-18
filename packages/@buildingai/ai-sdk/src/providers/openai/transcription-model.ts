import type { TranscriptionModelV3 } from "@ai-sdk/provider";

import type { OpenAIProviderSettings } from "./index";

type TranscriptionOptions = Parameters<TranscriptionModelV3["doGenerate"]>[0];

async function audioToBlob(audio: TranscriptionOptions["audio"]): Promise<Blob> {
    if (audio instanceof URL) {
        const res = await fetch(audio.href);
        return res.blob();
    }
    const data = (audio as { data?: ArrayBuffer | Uint8Array })?.data ?? audio;
    if (data instanceof ArrayBuffer) return new Blob([data]);
    if (data instanceof Uint8Array) return new Blob([new Uint8Array(data)]);
    return new Blob([await (data as unknown as Blob).arrayBuffer()]);
}

export function createOpenAITranscriptionModel(
    settings: OpenAIProviderSettings,
    modelId: string,
): TranscriptionModelV3 {
    return {
        specificationVersion: "v3",
        provider: "openai",
        modelId,
        async doGenerate(options: TranscriptionOptions) {
            const blob = await audioToBlob(options.audio);
            const po = options.providerOptions?.openai as Record<string, unknown> | undefined;
            const formData = new FormData();
            formData.append("file", blob, "audio.mp3");
            formData.append("model", modelId);
            if (po?.language) formData.append("language", String(po.language));
            if (po?.prompt) formData.append("prompt", String(po.prompt));
            formData.append("response_format", (po?.response_format ?? "json") as string);
            if (po?.temperature != null) formData.append("temperature", String(po.temperature));
            const response = await fetch(`${settings.baseURL}/audio/transcriptions`, {
                method: "POST",
                headers: {
                    Authorization:
                        settings?.apiKey && settings?.apiKey.includes("Bearer ")
                            ? settings.apiKey
                            : settings?.apiKey && settings?.apiKey.includes("Bearer ")
                              ? settings.apiKey
                              : `Bearer ${settings.apiKey}`,
                    ...settings.headers,
                },
                body: formData,
            });
            if (!response.ok) {
                const error = await response.text();
                throw new Error(`OpenAI STT 请求失败: ${response.status} ${error}`);
            }
            const data = await response.json();
            return {
                text: data.text,
                segments: (data.segments || []).map((s: any) => ({
                    text: s.text,
                    startSecond: s.start,
                    endSecond: s.end,
                })),
                language: data.language,
                durationInSeconds: data.duration,
                warnings: [],
                response: { timestamp: new Date(), modelId, headers: undefined },
                providerMetadata: {},
            };
        },
    };
}
