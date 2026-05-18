import { getReasoningOptions } from "@buildingai/ai-sdk";
import { GENERATE_TITLE_PROMPT } from "@buildingai/ai-toolkit/prompts";
import { Injectable, Logger } from "@nestjs/common";
import type { LanguageModel } from "ai";
import { generateText } from "ai";

@Injectable()
export class ChatTitleHandler {
    private readonly logger = new Logger(ChatTitleHandler.name);

    async generateTitle(
        firstUserContent: string,
        model: LanguageModel,
        providerId: string,
    ): Promise<{ title: string | null; usageTokens?: number }> {
        const input = firstUserContent.trim().slice(0, 50);
        if (!input) return { title: null, usageTokens: 0 };

        try {
            const result = await generateText({
                model,
                prompt: GENERATE_TITLE_PROMPT(input),
                providerOptions: getReasoningOptions(providerId, { thinking: false }),
            });

            const title = result.text
                .trim()
                .replace(/^["'「」『』]|["'「」『』]$/g, "")
                .slice(0, 20);
            const usageTokens =
                (result.usage?.totalTokens ??
                    (result.usage?.inputTokens ?? 0) + (result.usage?.outputTokens ?? 0)) ||
                0;
            return { title: title || null, usageTokens };
        } catch (error) {
            this.logger.warn(
                `Title generation failed: ${error instanceof Error ? error.message : String(error)}`,
            );
            return { title: null, usageTokens: 0 };
        }
    }
}
