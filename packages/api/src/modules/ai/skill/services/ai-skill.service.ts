import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { readFileSync, readdirSync, statSync, existsSync, writeFileSync, mkdirSync } from "fs";
import { join, resolve } from "path";

/**
 * 技能元数据接口
 */
export interface SkillMetadata {
    name: string;
    description: string;
    type?: string;
    keywords?: string[];
    intentPatterns?: string[];
    filePathPatterns?: string[];
    contentPatterns?: string[];
    priority?: string;
    enforcement?: string;
}

/**
 * 技能数据结构
 */
export interface Skill {
    name: string;
    description: string;
    type: string;
    keywords?: string[];
    intentPatterns?: string[];
    filePathPatterns?: string[];
    contentPatterns?: string[];
    priority: string;
    enforcement: string;
    content?: string;
    reference_list?: { name: string; path: string }[];
    filePath: string;
}

/**
 * 匹配的技能结果
 */
export interface MatchedSkill {
    skill: Skill;
    matchType: "keyword" | "intent" | "filePath" | "content" | "name";
    confidence: number;
    matchedText?: string;
}

/**
 * 技能服务
 * 
 * 负责从文件系统加载、解析和管理技能包
 * 不依赖数据库，直接读取 skills 文件夹
 */
@Injectable()
export class AiSkillService implements OnModuleInit {
    private readonly logger = new Logger(AiSkillService.name);
    private readonly skillsDirs: string[];
    private readonly exportDir: string;
    private skillsCache: Map<string, Skill> = new Map();

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
                        this.logger.log(`  Loaded skill: ${skill.name}`);
                    }
                }
            }

            this.logger.log(`Total loaded skills: ${this.skillsCache.size}`);
        } catch (error) {
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
                content: "# 通用技能指南\n\n欢迎使用技能系统！\n\n## 可用技能\n\n### 搜索技能\n使用 `searchSkills` 工具搜索相关技能。\n\n### 获取详情\n使用 `getSkillDetails` 获取技能详细内容。\n\n## 使用示例\n\n- 搜索: `搜索与前端开发相关的技能`\n- 获取详情: `获取技能 前端开发`\n"
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
---

${defaultSkill.content}`;

            writeFileSync(join(skillDir, "SKILL.md"), skillContent);
            this.logger.log("Created default skill: general-skill");
        } catch (error) {
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
     * 加载单个技能
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

            const reference_list = this.scanReferences(skillPath);

            const extractedKeywords = this.extractKeywords(metadata, body);

            const skill: Skill = {
                name: metadata.name || skillName,
                description: metadata.description || this.extractDescription(body),
                type: metadata.type || "domain",
                keywords: extractedKeywords,
                intentPatterns: metadata.intentPatterns,
                filePathPatterns: metadata.filePathPatterns,
                contentPatterns: metadata.contentPatterns,
                priority: metadata.priority || "medium",
                enforcement: metadata.enforcement || "suggest",
                content: body,
                reference_list,
                filePath: skillMdPath,
            };

            return skill;
        } catch (error) {
            this.logger.error(`Failed to load skill ${skillName}: ${error.message}`);
            return null;
        }
    }

    /**
     * 从技能内容中提取关键词
     */
    private extractKeywords(metadata: SkillMetadata, content: string): string[] {
        const keywords = new Set<string>();

        if (metadata.keywords && metadata.keywords.length > 0) {
            metadata.keywords.forEach(k => keywords.add(k.toLowerCase()));
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
     * 解析技能文件
     */
    private parseSkillFile(content: string): { metadata: SkillMetadata; body: string } {
        const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
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
     * 简单的 YAML 解析器
     */
    private parseYaml(yaml: string): SkillMetadata {
        const lines = yaml.split("\n");
        const result: SkillMetadata = {
            name: "",
            description: "",
        };

        let currentField = "";
        let multiLineValue = "";

        for (const line of lines) {
            const trimmed = line.trim();

            if (trimmed.startsWith("#")) continue;

            const colonIndex = trimmed.indexOf(":");
            if (colonIndex > 0) {
                const key = trimmed.substring(0, colonIndex).trim();
                const value = trimmed.substring(colonIndex + 1).trim();

                if (value || !key.endsWith(":")) {
                    if (currentField) {
                        this.setField(result, currentField, multiLineValue.trim());
                        multiLineValue = "";
                        currentField = "";
                    }

                    if (value === "") {
                        currentField = key;
                    } else {
                        this.setField(result, key, value);
                    }
                }
            } else if (currentField && (trimmed.startsWith(" ") || trimmed.startsWith("-"))) {
                multiLineValue += (multiLineValue ? "\n" : "") + line;
            }
        }

        if (currentField) {
            this.setField(result, currentField, multiLineValue.trim());
        }

        return result;
    }

    /**
     * 设置字段值
     */
    private setField(obj: SkillMetadata, key: string, value: string): void {
        const normalizedKey = key.toLowerCase();

        switch (normalizedKey) {
            case "name":
                obj.name = value;
                break;
            case "description":
                obj.description = value;
                break;
            case "type":
                obj.type = value;
                break;
            case "keywords":
                obj.keywords = this.parseArray(value);
                break;
            case "intentpatterns":
            case "intent_patterns":
                obj.intentPatterns = this.parseArray(value);
                break;
            case "filepathpatterns":
            case "file_path_patterns":
                obj.filePathPatterns = this.parseArray(value);
                break;
            case "contentpatterns":
            case "content_patterns":
                obj.contentPatterns = this.parseArray(value);
                break;
            case "priority":
                obj.priority = value;
                break;
            case "enforcement":
                obj.enforcement = value;
                break;
        }
    }

    /**
     * 解析数组字符串
     */
    private parseArray(value: string): string[] | undefined {
        if (!value) return undefined;

        const trimmed = value.trim();

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

        return value.split(",").map((item) => item.trim()).filter((item) => item);
    }

    /**
     * 扫描引用文件
     */
    private scanReferences(skillPath: string): { name: string; path: string }[] {
        const references: { name: string; path: string }[] = [];
        const refsDir = join(skillPath, "references");

        try {
            const entries = readdirSync(refsDir, { withFileTypes: true });

            for (const entry of entries) {
                if (entry.isFile() && entry.name.endsWith(".md")) {
                    references.push({
                        name: entry.name.replace(".md", ""),
                        path: join(refsDir, entry.name),
                    });
                }
            }
        } catch {
            // 忽略不存在的目录
        }

        return references;
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

        const reference = skill.reference_list?.find((r) => r.name === referenceName);
        if (!reference) return null;

        try {
            return readFileSync(reference.path, "utf-8");
        } catch {
            return null;
        }
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
                priority: skill.priority,
                keywords: skill.keywords || [],
                references: skill.reference_list?.map(r => r.name) || [],
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
                    reference_list: skill.reference_list?.map(r => ({
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
        } catch (error) {
            this.logger.error(`Failed to export skills: ${error.message}`);
        }
    }

    /**
     * 获取技能统计信息
     */
    async getSkillStats(): Promise<{ total: number; types: Record<string, number> }> {
        const skills = await this.getAllEnabledSkills();
        const types: Record<string, number> = {};

        for (const skill of skills) {
            types[skill.type] = (types[skill.type] || 0) + 1;
        }

        return {
            total: skills.length,
            types,
        };
    }
}
