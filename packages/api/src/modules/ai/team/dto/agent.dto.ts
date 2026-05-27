import { LocalAgent } from "@buildingai/db/entities";

export interface AgentManifest {
    name: string;
    version: string;
    description?: string;
    capabilities?: {
        skills?: Array<{ name: string; path?: string; description?: string; tags?: string[] }>;
        tools?: Array<{ name: string; path?: string; type?: string }>;
    };
    model?: {
        preferred?: { name: string; provider: string };
        fallbacks?: Array<{ model: string; provider: string }>;
    };
    maxConcurrent?: number;
}

export interface AgentScanResult {
    loaded: LocalAgent[];
    warnings: Array<{ path: string; reason: string }>;
}

export interface HotReloadResult {
    added: LocalAgent[];
    removed: string[];
    updated: LocalAgent[];
}
