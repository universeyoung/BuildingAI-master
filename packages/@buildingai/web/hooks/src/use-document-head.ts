import { useEffect, useId, useRef } from "react";

import { headManager } from "./head-manager";

export interface DocumentHeadOptions {
    title?: string;
    description?: string;
    keywords?: string;
    icon?: string;
    ogTitle?: string;
    ogDescription?: string;
    ogImage?: string;
    ogUrl?: string;
    ogType?: string;
    twitterCard?: string;
    twitterTitle?: string;
    twitterDescription?: string;
    twitterImage?: string;
    canonical?: string;
    robots?: string;
    author?: string;
    themeColor?: string;
}

/**
 * A hook to manage document head elements (title, meta tags, favicon, etc.)
 * for SEO and social sharing purposes.
 *
 * Registers head config into a centralized HeadManager instead of
 * directly mutating the DOM. Supports priority override — later-mounted
 * components (e.g. Page) override earlier ones (e.g. Layout).
 *
 * Requires `useHeadRenderer()` to be called once at the App root.
 */
export const useDocumentHead = (options: DocumentHeadOptions): void => {
    const id = useId();
    const mountedRef = useRef(false);

    // Register on mount, remove on unmount — preserves stack order
    useEffect(() => {
        headManager.add(id, options);
        mountedRef.current = true;

        return () => {
            headManager.remove(id);
            mountedRef.current = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    // Update options when dependencies change (without affecting stack order)
    useEffect(() => {
        if (mountedRef.current) {
            headManager.update(id, options);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        id,
        options.title,
        options.description,
        options.keywords,
        options.icon,
        options.ogTitle,
        options.ogDescription,
        options.ogImage,
        options.ogUrl,
        options.ogType,
        options.twitterCard,
        options.twitterTitle,
        options.twitterDescription,
        options.twitterImage,
        options.canonical,
        options.robots,
        options.author,
        options.themeColor,
    ]);
};
