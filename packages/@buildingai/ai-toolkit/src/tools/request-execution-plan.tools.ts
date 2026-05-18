import { tool } from "ai";
import { z } from "zod";

export interface ExecutionPlanPayload {
    title: string;
    description: string;
    overview: string;
    keySteps: string[];
}

export interface CreateRequestExecutionPlanToolOptions {
    userMessage: string;
    memoryContext: string;
    generatePlan: (userMessage: string, memoryContext: string) => Promise<ExecutionPlanPayload>;
    onStatus?: (phase: "generating_plan" | "done", planPreview?: string) => void;
    onBilling?: () => Promise<void>;
}

export function createRequestExecutionPlanTool(options: CreateRequestExecutionPlanToolOptions) {
    const { userMessage, memoryContext, generatePlan, onStatus, onBilling } = options;

    return tool({
        description:
            "Get a step-by-step execution plan. Call only when the user explicitly asks for a plan, outline, or step-by-step guide (计划/大纲/学习路线/分步指南). Do not call for simple questions, greetings, or single-step requests.",
        inputSchema: z.object({}),
        execute: async () => {
            onStatus?.("generating_plan");
            const plan = await generatePlan(userMessage, memoryContext);
            const preview =
                plan.description?.slice(0, 200) || plan.overview?.slice(0, 200) || plan.title || "";
            onStatus?.("done", preview);
            if (onBilling) {
                await onBilling();
            }
            return plan;
        },
    });
}
