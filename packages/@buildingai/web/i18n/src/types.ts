export type InterpolationParams = Record<string, string | number>;

/**
 * Recursive message structure supporting nested keys.
 * Leaf nodes are strings, branches are nested objects.
 */
export type Messages = {
    [key: string]: string | Messages;
};

export type LocaleMessages = Record<string, Messages>;

export interface I18nConfig {
    messages: LocaleMessages;
    defaultLocale: string;
    fallbackLocale?: string;
    storageKey?: string;
}

export interface I18nContextValue {
    t: (key: string, params?: InterpolationParams) => string;
    locale: string;
    setLocale: (locale: string) => void;
    availableLocales: string[];
}
