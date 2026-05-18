import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { tool } from "ai";
import { z } from "zod";

const DEFAULT_FETCH_MAX_BYTES = 512 * 1024;
const FETCH_TIMEOUT_MS = 20_000;
const DEFAULT_DDGS_TIMEOUT_MS = 60_000;

export interface CreateWebSearchToolOptions {
    /** Python executable (e.g. `python`, `python3`, or full path). Default: WEB_SEARCH_PYTHON, then PYTHON, then `python`. */
    pythonPath?: string | null;
    /** Absolute path to `ddgs_search.py`. Default: BUILDINGAI_DDGS_SCRIPT, then repo `scripts/ddgs_search.py`. */
    scriptPath?: string | null;
    /** Subprocess timeout in ms. */
    timeoutMs?: number;
}

export interface CreateFetchWebPageToolOptions {
    maxBytes?: number;
}

function isPrivateOrBlockedHost(hostname: string): boolean {
    const h = hostname.toLowerCase();
    if (h === "localhost" || h.endsWith(".localhost")) return true;
    if (h === "0.0.0.0") return true;
    if (h === "[::1]" || h === "::1") return true;
    if (h.endsWith(".local")) return true;
    if (h === "metadata.google.internal") return true;
    if (h.startsWith("127.")) return true;
    if (h.startsWith("10.")) return true;
    if (h.startsWith("192.168.")) return true;
    if (h.startsWith("169.254.")) return true;
    const m172 = h.match(/^172\.(\d+)\./);
    if (m172) {
        const second = Number.parseInt(m172[1]!, 10);
        if (second >= 16 && second <= 31) return true;
    }
    return false;
}

export function assertPublicHttpUrl(rawUrl: string): URL {
    let u: URL;
    try {
        u = new URL(rawUrl.trim());
    } catch {
        throw new Error("Invalid URL");
    }
    if (u.protocol !== "http:" && u.protocol !== "https:") {
        throw new Error("Only http and https URLs are allowed");
    }
    if (isPrivateOrBlockedHost(u.hostname)) {
        throw new Error("URL host is not allowed (private or reserved network)");
    }
    return u;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...init, signal: controller.signal });
    } finally {
        clearTimeout(id);
    }
}

function resolveDdgsScriptPath(explicit?: string | null): string | null {
    if (explicit?.trim()) return path.resolve(explicit.trim());
    const fromEnv = process.env.BUILDINGAI_DDGS_SCRIPT?.trim();
    if (fromEnv) return path.resolve(fromEnv);

    let dir = path.dirname(fileURLToPath(import.meta.url));
    for (let i = 0; i < 14; i++) {
        const candidate = path.join(dir, "scripts", "ddgs_search.py");
        if (existsSync(candidate)) return candidate;
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
    }

    const fromCwd = path.join(process.cwd(), "scripts", "ddgs_search.py");
    if (existsSync(fromCwd)) return path.resolve(fromCwd);

    return null;
}

function defaultPython(): string {
    return (
        process.env.WEB_SEARCH_PYTHON?.trim() ||
        process.env.PYTHON?.trim() ||
        (process.platform === "win32" ? "python" : "python3")
    );
}

type DdgsJson =
    | { provider: string; query: string; results: Array<{ title: string; url: string; snippet: string }> }
    | { error: string; query?: string; detail?: string };

function runDdgsSearch(
    query: string,
    maxResults: number,
    pythonBin: string,
    scriptPath: string,
    timeoutMs: number,
): Promise<DdgsJson> {
    return new Promise((resolve, reject) => {
        const proc = spawn(pythonBin, [scriptPath, query, String(maxResults)], {
            windowsHide: true,
            env: {
                ...process.env,
                PYTHONUTF8: "1",
                PYTHONIOENCODING: "utf-8",
            },
        });

        let stdout = "";
        let stderr = "";
        let settled = false;

        const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            try {
                proc.kill("SIGTERM");
            } catch {
                /* ignore */
            }
            reject(new Error(`ddgs_search timed out after ${timeoutMs}ms`));
        }, timeoutMs);

        proc.stdout.setEncoding("utf8");
        proc.stderr.setEncoding("utf8");
        proc.stdout.on("data", (c: string) => {
            stdout += c;
        });
        proc.stderr.on("data", (c: string) => {
            stderr += c;
        });
        proc.on("error", (err) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            reject(err);
        });
        proc.on("close", (code) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);

            let parsed: DdgsJson | null = null;
            try {
                parsed = JSON.parse(stdout.trim()) as DdgsJson;
            } catch {
                /* ignore */
            }

            if (parsed && "error" in parsed && parsed.error) {
                resolve(parsed);
                return;
            }

            if (code !== 0 && code !== null) {
                resolve({
                    error: stderr.trim() || `Python exited with code ${code}`,
                    query,
                });
                return;
            }

            if (parsed) {
                resolve(parsed);
                return;
            }

            resolve({
                error: `Invalid JSON from ddgs_search: ${stdout.slice(0, 400)}`,
                query,
            });
        });
    });
}

