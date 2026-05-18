import type { BaseProviderSettings, ProviderModelInfo } from "../types";

/**
 * Fetch model list from a provider's /models endpoint (OpenAI-compatible).
 * Returns an empty array on any failure (network error, non-200 status, invalid response, etc.).
 */
export async function fetchProviderModels(
    settings: BaseProviderSettings,
    options?: { modelsPath?: string },
): Promise<ProviderModelInfo[]> {
    const baseURL = settings.baseURL;
    if (!baseURL) return [];

    const modelsPath = options?.modelsPath ?? "/models";
    const url = `${baseURL.replace(/\/+$/, "")}${modelsPath}`;

    const headers: Record<string, string> = {
        Accept: "application/json",
        ...settings.headers,
    };

    if (settings.apiKey) {
        headers.Authorization = settings.apiKey.includes("Bearer ")
            ? settings.apiKey
            : `Bearer ${settings.apiKey}`;
    }

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), settings.timeout ?? 15_000);

        const response = await fetch(url, {
            method: "GET",
            headers,
            signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) return [];

        const json = (await response.json()) as { data?: ProviderModelInfo[] };
        if (!Array.isArray(json?.data)) return [];

        return json.data.map((m) => ({
            id: m.id,
            object: m.object,
            created: m.created,
            owned_by: m.owned_by,
        }));
    } catch {
        return [];
    }
}

/**
 * Fetch model list from Ollama's /api/tags endpoint.
 * Returns data normalized to ProviderModelInfo format.
 */
export async function fetchOllamaModels(
    settings: BaseProviderSettings,
): Promise<ProviderModelInfo[]> {
    const baseURL = (settings.baseURL || "http://localhost:11434/api").replace(/\/+$/, "");
    // Ollama base URL is typically http://localhost:11434/api, the tags endpoint is /api/tags
    const url = baseURL.endsWith("/api") ? `${baseURL}/tags` : `${baseURL}/api/tags`;

    const headers: Record<string, string> = {
        Accept: "application/json",
        ...settings.headers,
    };

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), settings.timeout ?? 15_000);

        const response = await fetch(url, {
            method: "GET",
            headers,
            signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) return [];

        const json = (await response.json()) as {
            models?: Array<{ name: string; modified_at?: string }>;
        };
        if (!Array.isArray(json?.models)) return [];

        return json.models.map((m) => ({
            id: m.name,
            object: "model",
        }));
    } catch {
        return [];
    }
}
