import { useCallback, useMemo, useState } from "react";

import { I18nContext } from "./context";
import { translate } from "./translator";
import type { I18nConfig, InterpolationParams } from "./types";

const DEFAULT_STORAGE_KEY = "buildingai-ui-locale";

function detectBrowserLocale(availableLocales: string[], defaultLocale: string): string {
    if (typeof navigator === "undefined") return defaultLocale;

    const languages = navigator.languages ?? [navigator.language];

    for (const lang of languages) {
        // Exact match
        if (availableLocales.includes(lang)) return lang;

        // Prefix match (e.g. "zh" matches "zh-CN")
        const prefix = lang.split("-")[0] ?? "";
        const match = availableLocales.find((l) => l.startsWith(prefix));
        if (match) return match;
    }

    return defaultLocale;
}

function getInitialLocale(
    availableLocales: string[],
    defaultLocale: string,
    storageKey: string,
): string {
    if (typeof window === "undefined") return defaultLocale;

    const stored = localStorage.getItem(storageKey);
    if (stored && availableLocales.includes(stored)) return stored;

    return detectBrowserLocale(availableLocales, defaultLocale);
}

export function I18nProvider({
    messages,
    defaultLocale,
    fallbackLocale,
    storageKey = DEFAULT_STORAGE_KEY,
    children,
}: I18nConfig & { children: React.ReactNode }) {
    const availableLocales = useMemo(() => Object.keys(messages), [messages]);

    const [locale, setLocaleState] = useState(() =>
        getInitialLocale(availableLocales, defaultLocale, storageKey),
    );

    const setLocale = useCallback(
        (nextLocale: string) => {
            if (!availableLocales.includes(nextLocale)) {
                console.warn(`[i18n] Locale "${nextLocale}" is not available.`);
                return;
            }
            setLocaleState(nextLocale);
            localStorage.setItem(storageKey, nextLocale);
        },
        [availableLocales, storageKey],
    );

    const resolvedFallback = fallbackLocale ?? defaultLocale;

    const t = useCallback(
        (key: string, params?: InterpolationParams) => {
            return translate(
                key,
                messages[locale],
                locale !== resolvedFallback ? messages[resolvedFallback] : undefined,
                params,
            );
        },
        [locale, messages, resolvedFallback],
    );

    const value = useMemo(
        () => ({ t, locale, setLocale, availableLocales }),
        [t, locale, setLocale, availableLocales],
    );

    return <I18nContext value={value}>{children}</I18nContext>;
}
