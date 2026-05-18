import { ModelFeatureType, ModelType } from "@buildingai/ai-sdk";
import { BooleanNumber, Merchant, PayConfigPayType, PayVersion } from "@buildingai/constants";
import {
    Agent,
    AgentAnnotation,
    AgentChatMessage,
    AgentChatMessageFeedback,
    AgentChatRecord,
    AgentMemory,
    AiChatFeedback,
    AiChatMessage,
    AiChatRecord,
    AiChatToolCall,
    AiModel,
    AiProvider,
    DatasetMember,
    DatasetMemberApplication,
    Datasets,
    DatasetsChatMessage,
    DatasetsChatRecord,
    DatasetsDocument,
    DatasetsSegments,
    Dict,
    Menu,
    MenuSourceType,
    MenuType,
    Payconfig,
    Permission,
} from "@buildingai/db/entities";
import fse from "fs-extra";
import * as path from "path";
import type { EntityManager, Repository } from "typeorm";

import { BaseUpgradeScript, UpgradeContext } from "../../index";

/**
 * Menu item data structure
 */
interface MenuItem {
    id?: string;
    name: string;
    path?: string;
    icon?: string;
    permissionCode?: string;
    children?: MenuItem[];
    [key: string]: any;
}

/**
 * Model configuration data structure
 */
interface ModelConfig {
    model: string;
    label: string;
    model_type: ModelType;
    features: ModelFeatureType[];
    thinking?: boolean;
    enableThinkingParam?: boolean;
    model_properties: {
        context_size?: number;
        [key: string]: any;
    };
    enabled?: boolean;
}

/**
 * Provider configuration data structure
 */
interface ProviderConfig {
    provider: string;
    label: string;
    icon_url: string;
    supported_model_types: ModelType[];
    models: ModelConfig[];
}

class Upgrade extends BaseUpgradeScript {
    version = "26.0.0";

    async execute(context: UpgradeContext) {
        try {
            await context.dataSource.transaction(async (manager) => {
                await this.deleteOldAgentData(manager);
                await this.deleteOldChatRecordData(manager);
                await this.deleteOldDatasetData(manager);
                await this.updateConsoleMenu(manager);
                await this.resetBuiltInModels(manager);
                await this.resetFrontendMenu(manager);
            });

            await this.patchInstalledExtensions();
        } catch (error) {
            this.error("Upgrade to version 26.0.0 failed.", error);
            throw error;
        }
    }

    /**
     * Delete all old agent data
     */
    private async deleteOldAgentData(manager: EntityManager) {
        this.log("Starting to delete old agent data...");

        // Delete agent-related tables in correct order (child tables first)
        const agentChatMessageFeedbackRepo = manager.getRepository(AgentChatMessageFeedback);
        const agentChatMessageRepo = manager.getRepository(AgentChatMessage);
        const agentChatRecordRepo = manager.getRepository(AgentChatRecord);
        const agentAnnotationRepo = manager.getRepository(AgentAnnotation);
        const agentMemoryRepo = manager.getRepository(AgentMemory);
        const agentRepo = manager.getRepository(Agent);

        // Delete agent chat message feedback
        const feedbackCount = await agentChatMessageFeedbackRepo.count();
        if (feedbackCount > 0) {
            this.log(`Deleting ${feedbackCount} agent chat message feedback records...`);
            await manager.query("DELETE FROM ai_agent_chat_message_feedback");
            this.log("Agent chat message feedback deleted");
        }

        // Delete agent chat messages
        const messageCount = await agentChatMessageRepo.count();
        if (messageCount > 0) {
            this.log(`Deleting ${messageCount} agent chat messages...`);
            await manager.query("DELETE FROM ai_agent_chat_message");
            this.log("Agent chat messages deleted");
        }

        // Delete agent chat records
        const recordCount = await agentChatRecordRepo.count();
        if (recordCount > 0) {
            this.log(`Deleting ${recordCount} agent chat records...`);
            await manager.query("DELETE FROM ai_agent_chat_record");
            this.log("Agent chat records deleted");
        }

        // Delete agent annotations
        const annotationCount = await agentAnnotationRepo.count();
        if (annotationCount > 0) {
            this.log(`Deleting ${annotationCount} agent annotations...`);
            await manager.query("DELETE FROM ai_agent_annotation");
            this.log("Agent annotations deleted");
        }

        // Delete agent memories
        const memoryCount = await agentMemoryRepo.count();
        if (memoryCount > 0) {
            this.log(`Deleting ${memoryCount} agent memories...`);
            await manager.query("DELETE FROM ai_agent_memory");
            this.log("Agent memories deleted");
        }

        // Delete agent tags (many-to-many junction table)
        const agentTagsCount = await manager.query("SELECT COUNT(*) as count FROM ai_agent_tags");
        if (agentTagsCount[0]?.count > 0) {
            this.log(`Deleting ${agentTagsCount[0].count} agent tag relations...`);
            await manager.query("DELETE FROM ai_agent_tags");
            this.log("Agent tag relations deleted");
        }

        // Delete agents
        const agentCount = await agentRepo.count();
        if (agentCount > 0) {
            this.log(`Deleting ${agentCount} agents...`);
            await manager.query("DELETE FROM ai_agent");
            this.log("Agents deleted");
        }

        this.log("Old agent data deletion completed");
    }

