import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { Repository } from "typeorm";
import { AiSkill } from "@buildingai/db";

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
 * 匹配的技能结果
 */
export interface MatchedSkill {
    skill: AiSkill;
    matchType: "keyword" | "intent" | "filePath" | "content";
    confidence: number;
    matchedText?: string;
}

/**
 * 技能服务
 * 
 * 负责加载、解析和管理技能文件
 */
@Injectable()
export class AiSkillService implements OnModuleInit {
    private readonly logger = new Logger(AiSkillService.name);
    private skillsDir: string;

    constructor(
        @InjectRepository(AiSkill)
        private readonly skillRepository: Repository<AiSkill>,
    ) {
        this.skillsDir = join(process.cwd(), "skills");
    }

    async onModuleInit() {
        await this.loadAllSkills();
    }

    /**
     * 加载所有技能
     */
    async loadAllSkills(): Promise<void> {
        try {
            const skillNames = this.getSkillDirectoryNames();
            
            for (const skillName of skillNames) {
                await this.loadSkill(skillName);
            }

            this.logger.log(`Loaded ${skillNames.length} skills`);
        } catch (error) {
            this.logger.error(`Failed to load skills: ${error.message}`);
        }
    }

    /**
     * 获取技能目录名称列表
     */
    private getSkillDirectoryNames(): string[] {
        try {
            const entries = readdirSync(this.skillsDir, { withFileTypes: true });
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
    async loadSkill(skillName: string): Promise<AiSkill | null> {
        const skillPath = join(this.skillsDir, skillName);
        const skillMdPath = join(skillPath, "SKILL.md");

        if (!statSync(skillMdPath, { throwIfNoEntry: false })?.isFile()) {
            this.logger.warn(`Skill file not found: ${skillMdPath}`);
            return null;
        }

        try {
            const content = readFileSync(skillMdPath, "utf-8");
            const { metadata, body } = this.parseSkillFile(content);

            const reference_list = this.scanReferences(skillPath);

            const skillData: Partial<AiSkill> = {
                name: metadata.name || skillName,
                description: metadata.description || "",
                type: metadata.type || "domain",
                keywords: metadata.keywords,
                intentPatterns: metadata.intentPatterns,
                filePathPatterns: metadata.filePathPatterns,
                contentPatterns: metadata.contentPatterns,
                priority: metadata.priority || "medium",
                enforcement: metadata.enforcement || "suggest",
                content: body,
                reference_list,
                filePath: skillMdPath,
            };

            let skill = await this.skillRepository.findOneBy({ name: skillName });
            
            if (skill) {
                await this.skillRepository.update(skill.id, skillData);
            } else {
                skill = this.skillRepository.create(skillData);
                await this.skillRepository.save(skill);
            }

            return skill;
        } catch (error) {
            this.logger.error(`Failed to load skill ${skillName}: ${error.message}`);
            return null;
        }
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
     * 获取所有启用的技能
     */
    async getAllEnabledSkills(): Promise<AiSkill[]> {
        return this.skillRepository.find({
            where: { isEnabled: true },
            order: { sortOrder: "ASC", priority: "ASC" },
        });
    }

    /**
     * 根据名称获取技能
     */
    async getSkillByName(name: string): Promise<AiSkill | null> {
        return this.skillRepository.findOneBy({ name });
    }

    /**
     * 根据用户输入匹配技能
     */
    async matchSkills(prompt: string, options?: {
        filePath?: string;
        fileContent?: string;
    }): Promise<MatchedSkill[]> {
        const skills = await this.getAllEnabledSkills();
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
        skill: AiSkill,
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
    }

    /**
     * 更新技能状态
     */
    async updateSkillStatus(name: string, isEnabled: boolean): Promise<void> {
        await this.skillRepository.update({ name }, { isEnabled });
    }

    /**
     * 获取技能的引用内容
     */
    async getReferenceContent(skillName: string, referenceName: string): Promise<string | null> {
        const skill = await this.getSkillByName(skillName);
        if (!skill) return null;

        const reference = skill.reference_list?.find((r) => r.name === referenceName);
        if (!reference) return null;

        try {
            return readFileSync(reference.path, "utf-8");
        } catch {
            return null;
        }
    }
}