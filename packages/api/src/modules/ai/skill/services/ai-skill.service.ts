import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { readFileSync, readdirSync, statSync, existsSync, writeFileSync, mkdirSync } from "fs";
import { join, resolve, extname } from "path";
import { spawn } from "child_process";
import { promisify } from "util";

const exec = promisify((require("child_process").exec));

/**
 * 技能元数据接口 - 三层架构元数据层
 */
export interface SkillMetadata {
    name: string;
    description: string;
    version?: string;
    author?: string;
    tags?: string[];
    permissions?: string[];
    parameters?: SkillParameter[];
    returnType?: SkillReturnType;
    type?: string;
    keywords?: string[];
    intentPatterns?: string[];
    filePathPatterns?: string[];
    contentPatterns?: string[];
    priority?: string;
    enforcement?: string;
    license?: string;
}

/**
 * 技能参数定义
 */
export interface SkillParameter {
    name: string;
    type: string;
    description: string;
    required?: boolean;
    default?: string;
}

/**
 * 技能返回值定义
 */
export interface SkillReturnType {
    type: string;
    properties: Record<string, { type: string; description?: string }>;
}

/**
 * 技能数据结构
 */
export interface Skill {
    name: string;
    description: string;
    version?: string;
    author?: string;
    tags?: string[];
    permissions?: string[];
    parameters?: SkillParameter[];
    returnType?: SkillReturnType;
    type: string;
    keywords?: string[];
    intentPatterns?: string[];
    filePathPatterns?: string[];
    contentPatterns?: string[];
    priority: string;
    enforcement: string;
    license?: string;
    content?: string;
    metadata: SkillMetadata;
    scripts?: SkillScript[];
    references?: SkillReference[];
    assets?: SkillAsset[];
    filePath: string;
}

/**
 * 技能脚本
 */
export interface SkillScript {
    name: string;
    path: string;
    type: "python" | "bash" | "node" | "unknown";
    description?: string;
}

/**
 * 技能引用
 */
export interface SkillReference {
    name: string;
    path: string;
    description?: string;
}

/**
 * 技能资产
 */
export interface SkillAsset {
    name: string;
    path: string;
    type: string;
}

/**
 * 技能执行结果 - 标准输出格式
 */
export interface SkillResult {
    status: "success" | "error" | "partial";
    data: Record<string, any>;
    message: string;
    metadata: {
        skillName: string;
        executionTime?: number;
        source?: string;
        confidence?: number;
    };
}

/**
 * 指令层结构
 */
export interface SkillInstructions {
    steps?: string[];
    constraints?: string[];
    errorHandling?: string[];
    examples?: string[];
}

/**
 * 匹配的技能结果
 */
export interface MatchedSkill {
    skill: Skill;
    matchType: "keyword" | "intent" | "filePath" | "content" | "name" | "tag";
    confidence: number;
    matchedText?: string;
}

/**
 * 技能服务
 * 
 * 基于三层架构实现技能包管理：
 * 1. 元数据层 - 启动时加载，用于技能发现与匹配
 * 2. 指令层 - 匹配成功后加载，指导AI执行任务
 * 3. 资源引用层 - 需要时加载，提供辅助执行能力
 */
@Injectable()
export class AiSkillService implements OnModuleInit {
    private readonly logger = new Logger(AiSkillService.name);
    private readonly skillsDirs: string[];
    private readonly exportDir: string;
    private skillsCache: Map<string, Skill> = new Map();
    private instructionsCache: Map<string, SkillInstructions> = new Map();

    constructor() {
        const cwd = process.cwd();
        this.skillsDirs = [
            join(cwd, "skills"),
            join(cwd, "..", "skills"),
            join(resolve(cwd, ".."), "skills"),
            join(cwd, "packages", "api", "skills"),
            "/buildingai/skills",
            "/buildingai/packages/api/skills",
        ];
        this.exportDir = join(cwd, "skills-export");
    }

    async onModuleInit() {
        await this.loadAllSkills();
        await this.exportSkillsToJson();
    }