    /**
     * Delete all old chat record data
     */
    private async deleteOldChatRecordData(manager: EntityManager) {
        this.log("Starting to delete old chat record data...");

        // Delete chat-related tables in correct order (child tables first)
        const chatToolCallRepo = manager.getRepository(AiChatToolCall);
        const chatFeedbackRepo = manager.getRepository(AiChatFeedback);
        const chatMessageRepo = manager.getRepository(AiChatMessage);
        const chatRecordRepo = manager.getRepository(AiChatRecord);

        // Delete chat tool calls
        const toolCallCount = await chatToolCallRepo.count();
        if (toolCallCount > 0) {
            this.log(`Deleting ${toolCallCount} chat tool calls...`);
            await manager.query("DELETE FROM ai_chat_tool_call");
            this.log("Chat tool calls deleted");
        }

        // Delete chat feedback
        const feedbackCount = await chatFeedbackRepo.count();
        if (feedbackCount > 0) {
            this.log(`Deleting ${feedbackCount} chat feedback records...`);
            await manager.query("DELETE FROM ai_chat_feedback");
            this.log("Chat feedback deleted");
        }

        // Delete chat messages
        const messageCount = await chatMessageRepo.count();
        if (messageCount > 0) {
            this.log(`Deleting ${messageCount} chat messages...`);
            await manager.query("DELETE FROM ai_chat_message");
            this.log("Chat messages deleted");
        }

        // Delete chat records
        const recordCount = await chatRecordRepo.count();
        if (recordCount > 0) {
            this.log(`Deleting ${recordCount} chat records...`);
            await manager.query("DELETE FROM ai_chat_record");
            this.log("Chat records deleted");
        }

        this.log("Old chat record data deletion completed");
    }

    /**
     * Delete all old dataset data
     */
    private async deleteOldDatasetData(manager: EntityManager) {
        this.log("Starting to delete old dataset data...");

        // Delete dataset-related tables in correct order (child tables first)
        const datasetsChatMessageRepo = manager.getRepository(DatasetsChatMessage);
        const datasetsChatRecordRepo = manager.getRepository(DatasetsChatRecord);
        const datasetsSegmentsRepo = manager.getRepository(DatasetsSegments);
        const datasetsDocumentRepo = manager.getRepository(DatasetsDocument);
        const datasetMemberApplicationRepo = manager.getRepository(DatasetMemberApplication);
        const datasetMemberRepo = manager.getRepository(DatasetMember);
        const datasetsRepo = manager.getRepository(Datasets);

        // Delete datasets chat messages
        const chatMessageCount = await datasetsChatMessageRepo.count();
        if (chatMessageCount > 0) {
            this.log(`Deleting ${chatMessageCount} dataset chat messages...`);
            await manager.query("DELETE FROM datasets_chat_message");
            this.log("Dataset chat messages deleted");
        }

        // Delete datasets chat records
        const chatRecordCount = await datasetsChatRecordRepo.count();
        if (chatRecordCount > 0) {
            this.log(`Deleting ${chatRecordCount} dataset chat records...`);
            await manager.query("DELETE FROM datasets_chat_record");
            this.log("Dataset chat records deleted");
        }

        // Delete datasets segments
        const segmentCount = await datasetsSegmentsRepo.count();
        if (segmentCount > 0) {
            this.log(`Deleting ${segmentCount} dataset segments...`);
            await manager.query("DELETE FROM datasets_segments");
            this.log("Dataset segments deleted");
        }

        // Delete datasets documents
        const documentCount = await datasetsDocumentRepo.count();
        if (documentCount > 0) {
            this.log(`Deleting ${documentCount} dataset documents...`);
            await manager.query("DELETE FROM datasets_documents");
            this.log("Dataset documents deleted");
        }

        // Delete dataset member applications
        const applicationCount = await datasetMemberApplicationRepo.count();
        if (applicationCount > 0) {
            this.log(`Deleting ${applicationCount} dataset member applications...`);
            await manager.query("DELETE FROM dataset_member_applications");
            this.log("Dataset member applications deleted");
        }

        // Delete dataset members
        const memberCount = await datasetMemberRepo.count();
        if (memberCount > 0) {
            this.log(`Deleting ${memberCount} dataset members...`);
            await manager.query("DELETE FROM dataset_members");
            this.log("Dataset members deleted");
        }

        // Delete dataset tags (many-to-many junction table)
        const datasetTagsCount = await manager.query("SELECT COUNT(*) as count FROM datasets_tags");
        if (datasetTagsCount[0]?.count > 0) {
            this.log(`Deleting ${datasetTagsCount[0].count} dataset tag relations...`);
            await manager.query("DELETE FROM datasets_tags");
            this.log("Dataset tag relations deleted");
        }

        // Delete datasets
        const datasetCount = await datasetsRepo.count();
        if (datasetCount > 0) {
            this.log(`Deleting ${datasetCount} datasets...`);
            await manager.query("DELETE FROM datasets");
            this.log("Datasets deleted");
        }

        this.log("Old dataset data deletion completed");
    }

