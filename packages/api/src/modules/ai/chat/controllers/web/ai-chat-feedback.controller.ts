import { BaseController } from "@buildingai/base";
import { type UserPlayground } from "@buildingai/db";
import { Playground } from "@buildingai/decorators/playground.decorator";
import { HttpErrorFactory } from "@buildingai/errors";
import { WebController } from "@common/decorators/controller.decorator";
import { Body, Param, Post, Put } from "@nestjs/common";

import { CreateFeedbackDto, UpdateFeedbackDto } from "../../dto/ai-chat-feedback.dto";
import { AiChatFeedbackService } from "../../services/ai-chat-feedback.service";

/**
 * 前台对话反馈 API：仅提供创建/更新反馈，读状态由「对话消息接口」返回的 message.feedback 提供
 */
@WebController("ai-chat-feedback")
export class AiChatFeedbackWebController extends BaseController {
    constructor(private readonly feedbackService: AiChatFeedbackService) {
        super();
    }

    @Post()
    async createFeedback(@Body() dto: CreateFeedbackDto, @Playground() playground: UserPlayground) {
        return await this.feedbackService.createOrUpdateFeedback(playground.id, dto.messageId, dto);
    }

    @Put(":id")
    async updateFeedback(
        @Param("id") id: string,
        @Body() dto: UpdateFeedbackDto,
        @Playground() playground: UserPlayground,
    ) {
        const feedback = await this.feedbackService.findOneById(id);
        if (!feedback) {
            throw HttpErrorFactory.notFound("反馈不存在");
        }
        if (feedback.userId && feedback.userId !== playground.id) {
            throw HttpErrorFactory.unauthorized("无权操作此反馈");
        }
        return await this.feedbackService.updateById(id, dto);
    }
}
