import {
    buildAttachedFilesSection,
    buildUserPreferencesSection,
    KNOWLEDGE_BASE_CITATION_INSTRUCTIONS,
    KNOWLEDGE_BASE_TOOL_PRIORITY_INSTRUCTIONS,
    TOOL_USE_POLICY,
    WEB_SEARCH_LAST_INSTRUCTIONS,
} from "@buildingai/ai-toolkit/prompts";
import type { Agent, AgentMemory, UserMemory } from "@buildingai/db/entities";
import { Injectable } from "@nestjs/common";

export interface PromptBuildOptions {
    formVariables?: Record<string, string>;
    formFieldsInputs?: Record<string, unknown>;
    planInstructions?: string;
    documents?: Array<{ filename: string; content: string }>;
    useToolForDocuments?: boolean;
    chatStyle?: string;
    customInstruction?: string;
    planningToolAvailable?: boolean;
}

@Injectable()
export class PromptBuilder {
    buildSystemPrompt(
        agent: Agent,
        userMemories: UserMemory[],
        agentMemories: AgentMemory[],
        options?: PromptBuildOptions,
    ): string {
        const sections: string[] = [];

        sections.push(TOOL_USE_POLICY);
        const rolePrompt = this.applyFormVariables(
            agent.rolePrompt || "",
            options?.formVariables,
            options?.formFieldsInputs,
        );
        if (rolePrompt) {
            sections.push(rolePrompt);
            sections.push(WEB_SEARCH_LAST_INSTRUCTIONS);
        }

        const prefsSection = buildUserPreferencesSection(
            options?.chatStyle,
            options?.customInstruction,
        );
        if (prefsSection) sections.push(prefsSection);

        if (userMemories.length > 0) {
            const memoryLines = userMemories.map((m) => `- ${m.content}`).join("\n");
            sections.push(
                `<user_memory>\nHere is what I know about the user from previous interactions:\n${memoryLines}\n</user_memory>`,
            );
        }

        if (agentMemories.length > 0) {
            const memoryLines = agentMemories.map((m) => `- ${m.content}`).join("\n");
            sections.push(
                `<agent_memory>\nHere is what I remember from our previous conversations:\n${memoryLines}\n</agent_memory>`,
            );
        }

        if (options?.planInstructions) {
            sections.push(
                `<execution_plan>\nFollow this plan step by step:\n${options.planInstructions}\n</execution_plan>`,
            );
        }

        if (options?.planningToolAvailable) {
            sections.push(
                "## Planning tool\nCall request_execution_plan only when the user explicitly asks for a plan, outline, or step-by-step guide (e.g. 计划、大纲、学习路线、分步指南). Call it first, then other tools if needed. Do NOT use it for simple questions, greetings, or single-step requests.",
            );
        }

        if (options?.documents?.length) {
            const attachedSection = buildAttachedFilesSection(
                options.documents,
                options.useToolForDocuments ?? false,
            );
            if (attachedSection) sections.push(attachedSection);
        }

        if (agent.datasetIds?.length) {
            sections.push(KNOWLEDGE_BASE_TOOL_PRIORITY_INSTRUCTIONS);
            sections.push(KNOWLEDGE_BASE_CITATION_INSTRUCTIONS);
        }

        return sections.join("\n\n");
    }

    private applyFormVariables(
        prompt: string,
        formVariables?: Record<string, string>,
        formFieldsInputs?: Record<string, unknown>,
    ): string {
        if (!prompt) return prompt;
        const vars = { ...formFieldsInputs, ...formVariables };
        if (Object.keys(vars).length === 0) return prompt;
        return prompt.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
            const v = vars[key];
            return v != null ? String(v) : `{{${key}}}`;
        });
    }
}