    /**
     * 获取所有有效的技能目录
     */
    private getAllValidSkillsDirs(): string[] {
        const validDirs: string[] = [];
        
        this.logger.log(`Current working directory: ${process.cwd()}`);
        this.logger.log(`Searching for skills directories...`);
        
        for (const dir of this.skillsDirs) {
            const exists = existsSync(dir);
            this.logger.log(`  Checking: ${dir} - ${exists ? "EXISTS" : "not found"}`);
            if (exists && statSync(dir).isDirectory()) {
                const entries = readdirSync(dir, { withFileTypes: true });
                const subdirs = entries.filter(e => e.isDirectory()).map(e => e.name);
                this.logger.log(`  Found subdirectories: ${subdirs.join(", ")}`);
                validDirs.push(dir);
            }
        }
        
        this.logger.log(`Found ${validDirs.length} valid skills directories`);
        return validDirs;
    }

    /**
     * 加载所有技能
     */
    async loadAllSkills(): Promise<void> {
        try {
            const skillsDirs = this.getAllValidSkillsDirs();
            
            if (skillsDirs.length === 0) {
                this.logger.warn("No skills directories found");
                this.createDefaultSkills();
                return;
            }

            this.skillsCache.clear();

            for (const skillsDir of skillsDirs) {
                const skillNames = this.getSkillDirectoryNames(skillsDir);
                this.logger.log(`Loading ${skillNames.length} skills from ${skillsDir}`);
                
                for (const skillName of skillNames) {
                    if (this.skillsCache.has(skillName)) {
                        this.logger.log(`  Skipping duplicate skill: ${skillName}`);
                        continue;
                    }
                    
                    const skill = await this.loadSkill(skillName, skillsDir);
                    if (skill) {
                        this.skillsCache.set(skill.name, skill);
                        this.logger.log(`  Loaded skill: ${skill.name} (${skill.version || "1.0.0"})`);
                    }
                }
            }

            this.logger.log(`Total loaded skills: ${this.skillsCache.size}`);
        } catch (error: any) {
            this.logger.error(`Failed to load skills: ${error.message}`);
        }
    }

    /**
     * 创建默认技能示例
     */
    private createDefaultSkills(): void {
        this.logger.log("Creating default skills directory...");
        
        try {
            const defaultDir = join(process.cwd(), "skills");
            mkdirSync(defaultDir, { recursive: true });

            const defaultSkill = {
                name: "通用技能",
                description: "通用技能指南，包含日常任务处理的基本方法",
                type: "general",
                keywords: ["技能", "帮助", "指南", "任务", "操作"],
                intentPatterns: ["如何.*", "怎么.*", "如何做.*", "怎样.*"],
                priority: "medium",
                enforcement: "suggest",
                content: `# 通用技能指南

欢迎使用技能系统！

## 可用技能

### 搜索技能
使用 \`searchSkills\` 工具搜索相关技能。

### 获取详情
使用 \`getSkillDetails\` 获取技能详细内容。

## 使用示例

- 搜索: \`搜索与前端开发相关的技能\`
- 获取详情: \`获取技能 前端开发\`
`
            };

            const skillDir = join(defaultDir, "general-skill");
            mkdirSync(skillDir, { recursive: true });
            
            const skillContent = `---
name: ${defaultSkill.name}
description: ${defaultSkill.description}
type: ${defaultSkill.type}
keywords: ${JSON.stringify(defaultSkill.keywords)}
intent_patterns: ${JSON.stringify(defaultSkill.intentPatterns)}
priority: ${defaultSkill.priority}
enforcement: ${defaultSkill.enforcement}
version: "1.0.0"
author: BuildingAI
tags: [general, help, guide]
---

${defaultSkill.content}`;

            writeFileSync(join(skillDir, "SKILL.md"), skillContent);
            this.logger.log("Created default skill: general-skill");
        } catch (error: any) {
            this.logger.error(`Failed to create default skills: ${error.message}`);
        }
    }

    /**
     * 获取技能目录名称列表
     */
    private getSkillDirectoryNames(skillsDir: string): string[] {
        try {
            const entries = readdirSync(skillsDir, { withFileTypes: true });
            return entries
                .filter((entry) => entry.isDirectory())
                .map((entry) => entry.name);
        } catch {
            return [];
        }
    }

