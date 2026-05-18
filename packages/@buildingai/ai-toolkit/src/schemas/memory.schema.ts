import { z } from "zod";

export const extractedMemorySchema = z.object({
    memories: z
        .array(
            z.object({
                type: z
                    .enum(["user_global", "agent_specific"])
                    .describe(
                        "user_global = cross-agent long-term preference; agent_specific = current agent business context",
                    ),
                content: z
                    .string()
                    .describe("A single self-contained sentence describing the memory"),
                category: z
                    .string()
                    .describe(
                        "For user_global: preference | personal_info | habit | instruction. For agent_specific: business_context | user_requirement | decision | fact",
                    ),
            }),
        )
        .describe("Extracted memories. Return empty array if nothing worth remembering."),
});

export type ExtractedMemoryOutput = z.infer<typeof extractedMemorySchema>;
export type ExtractedMemoryItem = ExtractedMemoryOutput["memories"][number];
