import { MessageSenderType, MessageContentType } from "@buildingai/db/entities";

export interface MessageInput {
    spaceId: string;
    senderId: string;
    senderType: MessageSenderType;
    content: Record<string, unknown>;
    contentType?: MessageContentType;
    channelId?: string;
}

export interface MemoryInput {
    spaceId: string;
    key: string;
    value: Record<string, unknown>;
    memberId: string;
}

export interface MessageSendResult {
    messageId: string;
    delivered: boolean;
}

export interface MemoryWriteResult {
    entryId: string;
}

export interface MemoryReadResult {
    success: boolean;
    key?: string;
    value?: Record<string, unknown>;
    entries?: any[];
    message?: string;
}
