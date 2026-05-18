import type { RerankingModelV3, RerankingModelV3CallOptions } from "@ai-sdk/provider";

import type { TongYiProviderSettings } from "./index";

const TONGYI_RERANK_ENDPOINT =
    "https://dashscope.aliyuncs.com/api/v1/services/rerank/text-rerank/text-rerank";

export function createTongYiRerankModel(
    settings: TongYiProviderSettings,
    modelId: string,
): RerankingModelV3 {
    return {
        specificationVersion: "v3",
        provider: "tongyi",
        modelId,
        async doRerank(options: RerankingModelV3CallOptions) {
            const documents =
                options.documents.type === "text"
                    ? options.documents.values
                    : options.documents.values.map((d) => JSON.stringify(d));
            const response = await fetch(TONGYI_RERANK_ENDPOINT, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {}),
                    ...settings.headers,
                },
                body: JSON.stringify({
                    model: modelId,
                    input: { query: options.query, documents },
                    parameters: {
                        return_documents: false,
                        top_n: options.topN ?? documents.length,
                    },
                }),
            });
            if (!response.ok) {
                const error = await response.text();
                throw new Error(`通义重排序请求失败: ${response.status} ${error}`);
            }
            const data = await response.json();
            if (data?.code) throw new Error(`通义重排序服务错误: ${data.message || data.code}`);
            const results = data?.output?.results ?? [];
            return {
                ranking: results.map((item: any) => ({
                    index: item.index,
                    relevanceScore: item.relevance_score ?? 0,
                })),
                providerMetadata: {},
            };
        },
    };
}
