import { readFileSync } from "node:fs";

import type { PaginationResult } from "@buildingai/base";
import { type UserPlayground } from "@buildingai/db";
import type { AgentAnnotation } from "@buildingai/db/entities";
import { Playground } from "@buildingai/decorators/playground.decorator";
import { HttpErrorFactory } from "@buildingai/errors";
import { WebController } from "@common/decorators/controller.decorator";
import {
    Body,
    ClassSerializerInterceptor,
    Delete,
    Get,
    Logger,
    Param,
    Patch,
    Post,
    Query,
    UploadedFile,
    UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";

import { CreateAgentAnnotationDto } from "../../dto/web/annotation/create-agent-annotation.dto";
import { ListAgentAnnotationsDto } from "../../dto/web/annotation/list-agent-annotations.dto";
import { UpdateAgentAnnotationDto } from "../../dto/web/annotation/update-agent-annotation.dto";
import { AgentAnnotationService } from "../../services/agent-annotation.service";

@WebController("ai-agents")
@UseInterceptors(ClassSerializerInterceptor)
export class AgentAnnotationWebController {
    private readonly logger = new Logger(AgentAnnotationWebController.name);

    constructor(private readonly annotationService: AgentAnnotationService) {}

    @Get(":id/annotations")
    async listAnnotations(
        @Param("id") agentId: string,
        @Query() query: ListAgentAnnotationsDto,
        @Playground() user: UserPlayground,
    ): Promise<PaginationResult<AgentAnnotation>> {
        return this.annotationService.list(agentId, query, user);
    }

    @Post(":id/annotations")
    async createAnnotation(
        @Param("id") agentId: string,
        @Body() dto: CreateAgentAnnotationDto,
        @Playground() user: UserPlayground,
    ): Promise<AgentAnnotation> {
        return this.annotationService.createAnnotation(agentId, dto, user);
    }

    @Post(":id/annotations/import")
    @UseInterceptors(FileInterceptor("file"))
    async importAnnotationsFromCsv(
        @Param("id") agentId: string,
        @UploadedFile() file: Express.Multer.File | undefined,
        @Playground() user: UserPlayground,
    ): Promise<{ imported: number }> {
        if (!file) {
            this.logger.warn("annotations/import: no file in request");
            throw HttpErrorFactory.badRequest("请上传 CSV 文件");
        }
        const buffer = Buffer.isBuffer(file.buffer)
            ? file.buffer
            : typeof (file as { path?: string }).path === "string"
              ? readFileSync((file as { path: string }).path)
              : null;
        if (!buffer) {
            this.logger.warn("annotations/import: file has no buffer/path");
            throw HttpErrorFactory.badRequest("请上传 CSV 文件");
        }
        this.logger.log(`annotations/import: agentId=${agentId} bufferSize=${buffer.length}`);
        return this.annotationService.importFromCsv(agentId, buffer, user);
    }

    @Delete(":id/annotations")
    async deleteAllAnnotations(
        @Param("id") agentId: string,
        @Playground() user: UserPlayground,
    ): Promise<{ deleted: number }> {
        return this.annotationService.deleteAll(agentId, user);
    }

    @Get(":id/annotations/:annotationId")
    async getAnnotation(
        @Param("id") agentId: string,
        @Param("annotationId") annotationId: string,
        @Playground() user: UserPlayground,
    ): Promise<AgentAnnotation> {
        return this.annotationService.getOne(agentId, annotationId, user);
    }

    @Patch(":id/annotations/:annotationId")
    async updateAnnotation(
        @Param("id") agentId: string,
        @Param("annotationId") annotationId: string,
        @Body() dto: UpdateAgentAnnotationDto,
        @Playground() user: UserPlayground,
    ): Promise<AgentAnnotation> {
        return this.annotationService.updateAnnotation(agentId, annotationId, dto, user);
    }

    @Delete(":id/annotations/:annotationId")
    async deleteAnnotation(
        @Param("id") agentId: string,
        @Param("annotationId") annotationId: string,
        @Playground() user: UserPlayground,
    ): Promise<void> {
        return this.annotationService.deleteAnnotation(agentId, annotationId, user);
    }
}
