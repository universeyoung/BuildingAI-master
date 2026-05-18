import type { ImageModelV3 } from "@ai-sdk/provider";

import type { OpenAIProviderSettings } from "./index";

function b64ToUint8Array(b64: string): Uint8Array {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

export function createOpenAIImageModel(
    settings: OpenAIProviderSettings,
    modelId: string,
): ImageModelV3 {
    return {
        specificationVersion: "v3",
        provider: "openai",
        modelId,
        maxImagesPerCall: 10,
        async doGenerate(options: Parameters<ImageModelV3["doGenerate"]>[0]) {
            const prompt =
                typeof options.prompt === "string"
                    ? options.prompt
                    : ((options.prompt as unknown as { text?: string })?.text ?? "");
            const openaiOpts = (options.providerOptions?.openai ?? {}) as Record<string, unknown>;
            const response = await fetch(`${settings.baseURL}/images/generations`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization:
                        settings?.apiKey && settings?.apiKey.includes("Bearer ")
                            ? settings.apiKey
                            : settings?.apiKey && settings?.apiKey.includes("Bearer ")
                              ? settings.apiKey
                              : `Bearer ${settings.apiKey}`,
                    ...settings.headers,
                },
                body: JSON.stringify({
                    model: modelId,
                    prompt,
                    n: options.n ?? 1,
                    size: options.size ?? "1024x1024",
                    quality: openaiOpts.quality ?? "standard",
                    style: openaiOpts.style ?? "vivid",
                    response_format: "b64_json",
                }),
            });
            if (!response.ok) {
                const error = await response.text();
                throw new Error(`图像生成请求失败: ${response.status} ${error}`);
            }
            const data = await response.json();
            const images: Uint8Array[] = await Promise.all(
                (data.data || []).map(async (img: any) => {
                    if (img.b64_json) return b64ToUint8Array(img.b64_json);
                    if (img.url) {
                        const res = await fetch(img.url);
                        return new Uint8Array(await res.arrayBuffer());
                    }
                    throw new Error("Image has no url or b64_json");
                }),
            );
            return {
                images,
                warnings: [],
                response: { timestamp: new Date(), modelId, headers: undefined },
                providerMetadata: {},
            };
        },
    };
}