    /**
     * 加载单个技能 - 三层架构实现
     * 1. 元数据层 - 立即加载
     * 2. 指令层 - 首次访问时加载
     * 3. 资源引用层 - 按需加载
     */
    async loadSkill(skillName: string, skillsDir: string): Promise<Skill | null> {
        const skillPath = join(skillsDir, skillName);
        const skillMdPath = join(skillPath, "SKILL.md");

        if (!statSync(skillMdPath, { throwIfNoEntry: false })?.isFile()) {
            this.logger.warn(`Skill file not found: ${skillMdPath}`);
            return null;
        }

        try {
            const content = readFileSync(skillMdPath, "utf-8");
            const { metadata, body } = this.parseSkillFile(content);

            const scripts = this.scanScripts(skillPath);
            const references = this.scanReferences(skillPath);
            const assets = this.scanAssets(skillPath);

            const extractedKeywords = this.extractKeywords(metadata, body);

            const skill: Skill = {
                name: metadata.name || skillName,
                description: metadata.description || this.extractDescription(body),
                version: metadata.version,
                author: metadata.author,
                tags: metadata.tags,
                permissions: metadata.permissions,
                parameters: metadata.parameters,
                returnType: metadata.returnType,
                type: metadata.type || "domain",
                keywords: extractedKeywords,
                intentPatterns: metadata.intentPatterns,
                filePathPatterns: metadata.filePathPatterns,
                contentPatterns: metadata.contentPatterns,
                priority: metadata.priority || "medium",
                enforcement: metadata.enforcement || "suggest",
                license: metadata.license,
                metadata,
                content: body,
                scripts,
                references,
                assets,
                filePath: skillMdPath,
            };

            return skill;
        } catch (error: any) {
            this.logger.error(`Failed to load skill ${skillName}: ${error.message}`);
            return null;
        }
    }

    /**
     * 扫描脚本文件
     */
    private scanScripts(skillPath: string): SkillScript[] {
        const scripts: SkillScript[] = [];
        const scriptsDir = join(skillPath, "scripts");

        try {
            if (!existsSync(scriptsDir)) return scripts;

            const entries = readdirSync(scriptsDir, { withFileTypes: true });

            for (const entry of entries) {
                if (entry.isFile() && !entry.name.startsWith("__")) {
                    const ext = extname(entry.name).toLowerCase();
                    let type: "python" | "bash" | "node" | "unknown" = "unknown";

                    if (ext === ".py") type = "python";
                    else if (ext === ".sh") type = "bash";
                    else if (ext === ".js" || ext === ".ts") type = "node";

                    scripts.push({
                        name: entry.name.replace(ext, ""),
                        path: join(scriptsDir, entry.name),
                        type,
                        description: this.getScriptDescription(entry.name, type),
                    });
                }
            }
        } catch {
            // 忽略不存在的目录
        }

        return scripts;
    }

    /**
     * 获取脚本描述
     */
    private getScriptDescription(scriptName: string, type: string): string {
        const baseName = scriptName.replace(/\.(py|sh|js|ts)$/, "").replace(/[-_]/g, " ");
        return `执行 ${baseName} (${type})`;
    }

    /**
     * 扫描引用文件
     */
    private scanReferences(skillPath: string): SkillReference[] {
        const references: SkillReference[] = [];
        const refsDir = join(skillPath, "references");

        try {
            if (!existsSync(refsDir)) return references;

            const entries = readdirSync(refsDir, { withFileTypes: true });

            for (const entry of entries) {
                if (entry.isFile() && (entry.name.endsWith(".md") || entry.name.endsWith(".txt"))) {
                    references.push({
                        name: entry.name.replace(/\.(md|txt)$/, ""),
                        path: join(refsDir, entry.name),
                        description: `参考文档: ${entry.name}`,
                    });
                }
            }
        } catch {
            // 忽略不存在的目录
        }

        return references;
    }

