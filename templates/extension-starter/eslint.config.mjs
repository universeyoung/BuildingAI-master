import { config as baseConfig } from "@buildingai/eslint-config/base";
import { defineConfig } from "eslint/config";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";

/** @type {import("eslint").Linter.Config} */
export default defineConfig([
    ...baseConfig,
    {
        files: ["src/api/**/*.ts"],
        rules: {
            "no-undef": "off",
            // "@typescript-eslint/no-require-imports": "off",
            // "@typescript-eslint/no-explicit-any": "off",
            // "@typescript-eslint/no-floating-promises": "warn",
            // "@typescript-eslint/no-unsafe-return": "off",
            // "@typescript-eslint/no-unsafe-call": "off",
            // "@typescript-eslint/no-unsafe-argument": "off",
        },
    },
    {
        files: ["src/web/**/*.{ts,tsx}"],
        plugins: {
            "react-refresh": reactRefresh,
        },
        languageOptions: {
            ecmaVersion: 2020,
            globals: globals.browser,
            parserOptions: {
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            "react-refresh/only-export-components": "off",
        },
    },
]);
