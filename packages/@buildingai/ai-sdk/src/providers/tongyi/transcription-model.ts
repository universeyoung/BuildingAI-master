import type { TranscriptionModelV3 } from "@ai-sdk/provider";

import type { TongYiProviderSettings } from "./index";

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

export function createTongYiTranscriptionModel(
    settings: TongYiProviderSettings,
    modelId: string,
): TranscriptionModelV3 {
    const baseURL = (
        settings.baseURL || "https://dashscope.aliyuncs.com/compatible-mode/v1"
    ).replace(/\/$/, "");
    return {
        specificationVersion: "v3",
        provider: "tongyi",
        modelId,
        async doGenerate(options: TranscriptionOptions) {
            const blob = await audioToBlob(options.audio);
            const po = options.providerOptions?.tongyi as Record<string, unknown> | undefined;
            const fileArray = new Uint8Array(await blob.arrayBuffer());

            let binary = "";
            for (let i = 0; i < fileArray.length; i++) {
                binary += String.fromCharCode(fileArray[i] ?? 0);
            }
            const base64 = btoa(binary);
            const mime = blob.type || "audio/mpeg";
            const audioData = `data:${mime};base64,${base64}`;

            const body = {
                model: modelId,
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "input_audio",
                                input_audio: {
                                    data: audioData,
                                },
                            },
                        ],
                    },
                ],
                stream: false,
                extra_body: {
                    asr_options: {
                        enable_itn: po?.enable_itn ?? false,
                        language: po?.language,
                    },
                },
            };

            const response = await fetch(`${baseURL}/chat/completions`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization:
                        settings?.apiKey && settings?.apiKey.includes("Bearer ")
                            ? settings.apiKey
                            : `Bearer ${settings.apiKey}`,
                    ...settings.headers,
                },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const err = await response.text();
                throw new Error(`通义 ASR 请求失败: ${response.status} ${err}`);
            }

            const json = (await response.json()) as {
                choices?: { message?: { content?: string } }[];
            };

            const text = json.choices?.[0]?.message?.content ?? "";

            return {
                text,
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