    /**
     * 扫描资产文件
     */
    private scanAssets(skillPath: string): SkillAsset[] {
        const assets: SkillAsset[] = [];
        const assetsDir = join(skillPath, "assets");

        try {
            if (!existsSync(assetsDir)) return assets;

            const scanDir = (dir: string, prefix: string = "") => {
                const entries = readdirSync(dir, { withFileTypes: true });

                for (const entry of entries) {
                    const fullPath = join(dir, entry.name);
                    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

                    if (entry.isDirectory()) {
                        scanDir(fullPath, relativePath);
                    } else if (entry.isFile()) {
                        const ext = extname(entry.name).toLowerCase();
                        let type = "file";

                        if ([".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico"].includes(ext)) {
                            type = "image";
                        } else if ([".txt", ".md"].includes(ext)) {
                            type = "document";
                        } else if ([".json", ".yaml", ".yml"].includes(ext)) {
                            type = "config";
                        } else if ([".zip", ".tar", ".gz", ".tgz"].includes(ext)) {
                            type = "archive";
                        }

                        assets.push({
                            name: relativePath,
                            path: fullPath,
                            type,
                        });
                    }
                }
            };

            scanDir(assetsDir);
        } catch {
            // 忽略不存在的目录
        }

        return assets;
    }

    /**
     * 从技能内容中提取关键词
     */
    private extractKeywords(metadata: SkillMetadata, content: string): string[] {
        const keywords = new Set<string>();

        if (metadata.keywords && metadata.keywords.length > 0) {
            metadata.keywords.forEach(k => keywords.add(k.toLowerCase()));
        }

        if (metadata.tags && metadata.tags.length > 0) {
            metadata.tags.forEach(t => keywords.add(t.toLowerCase()));
        }

        if (metadata.name) {
            metadata.name.split(/[-_ ]+/).forEach(part => {
                if (part.length >= 2) {
                    keywords.add(part.toLowerCase());
                }
            });
        }

        if (content) {
            const titlePattern = /^#{1,2}\s+(.+)$/gm;
            let match;
            while ((match = titlePattern.exec(content)) !== null) {
                match[1].split(/[^a-zA-Z0-9\u4e00-\u9fa5]+/).forEach(word => {
                    if (word.length >= 2) {
                        keywords.add(word.toLowerCase());
                    }
                });
            }

            const listPattern = /^[-*]\s+(.+)$/gm;
            while ((match = listPattern.exec(content)) !== null) {
                match[1].split(/[^a-zA-Z0-9\u4e00-\u9fa5]+/).forEach(word => {
                    if (word.length >= 2) {
                        keywords.add(word.toLowerCase());
                    }
                });
            }
        }

        return Array.from(keywords);
    }

    /**
     * 从内容中提取描述
     */
    private extractDescription(content: string): string {
        const lines = content.trim().split("\n");
        let description = "";
        
        for (const line of lines) {
            if (!line.startsWith("#") && !line.startsWith("-") && !line.startsWith("*") && line.trim()) {
                description += line.trim() + " ";
                if (description.length >= 100) {
                    break;
                }
            }
        }
        
        return description.trim().substring(0, 200);
    }

    /**
     * 解析技能文件 - 三层架构核心
     * 1. 元数据层（YAML前置）
     * 2. 指令层（Markdown主体）
     * 3. 资源引用层（在其他目录）
     */
    private parseSkillFile(content: string): { metadata: SkillMetadata; body: string } {
        const frontmatterRegex = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;
        const match = content.match(frontmatterRegex);

        if (!match) {
            return {
                metadata: {
                    name: "unknown",
                    description: content.substring(0, 200),
                },
                body: content,
            };
        }

        const frontmatter = match[1];
        const body = match[2];

        try {
            const metadata = this.parseYaml(frontmatter);
            this.parseInstructions(body, metadata.name || "unknown");
            return { metadata, body };
        } catch {
            return {
                metadata: {
                    name: "unknown",
                    description: content.substring(0, 200),
                },
                body: content,
            };
        }
    }