    /**
     * Update console menu - clear existing menus and reload from menu.json
     */
    private async updateConsoleMenu(manager: EntityManager) {
        const menuRepository = manager.getRepository(Menu);
        const permissionRepository = manager.getRepository(Permission);

        // Load valid permission codes
        const permissions = await permissionRepository.find({ select: ["code"] });
        const validPermissionCodes = new Set(permissions.map((p) => p.code));
        this.log(`Loaded ${validPermissionCodes.size} valid permission codes`);

        // Clear existing menu data
        const existingMenusCount = await menuRepository.count();
        if (existingMenusCount > 0) {
            this.log(`Found ${existingMenusCount} existing menu records, clearing...`);
            await menuRepository.clear();
            this.log("Existing menu data cleared");
        }

        // Load menu configuration
        const menuData = await this.loadMenuConfig();

        // Save menu tree
        await this.saveMenuTree(menuRepository, menuData, null, validPermissionCodes);

        this.log("Console menu reset completed");
    }

    /**
     * Load menu configuration from menu.json
     */
    private async loadMenuConfig(): Promise<MenuItem[]> {
        const possiblePaths = [
            // Development environment path (cwd is packages/api)
            path.join(process.cwd(), "../@buildingai/db/src/seeds/data/menu.json"),
            // Compiled path (from upgrade/dist/scripts/26.0.0/ to db/dist/seeds/data/)
            path.join(__dirname, "../../../../db/dist/seeds/data/menu.json"),
        ];

        for (const possiblePath of possiblePaths) {
            if (await fse.pathExists(possiblePath)) {
                this.log(`Loading menu config from: ${possiblePath}`);
                return await fse.readJson(possiblePath);
            }
        }

        throw new Error("Unable to find menu.json file");
    }

    /**
     * Recursively save menu tree
     */
    private async saveMenuTree(
        menuRepository: Repository<Menu>,
        menuItems: MenuItem[],
        parentId: string | null = null,
        validPermissionCodes: Set<string>,
    ): Promise<void> {
        for (const menuItem of menuItems) {
            // Extract children
            const { children, ...menuData } = menuItem;

            // Set parent ID
            menuData.parentId = parentId;

            // Validate permissionCode against existing permissions
            if (
                menuData.permissionCode === "" ||
                menuData.permissionCode === undefined ||
                !validPermissionCodes.has(menuData.permissionCode)
            ) {
                delete menuData.permissionCode;
            }

            // Save current menu item
            const savedMenu = await menuRepository.save(menuData);

            // Recursively save children if any
            if (children && children.length > 0) {
                await this.saveMenuTree(
                    menuRepository,
                    children,
                    savedMenu.id,
                    validPermissionCodes,
                );
            }
        }
    }

