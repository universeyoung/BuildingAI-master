import { Injectable } from "@nestjs/common";
import { tool } from "ai";
import { z } from "zod";
import { AiSkillService, type Skill } from "./ai-skill.service";

/**
 * 技能工具服务
 * 
 * 基于三层架构实现技能包的调用：
 * 1. 元数据层 - 启动时加载，用于工具描述
 * 2. 指令层 - 匹配成功后加载，提供执行指导
 * 3. 资源引用层 - 按需加载，提供辅助能力
 */
@Injectable()
export class AiSkillToolService {
    constructor(private readonly skillService: AiSkillService) {}

    /**
     * 获取所有技能工具
     */
    async getSkillTools(): Promise<Record<string, any>> {
        const skills = await this.skillService.getAllEnabledSkills();
        const tools: Record<string, any> = {};

        for (const skill of skills) {
            const toolName = this.sanitizeToolName(skill.name);
            tools[toolName] = this.createSkillTool(skill);
        }

        tools.list_all_skills = this.createListAllSkillsTool();
        tools.get_skill_reference = this.createGetReferenceTool();
        tools.get_skill_instructions = this.createGetInstructionsTool();
        tools.execute_skill_script = this.createExecuteScriptTool();
        tools.get_skill_assets = this.createGetAssetsTool();
        
        return tools;
    }

    /**
     * 为单个技能创建工具
     */
    private createSkillTool(skill: Skill) {
        const scriptsInfo = skill.scripts?.length
            ? `\n**可用脚本**: ${skill.scripts.map(s => `\`${s.name}\` (${s.type})`).join(", ")}`
            : "";

        const referencesInfo = skill.references?.length
            ? `\n**参考文档**: ${skill.references.map(r => `\`${r.name}\``).join(", ")}`
            : "";

        const assetsInfo = skill.assets?.length
            ? `\n**可用资产**: ${skill.assets.length} 个文件`
            : "";

        return tool({
            description: `
【技能：${skill.name}】
${skill.description}

版本: ${skill.version || "1.0.0"}
类型: ${skill.type}
优先级: ${skill.priority}
执行方式: ${skill.enforcement}
${skill.author ? `作者: ${skill.author}` : ""}
${skill.tags?.length ? `标签: ${skill.tags.join(", ")}` : ""}
${scriptsInfo}
${referencesInfo}
${assetsInfo}

请使用此工具获取该技能的完整内容和执行指导。
            `.trim(),
            inputSchema: z.object({
                task_description: z.string().optional().describe("当前要完成的任务描述，帮助技能提供更精准的指导"),
            }),
            execute: async (args) => {
                const instructions = await this.skillService.getSkillInstructions(skill.name);
                
                let result = `# ${skill.name}`;
                
                if (skill.version) {
                    result += ` (v${skill.version})`;
                }
                
                result += `

${skill.description}

---

## 执行步骤

${instructions?.steps?.map((step, i) => `${i + 1}. ${step}`).join("\n") || skill.content?.substring(0, 500) || "暂无详细步骤"}

`;

                if (instructions?.constraints?.length) {
                    result += `## 约束条件

${instructions.constraints.map(c => `- ${c}`).join("\n")}

`;
                }

                if (instructions?.errorHandling?.length) {
                    result += `## 错误处理

${instructions.errorHandling.map(e => `- ${e}`).join("\n")}

`;
                }

                if (args.task_description) {
                    result += `---

## 针对当前任务的建议

**当前任务**: ${args.task_description}

请根据上述技能指南和执行步骤完成此任务。

`;
                }

                if (skill.scripts?.length) {
                    result += `---

## 可用脚本

| 脚本名 | 类型 | 说明 |
|--------|------|------|
${skill.scripts.map(s => `| \`${s.name}\` | ${s.type} | ${s.description || "-"} |`).join("\n")}

使用 \`execute_skill_script\` 工具执行脚本。

`;
                }

                if (skill.references?.length) {
                    result += `---

## 参考文档

| 文档名 | 说明 |
|--------|------|
${skill.references.map(r => `| \`${r.name}\` | ${r.description || "参考文档"} |`).join("\n")}

