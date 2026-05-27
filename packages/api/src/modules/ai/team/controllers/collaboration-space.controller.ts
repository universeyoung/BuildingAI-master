import { Body, Get, Param, Post, Query } from "@nestjs/common";
import { WebController } from "@common/decorators/controller.decorator";
import { CollaborationSpaceService } from "../services/collaboration-space.service";
import { MessageSenderType, MessageContentType } from "@buildingai/db/entities";

@WebController("space")
export class CollaborationSpaceController {
    constructor(private readonly spaceService: CollaborationSpaceService) {}

    @Get(":teamId/memory")
    async getMemory(@Param("teamId") teamId: string, @Query("key") key?: string) {
        const space = await this.spaceService.getByTeam(teamId);
        if (!space) {
            return { success: false, message: "协作空间不存在" };
        }

        if (key) {
            const value = await this.spaceService.readMemory((space as any).id, key);
            return { success: true, key, value };
        }

        const entries = await this.spaceService.getAllMemory((space as any).id);
        return { success: true, entries };
    }

    @Post(":teamId/memory")
    async writeMemory(@Param("teamId") teamId: string, @Body() body: { key: string; value: Record<string, unknown>; memberId: string }) {
        const space = await this.spaceService.getByTeam(teamId);
        if (!space) {
            return { success: false, message: "协作空间不存在" };
        }

        return this.spaceService.writeMemory({
            spaceId: (space as any).id,
            key: body.key,
            value: body.value,
            memberId: body.memberId,
        });
    }

    @Get(":teamId/messages")
    async getMessages(@Param("teamId") teamId: string) {
        const space = await this.spaceService.getByTeam(teamId);
        if (!space) {
            return { success: false, message: "协作空间不存在" };
        }

        return this.spaceService.getMessages((space as any).id);
    }

    @Post(":teamId/messages")
    async sendMessage(@Param("teamId") teamId: string, @Body() body: { senderId: string; senderType?: MessageSenderType; content: Record<string, unknown>; contentType?: MessageContentType }) {
        const space = await this.spaceService.getByTeam(teamId);
        if (!space) {
            return { success: false, message: "协作空间不存在" };
        }

        return this.spaceService.sendMessage({
            spaceId: (space as any).id,
            senderId: body.senderId,
            senderType: body.senderType || MessageSenderType.AI,
            content: body.content,
            contentType: body.contentType,
        });
    }

    @Get(":teamId/memory/search")
    async searchMemory(@Param("teamId") teamId: string, @Query("query") query: string) {
        const space = await this.spaceService.getByTeam(teamId);
        if (!space) {
            return { success: false, message: "协作空间不存在" };
        }

        return this.spaceService.searchMemory((space as any).id, query);
    }
}
