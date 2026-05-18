import type { UIMessage } from "ai";

import type { ChatMessageUsage } from "./chat-message-usage.interface";

export type ChatUIMessage = UIMessage & {
    usage?: ChatMessageUsage;
    userConsumedPower?: number;
};
