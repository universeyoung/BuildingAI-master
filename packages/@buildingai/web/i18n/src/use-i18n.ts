import { useContext } from "react";

import { I18nContext } from "./context";
import type { I18nContextValue } from "./types";

/**
 * Hook to access i18n utilities within a component tree
 * wrapped by `I18nProvider`.
 *
 * @returns Object containing `t`, `locale`, `setLocale`, and `availableLocales`
 *
 * @example
 * ```tsx
 * const { t, locale, setLocale, availableLocales } = useI18n();
 *
 * t('common.greeting');
 * t('welcome', { name: 'John' });
 * setLocale('zh-CN');
 * ```
 */
export function useI18n(): I18nContextValue {
    const context = useContext(I18nContext);

    if (!context) {
        throw new Error("[i18n] useI18n must be used within an <I18nProvider>.");
    }

    return context;
}