    /**
     * Reset built-in AI providers and models
     */
    private async resetBuiltInModels(manager: EntityManager) {
        const providerRepository = manager.getRepository(AiProvider);
        const modelRepository = manager.getRepository(AiModel);

        // Delete all built-in models
        const builtInModelsCount = await modelRepository.count({ where: { isBuiltIn: true } });
        if (builtInModelsCount > 0) {
            this.log(`Found ${builtInModelsCount} built-in models, deleting...`);
            await modelRepository.delete({ isBuiltIn: true });
            this.log("Built-in models deleted");
        }

        // Delete all built-in providers
        const builtInProvidersCount = await providerRepository.count({
            where: { isBuiltIn: true },
        });
        if (builtInProvidersCount > 0) {
            this.log(`Found ${builtInProvidersCount} built-in providers, deleting...`);
            await providerRepository.delete({ isBuiltIn: true });
            this.log("Built-in providers deleted");
        }

        // Load model configuration
        const modelConfigData = await this.loadModelConfig();

        if (!modelConfigData || !Array.isArray(modelConfigData.configs)) {
            throw new Error("Invalid model-config.json format, missing configs array");
        }

        const providerConfigs = modelConfigData.configs;
        this.log(`Loaded ${providerConfigs.length} provider configurations from file`);

        let createdProviders = 0;
        let createdModels = 0;

        // Import providers and models
        for (const config of providerConfigs) {
            // Create provider
            const providerData = {
                provider: config.provider,
                name: config.label,
                iconUrl: config.icon_url,
                isBuiltIn: true,
                isActive: false,
                supportedModelTypes: config.supported_model_types,
                sortOrder: 0,
            };

            const provider = await providerRepository.save(providerData);
            this.log(`Created AI provider: ${provider.name}`);
            createdProviders++;

            // Create models for this provider
            for (const modelConfig of config.models) {
                // Transform model_properties to frontend-compatible array format
                const transformedModelConfig: Array<any> = [];

                if (modelConfig.model_properties) {
                    Object.keys(modelConfig.model_properties).forEach((key) => {
                        const value = modelConfig.model_properties[key];
                        transformedModelConfig.push({
                            field: key,
                            title: key,
                            description: key,
                            value: value,
                            enable: true,
                        });
                    });
                }

                const modelData: Partial<AiModel> = {
                    providerId: provider.id,
                    name: modelConfig.label,
                    model: modelConfig.model,
                    modelType: modelConfig.model_type,
                    features: Array.isArray(modelConfig.features) ? modelConfig.features : [],
                    thinking: modelConfig.thinking || false,
                    enableThinkingParam: modelConfig.enableThinkingParam || false,
                    isActive: modelConfig.enabled === true,
                    isBuiltIn: true,
                    sortOrder: 0,
                    modelConfig: transformedModelConfig as any,
                };

                await modelRepository.save(modelData);
                createdModels++;
            }
        }

        this.log(
            `Built-in models reset completed: created ${createdProviders} providers, ${createdModels} models`,
        );
    }

    /**
     * Load model configuration from model-config.json
     */
    private async loadModelConfig(): Promise<{ configs: ProviderConfig[] }> {
        const possiblePaths = [
            // Development environment path (cwd is packages/api)
            path.join(process.cwd(), "../@buildingai/db/src/seeds/data/model-config.json"),
            // Compiled path (from upgrade/dist/scripts/26.0.0/ to db/dist/seeds/data/)
            path.join(__dirname, "../../../../db/dist/seeds/data/model-config.json"),
        ];

        for (const possiblePath of possiblePaths) {
            if (await fse.pathExists(possiblePath)) {
                this.log(`Loading model config from: ${possiblePath}`);
                return await fse.readJson(possiblePath);
            }
        }

        throw new Error("Unable to find model-config.json file");
    }

    /**
     * Reset frontend menu configuration
     */
    private async resetFrontendMenu(manager: EntityManager) {
        const dictRepository = manager.getRepository(Dict);

        const DICT_GROUP = "decorate";
        const DICT_KEY = "menu-config";

        // Check if menu configuration exists
        const existing = await dictRepository.findOne({
            where: { key: DICT_KEY, group: DICT_GROUP },
        });

        // Load menu configuration from file
        const menuConfig = await this.loadWebMenuConfig();

        if (existing) {
            // Update existing configuration
            await dictRepository.update(existing.id, {
                value: JSON.stringify(menuConfig),
                description: "前台菜单配置",
                isEnabled: true,
                sort: 0,
            });
            this.log("Frontend menu configuration updated");
        } else {
            // Create new configuration
            const config = dictRepository.create({
                key: DICT_KEY,
                value: JSON.stringify(menuConfig),
                group: DICT_GROUP,
                description: "前台菜单配置",
                isEnabled: true,
                sort: 0,
            });
            await dictRepository.save(config);
            this.log("Frontend menu configuration created");
        }

        this.log("Frontend menu reset completed");
    }