    /**
     * 解析指令层
     */
    private parseInstructions(body: string, skillName: string): SkillInstructions {
        const instructions: SkillInstructions = {
            steps: [],
            constraints: [],
            errorHandling: [],
            examples: [],
        };

        const lines = body.split("\n");
        let currentSection = "";

        for (const line of lines) {
            const trimmed = line.trim();

            if (trimmed.startsWith("## ")) {
                const section = trimmed.replace("## ", "").toLowerCase();
                if (section.includes("step") || section.includes("执行")) {
                    currentSection = "steps";
                } else if (section.includes("constraint") || section.includes("约束")) {
                    currentSection = "constraints";
                } else if (section.includes("error") || section.includes("错误")) {
                    currentSection = "errorHandling";
                } else if (section.includes("example") || section.includes("示例")) {
                    currentSection = "examples";
                } else {
                    currentSection = "";
                }
            } else if (trimmed.startsWith("- ") && currentSection) {
                const item = trimmed.replace(/^-\s*/, "");
                if (currentSection === "steps") {
                    instructions.steps?.push(item);
                } else if (currentSection === "constraints") {
                    instructions.constraints?.push(item);
                } else if (currentSection === "errorHandling") {
                    instructions.errorHandling?.push(item);
                } else if (currentSection === "examples") {
                    instructions.examples?.push(item);
                }
            } else if (/^\d+\.\s/.test(trimmed) && currentSection === "steps") {
                instructions.steps?.push(trimmed.replace(/^\d+\.\s*/, ""));
            }
        }

        this.instructionsCache.set(skillName, instructions);
        return instructions;
    }

    /**
     * 获取技能指令
     */
    async getSkillInstructions(skillName: string): Promise<SkillInstructions | null> {
        if (this.instructionsCache.has(skillName)) {
            return this.instructionsCache.get(skillName) || null;
        }

        const skill = this.skillsCache.get(skillName);
        if (!skill || !skill.content) return null;

        return this.parseInstructions(skill.content, skillName);
    }

    /**
     * 简单的 YAML 解析器 - 增强版，支持更多字段
     */
    private parseYaml(yaml: string): SkillMetadata {
        const lines = yaml.split("\n");
        const result: SkillMetadata = {
            name: "",
            description: "",
        };

        let currentField = "";
        let multiLineValue = "";
        let inArray = false;
        let arrayValues: string[] = [];

        for (const line of lines) {
            const trimmed = line.trim();

            if (trimmed.startsWith("#")) continue;

            if (inArray) {
                if (trimmed.startsWith("-")) {
                    arrayValues.push(trimmed.replace(/^-\s*/, ""));
                } else if (trimmed === "]" || (!trimmed && currentField)) {
                    this.setField(result, currentField, arrayValues);
                    currentField = "";
                    multiLineValue = "";
                    arrayValues = [];
                    inArray = false;
                    if (trimmed.includes(":")) {
                        const colonIndex = trimmed.indexOf(":");
                        if (colonIndex > 0) {
                            currentField = trimmed.substring(0, colonIndex).trim();
                            const value = trimmed.substring(colonIndex + 1).trim();
                            if (value) {
                                this.setField(result, currentField, value);
                                currentField = "";
                            } else if (trimmed.endsWith(":")) {
                                currentField = "";
                            }
                        }
                    }
                }
                continue;
            }

            const colonIndex = trimmed.indexOf(":");
            if (colonIndex > 0) {
                const key = trimmed.substring(0, colonIndex).trim();
                const value = trimmed.substring(colonIndex + 1).trim();

                if (currentField) {
                    this.setField(result, currentField, multiLineValue.trim());
                    multiLineValue = "";
                    currentField = "";
                }

                if (value === "") {
                    const nextLine = lines[lines.indexOf(line) + 1];
                    if (nextLine && nextLine.trim().startsWith("-")) {
                        currentField = key;
                        inArray = true;
                        arrayValues = [];
                    } else if (nextLine && (nextLine.trim().startsWith(" ") || nextLine.trim() === "[]")) {
                        if (nextLine.trim() === "[]") {
                            this.setField(result, key, []);
                            continue;
                        }
                        currentField = key;
                    } else {
                        currentField = key;
                    }
                } else {
                    this.setField(result, key, value);
                }
            } else if (currentField && (trimmed.startsWith(" ") || trimmed.startsWith("-"))) {
                if (trimmed.startsWith("-")) {
                    multiLineValue += (multiLineValue ? "\n" : "") + trimmed.replace(/^-\s*/, "");
                } else {
                    multiLineValue += (multiLineValue ? "\n" : "") + line;
                }
            }
        }

        if (currentField) {
            if (arrayValues.length > 0) {
                this.setField(result, currentField, arrayValues);
            } else {
                this.setField(result, currentField, multiLineValue.trim());
            }
        }

        return result;
    }