使用 \`get_skill_reference\` 工具获取文档内容。

`;
                }

                if (skill.assets?.length) {
                    result += `---

## 可用资产

共 ${skill.assets.length} 个文件。使用 \`get_skill_assets\` 工具获取资产路径。

`;
                }

                return {
                    success: true,
                    skill_name: skill.name,
                    skill_version: skill.version,
                    skill_type: skill.type,
                    skill_description: skill.description,
                    content: result,
                    has_instructions: !!instructions,
                    has_scripts: !!(skill.scripts?.length),
                    has_references: !!(skill.references?.length),
                    has_assets: !!(skill.assets?.length),
                    scripts: skill.scripts?.map(s => ({ name: s.name, type: s.type })) || [],
                    references: skill.references?.map(r => r.name) || [],
                    assets_count: skill.assets?.length || 0,
                };
            },
        }) as any;
    }

    /**
     * 创建列出所有技能的工具
     */
    private createListAllSkillsTool() {
        return tool({
            description: "列出所有可用的技能包。查看有哪些技能可以被调用，包括技能名称、描述、类型、标签等信息。",
            inputSchema: z.object({
                dummy: z.string().optional().describe("占位符参数，不需要填写"),
            }),
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
                        version: skill.version,
                        author: skill.author,
                        tags: skill.tags || [],
                        priority: skill.priority,
                        has_scripts: !!(skill.scripts?.length),
                        has_references: !!(skill.references?.length),
                        has_assets: !!(skill.assets?.length),
                    })),
                    usage_tip: "使用技能名称对应的工具名来调用具体技能。例如，'frontend-design' 技能的工具名是 'frontend_design'。",
                };
            },
        }) as any;
    }

    /**
     * 创建获取技能引用的工具
     */
    private createGetReferenceTool() {
        return tool({
            description: "获取技能包的参考文档内容。支持按需加载资源引用层的内容。",
            inputSchema: z.object({
                skill_name: z.string().describe("技能名称"),
                reference_name: z.string().describe("参考文档名称（不含扩展名）"),
            }),
            execute: async (args: any) => {
                const content = await this.skillService.getReferenceContent(
                    args.skill_name,
                    args.reference_name
                );

                if (!content) {
                    return {
                        success: false,
                        error: `未找到参考文档 ${args.reference_name}`,
                        skill_name: args.skill_name,
                        reference_name: args.reference_name,
                        available_references: [],
                    };
                }

                return {
                    success: true,
                    skill_name: args.skill_name,
                    reference_name: args.reference_name,
                    content,
                    content_length: content.length,
                    usage_tip: "根据参考文档内容完成任务",
                };
            },
        }) as any;
    }

    /**
     * 创建获取技能指令的工具
     */
    private createGetInstructionsTool() {
        return tool({
            description: "获取技能的指令层内容，包括执行步骤、约束条件、错误处理等。",
            inputSchema: z.object({
                skill_name: z.string().describe("技能名称"),
            }),
            execute: async (args: any) => {
                const instructions = await this.skillService.getSkillInstructions(args.skill_name);
                const skill = await this.skillService.getSkillByName(args.skill_name);

                if (!skill) {
                    return {
                        success: false,
                        error: `技能 ${args.skill_name} 不存在`,
                    };
                }

                return {
                    success: true,
                    skill_name: args.skill_name,
                    skill_version: skill.version,
                    instructions: instructions || {
                        steps: [],
                        constraints: [],
                        errorHandling: [],
                        examples: [],
                    },
                    full_content: skill.content,
                    usage_tip: "按照执行步骤完成任务，注意约束条件和错误处理",
                };
            },
        }) as any;
    }

    /**
     * 创建执行技能脚本的工具
     */
    private createExecuteScriptTool() {
        return tool({
            description: "执行技能包中的脚本文件。支持 Python、Bash、Node.js 脚本。",
            inputSchema: z.object({
                skill_name: z.string().describe("技能名称"),
                script_name: z.string().describe("脚本名称（不含扩展名）"),
                args: z.array(z.string()).optional().describe("传递给脚本的参数列表"),
                cwd: z.string().optional().describe("执行目录，默认为当前工作目录"),
            }),
            execute: async (args: any) => {
                const result = await this.skillService.executeScript(
                    args.skill_name,
                    args.script_name,
                    args.args || [],
                    args.cwd ? { cwd: args.cwd } : undefined
                );

                return {
                    ...result,
                    skill_name: args.skill_name,
                    script_name: args.script_name,
                };
            },
        }) as any;
    }

    /**
     * 创建获取技能资产的工具
     */
    private createGetAssetsTool() {
        return tool({
            description: "获取技能包的资产文件路径。资产文件包括模板、图片、配置文件等。",
            inputSchema: z.object({
                skill_name: z.string().describe("技能名称"),
                asset_name: z.string().optional().describe("资产名称（可选，不提供则返回所有资产列表）"),
            }),
            execute: async (args: any) => {
                const skill = await this.skillService.getSkillByName(args.skill_name);

                if (!skill) {
                    return {
                        success: false,
                        error: `技能 ${args.skill_name} 不存在`,
                    };
                }

                if (args.asset_name) {
                    const path = await this.skillService.getAssetPath(args.skill_name, args.asset_name);
                    
                    if (!path) {
                        return {
                            success: false,
                            error: `未找到资产 ${args.asset_name}`,
                            skill_name: args.skill_name,
                            available_assets: skill.assets?.map(a => ({ name: a.name, type: a.type })) || [],
                        };
                    }

                    return {
                        success: true,
                        skill_name: args.skill_name,
                        asset_name: args.asset_name,
                        path,
                        usage_tip: "使用获取的路径读取或复制资产文件",
                    };
                }

                return {
                    success: true,
                    skill_name: args.skill_name,
                    total_assets: skill.assets?.length || 0,
                    assets: skill.assets?.map(a => ({
                        name: a.name,
                        type: a.type,
                        path: a.path,
                    })) || [],
                    usage_tip: "使用资产路径读取或复制文件到目标位置",
                };
            },
        }) as any;
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
