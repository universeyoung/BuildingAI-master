import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * @typedef {Record<string, any>} JsonObject
 */

/**
 * Check whether a file system path exists.
 * @param {string} p
 * @returns {Promise<boolean>}
 */
async function pathExists(p) {
    try {
        await fs.access(p);
        return true;
    } catch {
        return false;
    }
}

/**
 * Read and parse JSON file.
 * @param {string} filePath
 * @returns {Promise<JsonObject>}
 */
async function readJson(filePath) {
    const raw = await fs.readFile(filePath, "utf-8");
    return /** @type {JsonObject} */ (JSON.parse(raw));
}

/**
 * Write JSON file with stable 4-space formatting.
 * @param {string} filePath
 * @param {JsonObject} data
 * @returns {Promise<void>}
 */
async function writeJson(filePath, data) {
    const content = `${JSON.stringify(data, null, 4)}\n`;
    await fs.writeFile(filePath, content, "utf-8");
}

/**
 * Patch legacy dependency fields (dependencies/devDependencies) in a package.json object.
 * Mirrors the logic from `ExtensionOperationService#patchLegacyDependencies`.
 * @param {JsonObject} packageJson
 * @returns {{ modified: boolean }}
 */
function patchLegacyDepsInPackageJson(packageJson) {
    const patchRules = {
        remove: [
            "@buildingai/i18n-config",
            "@buildingai/nuxt",
            "@buildingai/upload",
            "@buildingai/layouts",
            "@buildingai/api",
        ],
        update: [{ from: "@buildingai/service", to: "@buildingai/services" }],
    };

    /** @type {Array<"dependencies"|"devDependencies">} */
    const depFields = ["dependencies", "devDependencies"];

    let modified = false;

    for (const field of depFields) {
        const deps = packageJson[field];
        if (!deps || typeof deps !== "object") continue;

        for (const pkg of patchRules.remove) {
            if (deps[pkg]) {
                delete deps[pkg];
                modified = true;
            }
        }

        for (const { from, to } of patchRules.update) {
            if (deps[from]) {
                deps[to] = deps[from];
                delete deps[from];
                modified = true;
            }
        }
    }

    return { modified };
}

/**
 * Patch a single extension directory in-place:
 * - patch legacy deps in package.json
 * - delete nuxt.config.ts if exists
 * - replace tsconfig.web.json with a fixed template if exists
 *
 * @param {string} extensionDir
 * @returns {Promise<{ modified: boolean }>}
 */
async function patchExtensionDir(extensionDir) {
    const packageJsonPath = path.join(extensionDir, "package.json");
    if (!(await pathExists(packageJsonPath))) return { modified: false };

    let modified = false;

    // 1) Patch package.json deps
    try {
        const packageJson = await readJson(packageJsonPath);
        const depPatch = patchLegacyDepsInPackageJson(packageJson);
        if (depPatch.modified) {
            await writeJson(packageJsonPath, packageJson);
            modified = true;
        }
    } catch (error) {
        console.warn(`[legacy-patch] Skip invalid package.json: ${packageJsonPath}`);
        console.warn(
            `[legacy-patch] Reason: ${error instanceof Error ? error.message : String(error)}`,
        );
        return { modified: false };
    }

    // 2) Delete nuxt.config.ts if exists
    const nuxtConfigPath = path.join(extensionDir, "nuxt.config.ts");
    if (await pathExists(nuxtConfigPath)) {
        await fs.rm(nuxtConfigPath, { force: true });
        modified = true;
    }

    // 3) Replace tsconfig.web.json with fixed template
    const tsconfigWebPath = path.join(extensionDir, "tsconfig.web.json");
    if (await pathExists(tsconfigWebPath)) {
        const tsconfigWebContent = {
            compilerOptions: {
                tsBuildInfoFile: "./.temp/tsconfig.web.tsbuildinfo",
            },
        };
        await writeJson(tsconfigWebPath, tsconfigWebContent);
        modified = true;
    }

    return { modified };
}

/**
 * Get direct child directories under a given base directory.
 * @param {string} baseDir
 * @returns {Promise<string[]>}
 */
async function listChildDirectories(baseDir) {
    const entries = await fs.readdir(baseDir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => path.join(baseDir, e.name));
}

/**
 * Main entry.
 * @returns {Promise<void>}
 */
async function main() {
    const rootDir = process.cwd();
    const extensionsDir = path.join(rootDir, "extensions");

    if (!(await pathExists(extensionsDir))) {
        console.log(`[legacy-patch] extensions directory not found: ${extensionsDir}`);
        return;
    }

    const extensionDirs = await listChildDirectories(extensionsDir);

    let scanned = 0;
    let patched = 0;

    for (const dir of extensionDirs) {
        scanned += 1;
        const { modified } = await patchExtensionDir(dir);
        if (modified) {
            patched += 1;
            console.log(`[legacy-patch] Patched: ${path.relative(rootDir, dir)}`);
        }
    }

    console.log(
        `[legacy-patch] Done. scanned=${scanned}, patched=${patched}, base=${path.relative(rootDir, extensionsDir)}`,
    );
}

await main();
