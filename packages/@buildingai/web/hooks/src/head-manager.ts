import type { DocumentHeadOptions } from "./use-document-head";

interface HeadEntry {
    id: string;
    options: DocumentHeadOptions;
}

type HeadChangeListener = () => void;

export interface MergedHeadResult {
    options: DocumentHeadOptions;
    /** Whether the title was explicitly set by a useDocumentHead entry (not just defaults). */
    hasTitleOverride: boolean;
}

/**
 * Centralized head state manager using a stack-based registry.
 * Components register their head config on mount and unregister on unmount.
 * Later entries (e.g. Page) override earlier ones (e.g. Layout) via reduce merge.
 */
class HeadManager {
    private entries: HeadEntry[] = [];
    private listeners = new Set<HeadChangeListener>();

    add(id: string, options: DocumentHeadOptions): void {
        this.entries.push({ id, options });
        this.notify();
    }

    update(id: string, options: DocumentHeadOptions): void {
        const index = this.entries.findIndex((e) => e.id === id);

        if (index !== -1) {
            this.entries[index] = { id, options };
            this.notify();
        }
    }

    remove(id: string): void {
        this.entries = this.entries.filter((e) => e.id !== id);
        this.notify();
    }

    subscribe(listener: HeadChangeListener): () => void {
        this.listeners.add(listener);

        return () => {
            this.listeners.delete(listener);
        };
    }

    /**
     * Merge all registered entries in stack order (later overrides earlier).
     * For each field, a non-undefined value from a later entry wins.
     * Falls back to defaults for any field not provided by any entry.
     */
    getMergedHead(defaults: DocumentHeadOptions = {}): MergedHeadResult {
        const hasTitleOverride = this.entries.some((e) => e.options.title !== undefined);

        const options = this.entries.reduce<DocumentHeadOptions>(
            (merged, { options }) => {
                const result = { ...merged };

                for (const key of Object.keys(options) as (keyof DocumentHeadOptions)[]) {
                    if (options[key] !== undefined) {
                        result[key] = options[key];
                    }
                }

                return result;
            },
            { ...defaults },
        );

        return { options, hasTitleOverride };
    }

    private notify(): void {
        for (const listener of this.listeners) {
            listener();
        }
    }
}

export const headManager = new HeadManager();
