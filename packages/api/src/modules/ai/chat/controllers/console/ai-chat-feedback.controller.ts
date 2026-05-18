import { BaseController } from "@buildingai/base";
import { ConsoleController } from "@common/decorators/controller.decorator";
import { Permissions } from "@common/decorators/permissions.decorator";
import { Get, Param } from "@nestjs/common";

import { AiChatFeedbackService } from "../../services/ai-chat-feedback.service";

/** Console 反馈：仅保留按消息查询；按会话的反馈已合并到「对话消息」接口的 message.feedback */
@ConsoleController("ai-chat-feedback", "对话反馈")
export class AiChatFeedbackConsoleController extends BaseController {
    constructor(private readonly feedbackService: AiChatFeedbackService) {
        super();
    }

    @Get("message/:messageId")
    @Permissions({
        code: "detail",
        name: "查询消息反馈",
    })
    async getFeedbackByMessage(@Param("messageId") messageId: string) {
        return await this.feedbackService.getFeedbackByMessageForConsole(messageId);
    }
}
