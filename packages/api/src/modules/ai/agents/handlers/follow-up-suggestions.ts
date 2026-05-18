import { getReasoningOptions } from "@buildingai/ai-sdk";
import { GENERATE_FOLLOW_UP_SUGGESTIONS_PROMPT } from "@buildingai/ai-toolkit/prompts";
import { Injectable, Logger } from "@nestjs/common";
import type { LanguageModel } from "ai";
import { generateText } from "ai";

@Injectable()
export class FollowUpSuggestionsHandler {
    private readonly logger = new Logger(FollowUpSuggestionsHandler.name);

    /**
     * Generate up to 3 short follow-up question suggestions from the last Q&A.
     * Uses the title model for low token cost. Returns empty array on failure.
     */
    async generateSuggestions(
        userText: string,
        assistantText: string,
        model: LanguageModel,
        providerId: string,
    ): Promise<string[]> {
        const userSnippet = userText.trim().slice(0, 80);
        const assistantSnippet = assistantText.trim().slice(0, 300);
        if (!userSnippet) return [];

        try {
            const result = await generateText({
                model,
                prompt: GENERATE_FOLLOW_UP_SUGGESTIONS_PROMPT(userSnippet, assistantSnippet),
                providerOptions: getReasoningOptions(providerId, { thinking: false }),
            });

            const lines = result.text
                .trim()
                .split(/\n/)
                .map((s) => s.replace(/^\d+[.)\s]+/, "").trim())
                .filter((s) => s.length > 0);
            return lines.slice(0, 3);
        } catch (error) {
            this.logger.warn(
                `Follow-up suggestions failed: ${error instanceof Error ? error.message : String(error)}`,
            );
            return [];
        }
    }
}
