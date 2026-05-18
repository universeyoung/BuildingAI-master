import { llmFileParser } from "@buildingai/llm-file-parser";

import type { FilePartLike, ParseFileResult, ProcessFilesWriter } from "./process-files.js";

const TYPE_MAP = {
    progress: "data-file-parse-progress",
    metadata: "data-file-parse-metadata",
} as const;

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

export async function parseFile(
    filePart: FilePartLike,
    writer: ProcessFilesWriter,
    shouldStream: boolean,
): Promise<ParseFileResult> {
    const filename = filePart.filename || "未命名文件";
    const progressParts: ParseFileResult["progressParts"] = [];

    try {
        const { stream, result } = await llmFileParser.streamParseFromUrl(filePart.url);

        for await (const chunk of stream) {
            const chunkType = chunk.type as keyof typeof TYPE_MAP;
            if (TYPE_MAP[chunkType] && chunk[chunkType]) {
                const data = chunk[chunkType];
                const partType = TYPE_MAP[chunkType];
                if (shouldStream) {
                    writer.write({ type: partType, data });
                }
                progressParts.push({ type: partType, data });
            }
        }

        const content = llmFileParser.formatForLLM(await result);
        return { content, filename, progressParts };
    } catch (error) {
        const errorMsg = getErrorMessage(error);
        return {
            content: `[无法解析文档: ${filename}。错误: ${errorMsg}]`,
            filename,
            progressParts,
        };
    }
}