    /**
     * Load web menu configuration from web-menu.json
     */
    private async loadWebMenuConfig(): Promise<any> {
        const possiblePaths = [
            // Development environment path (cwd is packages/api)
            path.join(process.cwd(), "../@buildingai/db/src/seeds/data/web-menu.json"),
            // Compiled path (from upgrade/dist/scripts/26.0.0/ to db/dist/seeds/data/)
            path.join(__dirname, "../../../../db/dist/seeds/data/web-menu.json"),
        ];

        for (const possiblePath of possiblePaths) {
            if (await fse.pathExists(possiblePath)) {
                this.log(`Loading web menu config from: ${possiblePath}`);
                return await fse.readJson(possiblePath);
            }
        }

        throw new Error("Unable to find web-menu.json file");
    }

    /**
     * Patch legacy dependencies for all installed extensions in the extensions directory.
     * Ensures compatibility with current platform after version upgrade.
     */
    private async patchInstalledExtensions(): Promise<void> {
        const extensionsDir = path.join(process.cwd(), "..", "..", "extensions");

        if (!(await fse.pathExists(extensionsDir))) {
            this.log("Extensions directory not found, skipping patch");
            return;
        }

        const entries = await fse.readdir(extensionsDir, { withFileTypes: true });
        const extensionDirs = entries.filter((entry) => entry.isDirectory());

        if (extensionDirs.length === 0) {
            this.log("No installed extensions found, skipping patch");
            return;
        }

        this.log(
            `Found ${extensionDirs.length} installed extensions, patching legacy dependencies...`,
        );

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

        let patchedCount = 0;

        for (const entry of extensionDirs) {
            const pluginDir = path.join(extensionsDir, entry.name);
            const packageJsonPath = path.join(pluginDir, "package.json");

            if (!(await fse.pathExists(packageJsonPath))) {
                continue;
            }

            try {
                const packageJson = await fse.readJson(packageJsonPath);
                const depFields = ["dependencies", "devDependencies"] as const;
                let modified = false;

                for (const field of depFields) {
                    if (!packageJson[field]) continue;

                    // Remove deprecated packages
                    for (const pkg of patchRules.remove) {
                        if (packageJson[field][pkg]) {
                            delete packageJson[field][pkg];
                            this.log(
                                `[${entry.name}] Removed legacy dependency: ${pkg} from ${field}`,
                            );
                            modified = true;
                        }
                    }

                    // Rename updated packages
                    for (const { from, to } of patchRules.update) {
                        if (packageJson[field][from]) {
                            packageJson[field][to] = packageJson[field][from];
                            delete packageJson[field][from];
                            this.log(
                                `[${entry.name}] Renamed dependency: ${from} -> ${to} in ${field}`,
                            );
                            modified = true;
                        }
                    }
                }

                if (modified) {
                    await fse.writeJson(packageJsonPath, packageJson, { spaces: 4 });
                }

                // Delete nuxt.config.ts if exists
                const nuxtConfigPath = path.join(pluginDir, "nuxt.config.ts");
                if (await fse.pathExists(nuxtConfigPath)) {
                    await fse.remove(nuxtConfigPath);
                    this.log(`[${entry.name}] Removed legacy file: nuxt.config.ts`);
                    modified = true;
                }

                // Replace tsconfig.web.json with fixed template
                const tsconfigWebPath = path.join(pluginDir, "tsconfig.web.json");
                if (await fse.pathExists(tsconfigWebPath)) {
                    const tsconfigWebContent = {
                        compilerOptions: {
                            tsBuildInfoFile: "./.temp/tsconfig.web.tsbuildinfo",
                        },
                    };
                    await fse.writeJson(tsconfigWebPath, tsconfigWebContent, { spaces: 4 });
                    this.log(`[${entry.name}] Replaced tsconfig.web.json with fixed template`);
                    modified = true;
                }

                if (modified) {
                    patchedCount++;
                }
            } catch (error) {
                this.error(`Failed to patch extension: ${entry.name}`, error);
            }
        }

        this.log(
            `Extension legacy dependencies patch completed: ${patchedCount}/${extensionDirs.length} extensions patched`,
        );
    }
}

export default Upgrade;
