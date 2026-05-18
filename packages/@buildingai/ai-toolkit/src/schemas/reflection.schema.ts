import { z } from "zod";

export const reflectionSchema = z.object({
    pass: z.boolean().describe("Whether the response passes quality review"),
    score: z.number().min(1).max(10).describe("Overall quality score from 1 to 10"),
    issues: z.array(z.string()).describe("List of identified issues, empty if none"),
    suggestion: z.string().describe("Brief improvement suggestion, or empty string if pass"),
});

export type ReflectionResult = z.infer<typeof reflectionSchema>;
