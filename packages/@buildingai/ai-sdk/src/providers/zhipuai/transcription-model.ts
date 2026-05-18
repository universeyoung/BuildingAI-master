import type { TranscriptionModelV3 } from "@ai-sdk/provider";

import type { ZhipuAIProviderSettings } from "./index";

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

export function createZhipuTranscriptionModel(
    settings: ZhipuAIProviderSettings,
    modelId: string,
): TranscriptionModelV3 {
    const baseURL = settings.baseURL?.replace(/\/$/, "") || "https://open.bigmodel.cn/api/paas/v4";
    const transcriptionsURL = `${baseURL}/audio/transcriptions`;
    return {
        specificationVersion: "v3",
        provider: "zhipuai",
        modelId,
        async doGenerate(options: TranscriptionOptions) {
            const blob = await audioToBlob(options.audio);
            const po = options.providerOptions?.zhipuai as Record<string, unknown> | undefined;
            const buffer = new Uint8Array(await blob.arrayBuffer());
            const fileBlob = new Blob([buffer], { type: "audio/wav" });
            const formData = new FormData();
            formData.append("model", modelId);
            if (po?.prompt) formData.append("prompt", String(po.prompt));
            if (Array.isArray(po?.hotwords)) {
                (po.hotwords as string[])
                    .slice(0, 100)
                    .forEach((w) => formData.append("hotwords", w));
            }
            formData.append("file", fileBlob, "audio.wav");
            const response = await fetch(transcriptionsURL, {
                method: "POST",
                headers: {
                    Authorization:
                        settings?.apiKey && settings?.apiKey.includes("Bearer ")
                            ? settings.apiKey
                            : `Bearer ${settings.apiKey}`,
                    ...settings.headers,
                },
                body: formData,
            });
            if (!response.ok) {
                const err = await response.text();
                throw new Error(`智谱 ASR 请求失败: ${response.status} ${err}`);
            }
            const data = (await response.json()) as { text?: string };
            return {
                text: data.text ?? "",
                segments: [],
                language: undefined,
                durationInSeconds: undefined,
                warnings: [],
                response: { timestamp: new Date(), modelId, headers: undefined },
                providerMetadata: {},
            };
        },
    };
}
