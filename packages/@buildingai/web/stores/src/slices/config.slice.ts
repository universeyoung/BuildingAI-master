import type { WebsiteConfig } from "@buildingai/web-types";
import type { StateCreator } from "zustand";

import { createStore } from "../create-store";

export interface ConfigState {
    websiteConfig?: WebsiteConfig;
    isInitialized?: boolean;
}

export interface ConfigActions {
    setWebsiteConfig: (websiteConfig?: WebsiteConfig) => void;
    setIsInitialized: (isInitialized: boolean) => void;
}

export type ConfigSlice = {
    config: ConfigState;
    configActions: ConfigActions;
};

export const createConfigSlice: StateCreator<ConfigSlice, [], [], ConfigSlice> = (set) => ({
    config: {
        websiteConfig: undefined,
        isInitialized: undefined,
    },
    configActions: {
        setWebsiteConfig: (websiteConfig) =>
            set((s) => ({ config: { ...s.config, websiteConfig } })),
        setIsInitialized: (isInitialized) =>
            set((s) => ({ config: { ...s.config, isInitialized } })),
    },
});

export const useConfigStore = createStore<ConfigSlice>(createConfigSlice, {
    persist: {
        name: "config",
        partialize: (state) => ({ config: state.config }),
    },
});
