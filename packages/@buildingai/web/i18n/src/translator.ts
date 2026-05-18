import type { InterpolationParams, Messages } from "./types";

/**
 * Resolve a dot-notated key from a nested messages object.
 *
 * @example
 * resolveKey({ common: { btn: { ok: "OK" } } }, "common.btn.ok") // "OK"
 */
function resolveKey(messages: Messages, key: string): string | undefined {
    const segments = key.split(".");
    let current: string | Messages | undefined = messages;

    for (const segment of segments) {
        if (typeof current !== "object" || current === null) return undefined;
        current = current[segment];
    }

    return typeof current === "string" ? current : undefined;
}

/**
 * Replace `{variable}` placeholders with actual values.
 *
 * @example
 * interpolate("Hello, {name}!", { name: "World" }) // "Hello, World!"
 */
function interpolate(template: string, params: InterpolationParams): string {
    return template.replace(/\{(\w+)\}/g, (match, key: string) => {
        return key in params ? String(params[key]) : match;
    });
}

/**
 * Core translate function.
 * Resolution order: current locale → fallback locale → raw key.
 */
export function translate(
    key: string,
    localeMessages: Messages | undefined,
    fallbackMessages: Messages | undefined,
    params?: InterpolationParams,
): string {
    const raw =
        (localeMessages && resolveKey(localeMessages, key)) ??
        (fallbackMessages && resolveKey(fallbackMessages, key)) ??
        key;

    return params ? interpolate(raw, params) : raw;
}
