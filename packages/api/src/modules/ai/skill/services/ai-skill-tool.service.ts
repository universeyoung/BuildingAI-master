import { Injectable } from "@nestjs/common";
import { Tool } from "ai";
import { AiSkillService, type MatchedSkill } from "./services/ai-skill.service";

/**
 * 技能工具服务
 * 
 * 提供可被AI调用的技能相关工具
 */
@Injectable()
export class AiSkillToolService {
    constructor(private readonly skillService: AiSkillService) {}

    /**
     * 获取技能查询工具
     */
    getSkillTools(): Record<string, Tool> {
        return {
            searchSkills: this.createSearchSkillsTool(),
            getSkillDetails: this.createGetSkillDetailsTool(),
            getSkillReference: this.createGetSkillReferenceTool(),
        };
    }

    /**
     * 创建搜索技能工具
     */
    private createSearchSkillsTool(): Tool {
        return {
            name: "searchSkills",
            description: "搜索与用户问题相关的技能指南。当用户的问题涉及特定技术领域、框架使用、最佳实践或开发任务时，使用此工具查找相关技能文档。",
            parameters: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description: "用户的问题或搜索关键词",
                    },
                    filePath: {
                        type: "string",
                        description: "当前处理的文件路径（可选）",
                    },
                    fileContent: {
                        type: "string",
                        description: "当前文件的内容（可选）",
                    },
                },
                required: ["query"],
            },
            execute: async (args: {
                query: string;
                filePath?: string;
                fileContent?: string;
            }) => {
                const matches = await this.skillService.matchSkills(
                    args.query,
                    {
                        filePath: args.filePath,
                        fileContent: args.fileContent,
                    },
                );

                if (matches.length === 0) {
                    return {
                        success: false,
                        message: "未找到相关技能",
                        skills: [],
                    };
                }

                const result = matches.slice(0, 5).map((match: MatchedSkill) => ({
                    name: match.skill.name,
                    description: match.skill.description,
                    priority: match.skill.priority,
                    enforcement: match.skill.enforcement,
                    matchType: match.matchType,
                    confidence: match.confidence,
                }));

                return {
                    success: true,
                    message: `找到 ${matches.length} 个相关技能`,
                    skills: result,
                };
            },
        };
    }

    /**
     * 创建获取技能详情工具
     */
    private createGetSkillDetailsTool(): Tool {
        return {
            name: "getSkillDetails",
            description: "获取特定技能的详细内容。在搜索到相关技能后，使用此工具获取完整的技能文档内容。",
            parameters: {
                type: "object",
                properties: {
                    skillName: {
                        type: "string",
                        description: "技能名称",
                    },
                },
                required: ["skillName"],
            },
            execute: async (args: { skillName: string }) => {
                const skill = await this.skillService.getSkillByName(args.skillName);

                if (!skill) {
                    return {
                        success: false,
                        message: `未找到技能: ${args.skillName}`,
                    };
                }

                return {
                    success: true,
                    name: skill.name,
                    description: skill.description,
                    type: skill.type,
                    priority: skill.priority,
                    enforcement: skill.enforcement,
                    content: skill.content?.substring(0, 5000) || "",
                    references: skill.reference_list?.map((r) => r.name) || [],
                };
            },
        };
    }

    /**
     * 创建获取技能引用工具
     */
    private createGetSkillReferenceTool(): Tool {
        return {
            name: "getSkillReference",
            description: "获取技能的引用文档内容。当技能内容提到参考文件时，使用此工具获取详细信息。",
            parameters: {
                type: "object",
                properties: {
                    skillName: {
                        type: "string",
                        description: "技能名称",
                    },
                    referenceName: {
                        type: "string",
                        description: "引用文件名称（不含.md扩展名）",
                    },
                },
                required: ["skillName", "referenceName"],
            },
            execute: async (args: { skillName: string; referenceName: string }) => {
                const content = await this.skillService.getReferenceContent(
                    args.skillName,
                    args.referenceName,
                );

                if (!content) {
                    return {
                        success: false,
                        message: `未找到引用文件: ${args.referenceName}`,
                    };
                }

                return {
                    success: true,
                    skillName: args.skillName,
                    referenceName: args.referenceName,
                    content: content.substring(0, 5000),
                };
            },
        };
    }

    /**
     * 根据用户输入自动匹配技能并生成提示词上下文
     */
    async buildSkillContext(prompt: string): Promise<string> {
        const matches = await this.skillService.matchSkills(prompt);

        if (matches.length === 0) {
            return "";
        }

        const skillContexts = await Promise.all(
            matches.slice(0, 3).map(async (match) => {
                const skill = match.skill;
                let content = skill.content || "";
                
                if (content.length > 1000) {
                    content = content.substring(0, 1000) + "\n\n...（查看完整内容请使用 getSkillDetails 工具）";
                }

                return `## ${skill.name}\n\n${content}`;
            }),
        );

        return `
以下是与当前任务相关的技能指南：

${skillContexts.join("\n\n---\n\n")}

请根据以上技能指南回答用户问题，如果需要更详细的信息可以调用技能工具。
`.trim();
    }
}