    /**
     * 设置字段值 - 增强版
     */
    private setField(obj: SkillMetadata, key: string, value: any): void {
        const normalizedKey = key.toLowerCase().replace(/-/g, "");

        switch (normalizedKey) {
            case "name":
                obj.name = value;
                break;
            case "description":
                obj.description = value;
                break;
            case "version":
                obj.version = value;
                break;
            case "author":
                obj.author = value;
                break;
            case "type":
                obj.type = value;
                break;
            case "priority":
                obj.priority = value;
                break;
            case "enforcement":
                obj.enforcement = value;
                break;
            case "license":
                obj.license = value;
                break;
            case "keywords":
                if (Array.isArray(value)) {
                    obj.keywords = value.map(v => String(v));
                } else {
                    obj.keywords = this.parseArray(value);
                }
                break;
            case "tags":
                if (Array.isArray(value)) {
                    obj.tags = value.map(v => String(v));
                } else {
                    obj.tags = this.parseArray(value);
                }
                break;
            case "permissions":
                if (Array.isArray(value)) {
                    obj.permissions = value.map(v => String(v));
                } else {
                    obj.permissions = this.parseArray(value);
                }
                break;
            case "intentpatterns":
            case "intentpatterns":
                if (Array.isArray(value)) {
                    obj.intentPatterns = value.map(v => String(v));
                } else {
                    obj.intentPatterns = this.parseArray(value);
                }
                break;
            case "filepathpatterns":
            case "filepathpatterns":
                if (Array.isArray(value)) {
                    obj.filePathPatterns = value.map(v => String(v));
                } else {
                    obj.filePathPatterns = this.parseArray(value);
                }
                break;
            case "contentpatterns":
            case "contentpatterns":
                if (Array.isArray(value)) {
                    obj.contentPatterns = value.map(v => String(v));
                } else {
                    obj.contentPatterns = this.parseArray(value);
                }
                break;
        }
    }

    /**
     * 解析数组字符串
     */
    private parseArray(value: string | string[]): string[] | undefined {
        if (Array.isArray(value)) return value;
        if (!value) return undefined;

        const trimmed = String(value).trim();

        if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
            try {
                return JSON.parse(trimmed);
            } catch {
                // 尝试手动解析
            }
        }

        if (trimmed.includes("- ")) {
            return trimmed
                .split("\n")
                .map((line) => line.trim().replace(/^-\s*/, ""))
                .filter((item) => item);
        }

