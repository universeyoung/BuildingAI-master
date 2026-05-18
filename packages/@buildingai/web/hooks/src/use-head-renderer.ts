import { useEffect, useRef } from "react";

import type { MergedHeadResult } from "./head-manager";
import { headManager } from "./head-manager";
import type { DocumentHeadOptions } from "./use-document-head";

export interface HeadRendererOptions extends DocumentHeadOptions {
    /**
     * Title template string. Use "%s" as a placeholder for the page title.
     * Only applied when a page provides its own title via useDocumentHead.
     * @example "%s - BuildingAI"
     */
    titleTemplate?: string;
}

function setMetaTag(name: string, content: string, isProperty = false) {
    const attr = isProperty ? "property" : "name";
    let meta = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;

    if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute(attr, name);
        document.head.appendChild(meta);
    }

    meta.content = content;
}

function setLinkTag(rel: string, href: string, type?: string) {
    let link = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;

    if (!link) {
        link = document.createElement("link");
        link.rel = rel;
        document.head.appendChild(link);
    }

    link.href = href;
    if (type) link.type = type;
}

/**
 * Apply the merged head options to the actual DOM.
 * Performs diff against previous state to avoid unnecessary DOM mutations.
 */
function applyHead(
    { options, hasTitleOverride }: MergedHeadResult,
    prevOptions: DocumentHeadOptions,
    titleTemplate?: string,
): void {
    const {
        title,
        description,
        keywords,
        icon,
        ogTitle,
        ogDescription,
        ogImage,
        ogUrl,
        ogType,
        twitterCard,
        twitterTitle,
        twitterDescription,
        twitterImage,
        canonical,
        robots,
        author,
        themeColor,
    } = options;

    // Only apply titleTemplate when a page explicitly set a title via useDocumentHead
    const resolvedTitle =
        titleTemplate && title && hasTitleOverride ? titleTemplate.replace("%s", title) : title;

    if (resolvedTitle !== undefined && resolvedTitle !== prevOptions.title) {
        document.title = resolvedTitle;
    }

    // Meta tags - only update when value changed
    const metaMap: [string, string | undefined, string | undefined, boolean?][] = [
        ["description", description, prevOptions.description],
        ["keywords", keywords, prevOptions.keywords],
        ["author", author, prevOptions.author],
        ["robots", robots, prevOptions.robots],
        ["theme-color", themeColor, prevOptions.themeColor],
        // Open Graph
        ["og:title", ogTitle ?? title, prevOptions.ogTitle ?? prevOptions.title, true],
        [
            "og:description",
            ogDescription ?? description,
            prevOptions.ogDescription ?? prevOptions.description,
            true,
        ],
        ["og:image", ogImage, prevOptions.ogImage, true],
        ["og:url", ogUrl, prevOptions.ogUrl, true],
        ["og:type", ogType, prevOptions.ogType, true],
        // Twitter Card
        ["twitter:card", twitterCard, prevOptions.twitterCard],
        [
            "twitter:title",
            twitterTitle ?? ogTitle ?? title,
            prevOptions.twitterTitle ?? prevOptions.ogTitle ?? prevOptions.title,
        ],
        [
            "twitter:description",
            twitterDescription ?? ogDescription ?? description,
            prevOptions.twitterDescription ?? prevOptions.ogDescription ?? prevOptions.description,
        ],
        ["twitter:image", twitterImage ?? ogImage, prevOptions.twitterImage ?? prevOptions.ogImage],
    ];

    for (const [name, value, prevValue, isProperty] of metaMap) {
        if (value !== undefined && value !== prevValue) {
            setMetaTag(name, value, !!isProperty);
        }
    }

    // Link tags
    if (canonical !== undefined && canonical !== prevOptions.canonical) {
        setLinkTag("canonical", canonical);
    }

    if (icon !== undefined && icon !== prevOptions.icon) {
        setLinkTag("icon", icon);
        setLinkTag("apple-touch-icon", icon);
    }
}

/**
 * A hook that subscribes to HeadManager changes and applies
 * the merged head configuration to the DOM.
 * Should be called ONCE at the App root level.
 *
 * @param defaults - Fallback values for any field not provided by useDocumentHead calls.
 *
 * @example
 * ```tsx
 * // App.tsx
 * import { useHeadRenderer } from "@buildingai/hooks";
 *
 * function App() {
 *   useHeadRenderer({ title: "BuildingAI", description: "Default description" });
 *   return <RouterOutlet />;
 * }
 * ```
 */
export const useHeadRenderer = (options?: HeadRendererOptions): void => {
    const { titleTemplate, ...defaults } = options ?? {};
    const prevOptionsRef = useRef<DocumentHeadOptions>({});
    const defaultsRef = useRef(defaults);
    const templateRef = useRef(titleTemplate);
    defaultsRef.current = defaults;
    templateRef.current = titleTemplate;

    const applyRef = useRef(() => {
        const result = headManager.getMergedHead(defaultsRef.current);

        applyHead(result, prevOptionsRef.current, templateRef.current);
        prevOptionsRef.current = result.options;
    });

    // Subscribe to HeadManager changes
    useEffect(() => {
        applyRef.current();

        return headManager.subscribe(() => applyRef.current());
    }, []);

    // Re-apply when options change
    useEffect(() => {
        applyRef.current();
    }, [
        titleTemplate,
        defaults.title,
        defaults.description,
        defaults.keywords,
        defaults.icon,
        defaults.ogTitle,
        defaults.ogDescription,
        defaults.ogImage,
        defaults.ogUrl,
        defaults.ogType,
        defaults.twitterCard,
        defaults.twitterTitle,
        defaults.twitterDescription,
        defaults.twitterImage,
        defaults.canonical,
        defaults.robots,
        defaults.author,
        defaults.themeColor,
    ]);
};
