"use client";

import * as React from "react";

export type SettingsDialogContextValue<T = string> = {
    open: (page?: T) => void;
    close: () => void;
    navigate: (page: T) => void;
    isOpen: boolean;
    activePage: T;
};

export const SettingsDialogContext = React.createContext<SettingsDialogContextValue<any> | null>(
    null,
);

/**
 * Hook for imperative SettingsDialog usage.
 * Returns functions to open, close, and navigate the settings dialog.
 *
 * @example
 * ```tsx
 * const { open, close, navigate } = useSettingsDialog();
 *
 * // Open settings dialog
 * open();
 *
 * // Open settings dialog at a specific page
 * open("appearance");
 *
 * // Navigate to a different page while open
 * navigate("notifications");
 *
 * // Close the dialog
 * close();
 * ```
 */
export function useSettingsDialog() {
    const context = React.useContext(SettingsDialogContext);

    if (!context) {
        throw new Error("useSettingsDialog must be used within a SettingsDialogProvider");
    }

    return context;
}
