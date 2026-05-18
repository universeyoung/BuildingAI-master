import { useWebsiteConfigQuery } from "@buildingai/services/shared";
import { useConfigStore } from "@buildingai/stores";
import { useEffect } from "react";

const THEME_COLOR_STORAGE_KEY = "buildingai-client-theme-color";

export const useRefreshWebsiteConfig = (manualOnly: boolean = false) => {
    const { setWebsiteConfig } = useConfigStore((state) => state.configActions);

    const { data, refetch, isFetching } = useWebsiteConfigQuery({
        enabled: !manualOnly,
    });

    useEffect(() => {
        if (data) {
            setWebsiteConfig(data);

            if (typeof window !== "undefined" && data.webinfo?.theme) {
                const storedTheme = localStorage.getItem(THEME_COLOR_STORAGE_KEY);
                if (!storedTheme) {
                    localStorage.setItem(THEME_COLOR_STORAGE_KEY, data.webinfo.theme);
                    window.dispatchEvent(
                        new CustomEvent("theme-color-change", { detail: data.webinfo.theme }),
                    );
                }
            }
        }
    }, [data, setWebsiteConfig]);

    return { refreshConfig: refetch, isFetching, websiteConfig: data };
};
