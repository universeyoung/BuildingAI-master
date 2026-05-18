import {
    GOAL_ASSESSMENT_PROMPT,
    PLAN_GENERATION_PROMPT,
    PLAN_STRUCTURED_GENERATION_PROMPT,
} from "@buildingai/ai-toolkit/prompts";
import {
    type ExecutionPlanOutput,
    executionPlanSchema,
    type GoalAssessmentResult,
    goalAssessmentSchema,
} from "@buildingai/ai-toolkit/schemas";
import { Injectable, Logger } from "@nestjs/common";
import type { LanguageModel } from "ai";
import { generateText, Output } from "ai";

export type { ExecutionPlanOutput, GoalAssessmentResult };

@Injectable()
export class GoalPlanner {
    private readonly logger = new Logger(GoalPlanner.name);

    /**
     * Assess whether a user message describes a complex task
     * that would benefit from step-by-step planning.
     */
    async assessComplexity(
        userMessage: string,
        model: LanguageModel,
    ): Promise<GoalAssessmentResult> {
        try {
            const { output } = await generateText({
                model,
                output: Output.object({ schema: goalAssessmentSchema }),
                prompt: GOAL_ASSESSMENT_PROMPT(userMessage),
                temperature: 0,
            });

            return output ?? { isComplex: false, reason: "no_output" };
        } catch (error) {
            this.logger.warn(
                `Goal assessment failed, defaulting to simple: ${error instanceof Error ? error.message : String(error)}`,
            );
            return { isComplex: false, reason: "assessment_error" };
        }
    }

    async generatePlan(
        userMessage: string,
        context: string,
        model: LanguageModel,
    ): Promise<string> {
        try {
            const { text } = await generateText({
                model,
                prompt: PLAN_GENERATION_PROMPT(userMessage, context),
                temperature: 0,
            });

            return text.trim();
        } catch (error) {
            this.logger.warn(
                `Plan generation failed: ${error instanceof Error ? error.message : String(error)}`,
            );
            return "";
        }
    }

    async generateStructuredPlan(
        userMessage: string,
        context: string,
        model: LanguageModel,
    ): Promise<ExecutionPlanOutput> {
        try {
            const { output } = await generateText({
                model,
                output: Output.object({ schema: executionPlanSchema }),
                prompt: PLAN_STRUCTURED_GENERATION_PROMPT(userMessage, context),
                temperature: 0,
            });

            if (
                output &&
                typeof output === "object" &&
                "title" in output &&
                "keySteps" in output &&
                Array.isArray(output.keySteps)
            ) {
                const o = output as ExecutionPlanOutput;
                return {
                    title: String(o.title ?? "执行计划"),
                    description: String(o.description ?? ""),
                    overview: String(o.overview ?? ""),
                    keySteps: o.keySteps.map((s) => String(s)),
                };
            }
            return {
                title: "执行计划",
                description: "",
                overview: "",
                keySteps: [],
            };
        } catch (error) {
            this.logger.warn(
                `Structured plan generation failed: ${error instanceof Error ? error.message : String(error)}`,
            );
            return {
                title: "执行计划",
                description: "",
                overview: "",
                keySteps: [],
            };
        }
    }
}