export function createWebSearchTool(options?: CreateWebSearchToolOptions) {
    const timeoutMs = options?.timeoutMs ?? DEFAULT_DDGS_TIMEOUT_MS;
    const pythonPath = options?.pythonPath?.trim() || defaultPython();
    const scriptOverride = options?.scriptPath?.trim() || null;

    return tool({
        description: [
            "Search the public web via Python duckduckgo-search (DDGS). Returns titles, URLs, and snippets.",
            "Tool name is web_search (underscore). Do NOT call web-search or other aliases.",
            "Requires Python with `pip install duckduckgo-search` and repo script `scripts/ddgs_search.py` (or set BUILDINGAI_DDGS_SCRIPT).",
            "Prefer getWeather for weather-only questions. When datasetsSearch exists, call it first for domain facts; use web_search as fallback or for web-only / real-time topics.",
        ].join(" "),
        inputSchema: z.object({
            query: z.string().min(1).max(500).describe("Web search query; be specific."),
            maxResults: z
                .number()
                .int()
                .min(1)
                .max(15)
                .optional()
                .default(5)
                .describe("Max number of results (1–15)."),
        }),
        needsApproval: false,
        execute: async ({ query, maxResults }) => {
            const n = maxResults ?? 5;
            const scriptPath = resolveDdgsScriptPath(scriptOverride);
            if (!scriptPath) {
                return {
                    error:
                        "ddgs_search.py not found. Place scripts/ddgs_search.py at the monorepo root, or set BUILDINGAI_DDGS_SCRIPT to its absolute path.",
                    query,
                };
            }
            try {
                const out = await runDdgsSearch(query, n, pythonPath, scriptPath, timeoutMs);
                if ("error" in out && out.error) {
                    return { ...out, scriptPath, pythonPath };
                }
                return { ...out, scriptPath };
            } catch (err) {
                return {
                    error: err instanceof Error ? err.message : "web_search failed",
                    query,
                    hint: "Install: pip install -r scripts/requirements-ddgs.txt — ensure WEB_SEARCH_PYTHON points to that Python.",
                    pythonPath,
                    scriptPath,
                };
            }
        },
    });
}

function stripHtmlToText(html: string, maxLen: number): string {
    let s = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
        .replace(/<\/(p|div|br|tr|h[1-6]|li)\s*>/gi, "\n")
        .replace(/<[^>]+>/g, " ");
    s = s
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '"')
        .replace(/&#(\d+);/g, (_, code: string) => {
            const num = Number.parseInt(code, 10);
            return Number.isFinite(num) ? String.fromCharCode(num) : "";
        })
        .replace(/\s+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .replace(/[ \t]{2,}/g, " ")
        .trim();
    if (s.length > maxLen) {
        return `${s.slice(0, maxLen)}\n\n…(truncated)`;
    }
    return s;
}

export function createFetchWebPageTool(options?: CreateFetchWebPageToolOptions) {
    const maxBytes = options?.maxBytes ?? DEFAULT_FETCH_MAX_BYTES;

    return tool({
        description: [
            "Download a public web page over HTTP(S) and return extracted plain text for quoting or summarizing.",
            "Use when the user gives a URL, or after web_search returned URLs you need to read in depth.",
            "Only standard HTML pages; not for file downloads, APIs returning JSON only, or authenticated pages.",
            "Tool name is fetch_web_page (underscore).",
        ].join(" "),
        inputSchema: z.object({
            url: z.string().url().describe("Absolute http(s) URL of the page to fetch."),
        }),
        needsApproval: false,
        execute: async ({ url }) => {
            try {
                const u = assertPublicHttpUrl(url);
                const res = await fetchWithTimeout(
                    u.toString(),
                    {
                        redirect: "follow",
                        headers: {
                            "User-Agent": "BuildingAI/1.0 (compatible; +https://github.com/buildingai)",
                            Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
                        },
                    },
                    FETCH_TIMEOUT_MS,
                );
                if (!res.ok) {
                    return { error: `HTTP ${res.status}`, url: u.toString() };
                }
                const ctype = (res.headers.get("content-type") || "").toLowerCase();
                if (!ctype.includes("text/html") && !ctype.includes("application/xhtml+xml")) {
                    return {
                        error: `Unsupported content-type: ${ctype || "unknown"} (expected HTML)`,
                        url: u.toString(),
                    };
                }
                const buf = await res.arrayBuffer();
                if (buf.byteLength > maxBytes) {
                    return {
                        error: `Response too large (${buf.byteLength} bytes; max ${maxBytes})`,
                        url: u.toString(),
                    };
                }
                const html = new TextDecoder("utf-8", { fatal: false }).decode(buf);
                const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
                const title = titleMatch?.[1] ? stripHtmlToText(titleMatch[1], 500) : undefined;
                const text = stripHtmlToText(html, 48_000);
                if (!text) {
                    return {
                        url: u.toString(),
                        title,
                        text: "(no extractable text)",
                        note: "Page may be empty or script-only.",
                    };
                }
                return { url: u.toString(), title, text };
            } catch (err) {
                return {
                    error: err instanceof Error ? err.message : "fetch_web_page failed",
                    url,
                };
            }
        },
    });
}
