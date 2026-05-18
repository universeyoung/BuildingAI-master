import { defineExtensionViteConfig } from "@buildingai/web-core/vite/extension";

import packageJson from "./package.json";

export default defineExtensionViteConfig(packageJson, {
    server: {
        open: true,
    },
});
