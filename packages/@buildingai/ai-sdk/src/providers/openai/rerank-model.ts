import type { RerankingModelV3, RerankingModelV3CallOptions } from "@ai-sdk/provider";

import type { OpenAIProviderSettings } from "./index";

export function createOpenAIRerankModel(
    settings: OpenAIProviderSettings,
    modelId: string,
): RerankingModelV3 {
    return {
        specificationVersion: "v3",
        provider: "openai",
        modelId,
        async doRerank(options: RerankingModelV3CallOptions) {
            const documents =
                options.documents.type === "text"
                    ? options.documents.values
                    : options.documents.values.map((d) => JSON.stringify(d));
            const response = await fetch(`${settings.baseURL}/rerank`, {
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
                    query: options.query,
                    documents,
                    top_n: options.topN ?? documents.length,
                    return_documents: false,
                }),
            });
            if (!response.ok) {
                const error = await response.text();
                throw new Error(`重排序请求失败: ${response.status} ${error}`);
            }
            const data = await response.json();
            const results = data.results || data.rankings || [];
            return {
                ranking: results.map((item: any) => ({
                    index: item.index,
                    relevanceScore: item.relevance_score ?? item.score ?? 0,
                })),
                providerMetadata: {},
            };
        },
    };
}
