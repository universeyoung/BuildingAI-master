import type { TranscriptionModelV3 } from "@ai-sdk/provider";

import type { GiteeAIProviderSettings } from "./index";

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

export function createGiteeTranscriptionModel(
    settings: GiteeAIProviderSettings,
    modelId: string,
): TranscriptionModelV3 {
    const baseURL = (settings.baseURL || "https://ai.gitee.com/v1").replace(/\/$/, "");
    const transcriptionsURL = `${baseURL}/audio/transcriptions`;

    return {
        specificationVersion: "v3",
        provider: "gitee_ai",
        modelId,
        async doGenerate(options: TranscriptionOptions) {
            const blob = await audioToBlob(options.audio);
            const po = options.providerOptions?.gitee_ai as Record<string, unknown> | undefined;
            const formData = new FormData();
            formData.append("file", blob, "audio.wav");
            formData.append("model", modelId);
            if (po?.language) formData.append("language", String(po.language));

            const response = await fetch(transcriptionsURL, {
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
                const err = await response.text();
                throw new Error(`Gitee AI ASR 请求失败: ${response.status} ${err}`);
            }

            const data = (await response.json()) as {
                text?: string;
                language?: string;
                segments?: { text: string; start: number; end: number }[];
            };

            const segments =
                data.segments?.map((s) => ({
                    text: s.text,
                    startSecond: s.start,
                    endSecond: s.end,
                })) ?? [];

            const durationInSeconds =
                segments.length > 0 ? segments[segments.length - 1]!.endSecond : undefined;

            return {
                text: data.text ?? "",
                segments,
                language: data.language,
                durationInSeconds,
                warnings: [],
                response: { timestamp: new Date(), modelId, headers: undefined },
                providerMetadata: {},
            };
        },
    };
}
