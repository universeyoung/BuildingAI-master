import { z } from "zod";

export const goalAssessmentSchema = z.object({
    isComplex: z.boolean().describe("Whether the task is complex and benefits from planning"),
    reason: z.string().describe("One-sentence explanation of why the task is complex or simple"),
});

export type GoalAssessmentResult = z.infer<typeof goalAssessmentSchema>;

export const executionPlanSchema = z.object({
    title: z.string().describe("Short plan title, e.g. the goal or task name"),
    description: z.string().describe("One or two sentences summarizing the plan and its scope"),
    overview: z.string().describe("A short paragraph explaining the overall approach or strategy"),
    keySteps: z
        .array(z.string())
        .min(1)
        .max(10)
        .describe("Ordered list of concrete steps, each one sentence"),
});

export type ExecutionPlanOutput = z.infer<typeof executionPlanSchema>;
