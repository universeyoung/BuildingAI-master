/**
 * Plugin `consoleMenu` shape as returned by `/extensions/:identifier/plugin-layout`
 * (same structure as `export const consoleMenu` in each extension's `router.options.ts`).
 */
export type PluginConsoleMenuItem = {
    name?: string;
    path?: string;
    sort?: number;
    children?: PluginConsoleMenuItem[];
};

/**
 * Normalizes a menu `path` to a single URL segment or nested `a/b` path (no leading slash).
 *
 * @param path - Raw path from router.options (may start with "/")
 */
export function normalizePluginConsolePath(path: string): string {
    return path.trim().replace(/^\/+/u, "").replace(/\/+$/u, "");
}

/**
 * Walks `consoleMenu` in `sort` order and returns the first navigable path under
 * `/extension/{identifier}/console/…`, matching how the plugin sidebar orders items.
 *
 * @param consoleMenu - `consoleMenu` from plugin-layout API (or null/undefined)
 * @returns Path after `console/` without leading slash, or `null` if none
 *
 * @example
 * // picmaster: first item path "record" → "record"
 * resolveExtensionConsoleEntryPath([{ path: "record", sort: 1 }, { path: "config", sort: 2 }])
 */
export function resolveExtensionConsoleEntryPath(consoleMenu: unknown): string | null {
    if (!Array.isArray(consoleMenu) || consoleMenu.length === 0) {
        return null;
    }

    const walk = (items: PluginConsoleMenuItem[]): string | null => {
        const sorted = [...items].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
        for (const item of sorted) {
            if (item.children?.length) {
                const nested = walk(item.children);
                if (nested) {
                    const parentSeg = normalizePluginConsolePath(item.path ?? "");
                    return parentSeg ? `${parentSeg}/${nested}` : nested;
                }
            }
            const seg = normalizePluginConsolePath(item.path ?? "");
            if (seg.length > 0) {
                return seg;
            }
        }
        return null;
    };

    return walk(consoleMenu as PluginConsoleMenuItem[]);
}

/**
 * Detects whether current runtime is production build.
 *
 * Uses Vite's `import.meta.env.PROD` when available, then falls back to
 * `process.env.NODE_ENV === "production"` for non-Vite bundlers.
 */
function isProdRuntime(): boolean {
    const viteProd = (import.meta as unknown as { env?: { PROD?: boolean } }).env?.PROD;
    if (typeof viteProd === "boolean") {
        return viteProd;
    }
    return (
        (globalThis as unknown as { process?: { env?: { NODE_ENV?: string } } }).process?.env
            ?.NODE_ENV === "production"
    );
}

/**
 * Returns current page origin when running in a browser.
 */
function getBrowserOrigin(): string | null {
    if (typeof window === "undefined") {
        return null;
    }
    return window.location?.origin || null;
}

/**
 * Builds the full URL to open a plugin's console at the first menu route.
 *
 * In production, it always prefers the current page origin (same-origin), even if callers
 * accidentally pass a different `baseUrl`.
 *
 * @param baseUrl - Site origin (e.g. `window.location.origin` or dev base URL)
 * @param identifier - Extension package identifier
 * @param consoleMenu - Optional menu from plugin-layout; falls back to `/console` only
 */
export function buildExtensionConsoleManageUrl(
    baseUrl: string,
    identifier: string,
    consoleMenu: unknown,
): string {
    const effectiveBaseUrl = isProdRuntime() ? (getBrowserOrigin() ?? baseUrl) : baseUrl;
    const root = `${effectiveBaseUrl.replace(/\/+$/u, "")}/extension/${identifier}/console`;
    const entry = resolveExtensionConsoleEntryPath(consoleMenu);
    if (!entry) {
        return root;
    }
    return `${root}/${entry}`.replace(/([^:]\/)\/+/gu, "$1");
}