        return trimmed.split(",").map((item) => item.trim()).filter((item) => item);
    }

    /**
     * 获取所有技能
     */
    async getAllEnabledSkills(): Promise<Skill[]> {
        return Array.from(this.skillsCache.values());
    }

    /**
     * 根据名称获取技能
     */
    async getSkillByName(name: string): Promise<Skill | null> {
        return this.skillsCache.get(name) || null;
    }

    /**
     * 根据用户输入匹配技能
     */
    async matchSkills(prompt: string, options?: {
        filePath?: string;
        fileContent?: string;
    }): Promise<MatchedSkill[]> {
        const skills = await this.getAllEnabledSkills();
        this.logger.log(`Total skills to match: ${skills.length}`);
        
        const matches: MatchedSkill[] = [];

        for (const skill of skills) {
            const matched = this.matchSkill(skill, prompt, options);
            if (matched) {
                matches.push(matched);
            }
        }

        return matches.sort((a, b) => b.confidence - a.confidence);
    }

    /**
     * 匹配单个技能
     */
    private matchSkill(
        skill: Skill,
        prompt: string,
        options?: { filePath?: string; fileContent?: string },
    ): MatchedSkill | null {
        const lowerPrompt = prompt.toLowerCase();

        // 标签匹配（最高优先级）
        if (skill.tags?.length) {
            for (const tag of skill.tags) {
                if (lowerPrompt.includes(tag.toLowerCase())) {
                    return {
                        skill,
                        matchType: "tag",
                        confidence: 0.95,
                        matchedText: tag,
                    };
                }
            }
        }

        // 关键词匹配
        if (skill.keywords?.length) {
            for (const keyword of skill.keywords) {
                if (lowerPrompt.includes(keyword.toLowerCase())) {
                    return {
                        skill,
                        matchType: "keyword",
                        confidence: 0.9,
                        matchedText: keyword,
                    };
                }
            }
        }

        // 意图模式匹配
        if (skill.intentPatterns?.length) {
            for (const pattern of skill.intentPatterns) {
                try {
                    const regex = new RegExp(pattern, "i");
                    if (regex.test(prompt)) {
                        const match = prompt.match(regex);
                        return {
                            skill,
                            matchType: "intent",
                            confidence: 0.85,
                            matchedText: match?.[0],
                        };
                    }
                } catch {
                    // 忽略无效的正则表达式
                }
            }
        }

        // 文件路径匹配
        if (options?.filePath && skill.filePathPatterns?.length) {
            for (const pattern of skill.filePathPatterns) {
                if (this.matchGlob(options.filePath, pattern)) {
                    return {
                        skill,
                        matchType: "filePath",
                        confidence: 0.8,
                        matchedText: options.filePath,
                    };
                }
            }
        }

        // 内容模式匹配
        if (options?.fileContent && skill.contentPatterns?.length) {
            for (const pattern of skill.contentPatterns) {
                try {
                    const regex = new RegExp(pattern, "i");
                    if (regex.test(options.fileContent)) {
                        return {
                            skill,
                            matchType: "content",
                            confidence: 0.75,
                        };
                    }
                } catch {
                    // 忽略无效的正则表达式
                }
            }
        }

        // 名称匹配（最低优先级）
        if (skill.name.toLowerCase().includes(lowerPrompt) || lowerPrompt.includes(skill.name.toLowerCase())) {
            return {
                skill,
                matchType: "name",
                confidence: 0.5,
                matchedText: skill.name,
            };
        }

        return null;
    }

    /**
     * 简单的 glob 模式匹配
     */
    private matchGlob(filePath: string, pattern: string): boolean {
        const regexPattern = pattern
            .replace(/\./g, "\\.")
            .replace(/\*/g, ".*")
            .replace(/\?/g, ".");

        return new RegExp(`^${regexPattern}$`).test(filePath);
    }

    /**
     * 重新加载所有技能
     */
    async reloadSkills(): Promise<void> {
        await this.loadAllSkills();
        await this.exportSkillsToJson();
    }

    /**
     * 获取技能的引用内容
     */
    async getReferenceContent(skillName: string, referenceName: string): Promise<string | null> {
        const skill = this.skillsCache.get(skillName);
        if (!skill) return null;

        const reference = skill.references?.find((r) => r.name === referenceName);
        if (!reference) return null;

        try {
            return readFileSync(reference.path, "utf-8");
        } catch {
            return null;
        }
    }

    /**
     * 执行技能脚本
     */
    async executeScript(
        skillName: string,
        scriptName: string,
        args: string[] = [],
        options?: { cwd?: string; env?: Record<string, string> }
    ): Promise<SkillResult> {
        const startTime = Date.now();
        const skill = this.skillsCache.get(skillName);

        if (!skill) {
            return {
                status: "error",
                data: {},
                message: `技能 ${skillName} 不存在`,
                metadata: { skillName },
            };
        }

        const script = skill.scripts?.find(s => s.name === scriptName);
        if (!script) {
            return {
                status: "error",
                data: {},
                message: `脚本 ${scriptName} 不存在`,
                metadata: { skillName },
            };
        }

        try {
            let command: string;
            const spawnArgs: string[] = [];

            switch (script.type) {
                case "python":
                    command = "python";
                    spawnArgs.push(script.path, ...args);
                    break;
                case "bash":
                    command = "bash";
                    spawnArgs.push(script.path, ...args);
                    break;
                case "node":
                    command = "node";
                    spawnArgs.push(script.path, ...args);
                    break;
                default:
                    return {
                        status: "error",
                        data: {},
                        message: `不支持的脚本类型: ${script.type}`,
                        metadata: { skillName, executionTime: Date.now() - startTime },
                    };
            }

            const { stdout, stderr } = await exec(command + " " + spawnArgs.join(" "), {
                cwd: options?.cwd || process.cwd(),
                env: { ...process.env, ...options?.env },
            });

            return {
                status: "success",
                data: {
                    stdout,
                    stderr,
                    exitCode: 0,
                },
                message: `脚本执行成功`,
                metadata: {
                    skillName,
                    executionTime: Date.now() - startTime,
                    source: `scripts/${script.name}`,
                },
            };
        } catch (error: any) {
            return {
                status: "error",
                data: {
                    error: error.message,
                    stdout: error.stdout,
                    stderr: error.stderr,
                },
                message: `脚本执行失败: ${error.message}`,
                metadata: {
                    skillName,
                    executionTime: Date.now() - startTime,
                    source: `scripts/${script.name}`,
                },
            };
        }
    }

    /**
     * 获取技能资产路径
     */
    async getAssetPath(skillName: string, assetName: string): Promise<string | null> {
        const skill = this.skillsCache.get(skillName);
        if (!skill) return null;

        const asset = skill.assets?.find(a => a.name === assetName);
        if (!asset) return null;

        return asset.path;
    }

    /**
     * 获取技能统计信息
     */
    async getSkillStats(): Promise<{
        total: number;
        types: Record<string, number>;
        byTag: Record<string, number>;
        totalScripts: number;
        totalReferences: number;
        totalAssets: number;
    }> {
        const skills = await this.getAllEnabledSkills();
        const types: Record<string, number> = {};
        const byTag: Record<string, number> = {};
        let totalScripts = 0;
        let totalReferences = 0;
        let totalAssets = 0;

        for (const skill of skills) {
            types[skill.type] = (types[skill.type] || 0) + 1;

            skill.tags?.forEach(tag => {
                byTag[tag] = (byTag[tag] || 0) + 1;
            });

            totalScripts += skill.scripts?.length || 0;
            totalReferences += skill.references?.length || 0;
            totalAssets += skill.assets?.length || 0;
        }

        return {
            total: skills.length,
            types,
            byTag,
            totalScripts,
            totalReferences,
            totalAssets,
        };
    }

    /**
     * 导出所有技能到 JSON 文件
     */
    async exportSkillsToJson(): Promise<void> {
        try {
            if (!existsSync(this.exportDir)) {
                mkdirSync(this.exportDir, { recursive: true });
            }

            const skills = await this.getAllEnabledSkills();
            
            // 导出技能列表
            const skillsList = skills.map(skill => ({
                name: skill.name,
                description: skill.description,
                type: skill.type,
                version: skill.version,
                tags: skill.tags || [],
                priority: skill.priority,
                keywords: skill.keywords || [],
                scripts: skill.scripts?.map(s => ({ name: s.name, type: s.type })) || [],
                references: skill.references?.map(r => r.name) || [],
                assets: skill.assets?.map(a => ({ name: a.name, type: a.type })) || [],
                filePath: skill.filePath,
            }));

            writeFileSync(
                join(this.exportDir, "skills-index.json"),
                JSON.stringify(skillsList, null, 2),
                "utf-8"
            );

            // 导出每个技能的详细信息
            for (const skill of skills) {
                const skillData = {
                    ...skill,
                    references: skill.references?.map(r => ({
                        name: r.name,
                        path: r.path,
                    })) || [],
                };
                
                writeFileSync(
                    join(this.exportDir, `${skill.name}.json`),
                    JSON.stringify(skillData, null, 2),
                    "utf-8"
                );
            }

            this.logger.log(`Exported ${skills.length} skills to ${this.exportDir}`);
        } catch (error: any) {
            this.logger.error(`Failed to export skills: ${error.message}`);
        }
    }
}
