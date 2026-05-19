import { Injectable } from "@nestjs/common";
import { tool } from "ai";
import { z } from "zod";
import { AiSkillService, type Skill } from "./ai-skill.service";

/**
 * 技能工具服务
 * 
 * 把每个技能包直接注册成独立的工具，供AI直接调用
 */
@Injectable()
export class AiSkillToolService {
    constructor(private readonly skillService: AiSkillService) {}

    /**
     * 获取所有技能工具
     */
    async getSkillTools(): Promise<Record<string, ReturnType<typeof tool>>> {
        const skills = await this.skillService.getAllEnabledSkills();
        const tools: Record<string, ReturnType<typeof tool>> = {};

        for (const skill of skills) {
            const toolName = this.sanitizeToolName(skill.name);
            tools[toolName] = this.createSkillTool(skill);
        }

        // 添加管理工具
        tools.list_all_skills = this.createListAllSkillsTool();
        
        return tools;
    }

    /**
     * 为单个技能创建工具
     */
    private createSkillTool(skill: Skill) {
        const toolName = this.sanitizeToolName(skill.name);
        
        return tool({
            description: `
【技能：${skill.name}】
${skill.description}

类型: ${skill.type}
优先级: ${skill.priority}
执行方式: ${skill.enforcement}

${skill.content ? skill.content.substring(0, 500) : ''}

使用此工具获取该技能的完整内容和指南。
            `.trim(),
            inputSchema: z.object({
                task_description: z.string().optional().describe("当前要完成的任务描述，帮助技能提供更精准的指导"),
            }),
            execute: async (args) => {
                let result = `
# ${skill.name}

${skill.description}

---

${skill.content || ''}
                `.trim();

                if (args.task_description) {
                    result += `

---

## 针对当前任务的建议

当前任务：${args.task_description}

请根据上述技能指南完成任务。
                    `.trim();
                }

                if (skill.reference_list && skill.reference_list.length > 0) {
                    result += `

---

## 相关参考文档

可用的参考文档：
${skill.reference_list.map(ref => `- ${ref.name}`).join('\n')}

如需获取参考文档内容，请使用 get_skill_reference 工具。
                    `.trim();
                }

                return {
                    success: true,
                    skill_name: skill.name,
                    skill_type: skill.type,
                    skill_description: skill.description,
                    content: result,
                    has_references: skill.reference_list && skill.reference_list.length > 0,
                    reference_names: skill.reference_list?.map(r => r.name) || [],
                };
            },
        });
    }

    /**
     * 创建列出所有技能的工具
     */
    private createListAllSkillsTool() {
        return tool({
            description: "列出所有可用的技能包。查看有哪些技能可以被调用。",
            inputSchema: z.object({}),
            execute: async () => {
                const skills = await this.skillService.getAllEnabledSkills();
                const stats = await this.skillService.getSkillStats();
                
                return {
                    success: true,
                    total: skills.length,
                    stats,
                    skills: skills.map(skill => ({
                        name: skill.name,
                        tool_name: this.sanitizeToolName(skill.name),
                        description: skill.description,
                        type: skill.type,
                        priority: skill.priority,
                        keywords: skill.keywords || [],
                    })),
                    usage_tip: "使用技能名称对应的工具名来调用具体技能。例如，'frontend-design' 技能的工具名是 'frontend_design'。",
                };
            },
        });
    }

    /**
     * 把技能名称转换为合法的工具名
     */
    private sanitizeToolName(name: string): string {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '') || 'unknown_skill';
    }
}
