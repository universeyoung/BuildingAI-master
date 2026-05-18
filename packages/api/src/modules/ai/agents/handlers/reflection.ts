import { REFLECTION_PROMPT } from "@buildingai/ai-toolkit/prompts";
import { type ReflectionResult, reflectionSchema } from "@buildingai/ai-toolkit/schemas";
import { Injectable, Logger } from "@nestjs/common";
import type { LanguageModel } from "ai";
import { generateText, Output } from "ai";

export type { ReflectionResult };

@Injectable()
export class ReflectionHandler {
    private readonly logger = new Logger(ReflectionHandler.name);

    /**
     * Evaluate the quality of an AI response.
     * Uses AI SDK structured output for reliable parsing.
     */
    async reflect(
        originalQuery: string,
        responseText: string,
        model: LanguageModel,
    ): Promise<ReflectionResult> {
        try {
            const { output } = await generateText({
                model,
                output: Output.object({ schema: reflectionSchema }),
                prompt: REFLECTION_PROMPT(originalQuery, responseText),
                temperature: 0,
            });

            return output ?? this.defaultPass();
        } catch (error) {
            this.logger.warn(
                `Reflection failed, defaulting to pass: ${error instanceof Error ? error.message : String(error)}`,
            );
            return this.defaultPass();
        }
    }

    private defaultPass(): ReflectionResult {
        return { pass: true, score: 7, issues: [], suggestion: "" };
    }
}
