import { tool } from "ai";
import { z } from "zod";

export interface CreateReadAttachedFileToolOptions {
    documents: Array<{ filename: string; content: string }>;
}

export function createReadAttachedFileTool(options: CreateReadAttachedFileToolOptions) {
    const docMap = new Map(options.documents.map((d) => [d.filename, d.content]));

    return tool({
        description:
            "Read the full content of a file that the user attached in this conversation. Call this when you need to answer questions based on the file. Use the exact filename from the attached files list.",
        inputSchema: z.object({
            filename: z
                .string()
                .describe(
                    "Exact filename of the attached file to read (e.g. the name from the attached files list).",
                ),
        }),
        execute: async ({ filename }) => {
            const content = docMap.get(filename);
            if (content === undefined) {
                const available = Array.from(docMap.keys()).join(", ");
                return {
                    success: false,
                    error: `File "${filename}" not found. Attached files: ${available || "none"}.`,
                };
            }
            return { success: true, filename, content };
        },
    });
}
