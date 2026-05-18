import { AiAgentsModule } from "@modules/ai/agents/agents.module";
import { AiChatModule } from "@modules/ai/chat/ai-chat.module";
import { AiDatasetsModule } from "@modules/ai/datasets/datasets.module";
import { AiMcpModule } from "@modules/ai/mcp/ai-mcp.module";
import { AiMemoryModule } from "@modules/ai/memory/ai-memory.module";
import { AiModelModule } from "@modules/ai/model/ai-model.module";
import { AiProviderModule } from "@modules/ai/provider/ai-provider.module";
import { SecretManagerModule } from "@modules/ai/secret/secret.module";
import { Module } from "@nestjs/common";

@Module({
    imports: [
        AiAgentsModule,
        AiChatModule,
        AiDatasetsModule,
        AiMcpModule,
        AiMemoryModule,
        AiModelModule,
        AiProviderModule,
        SecretManagerModule,
    ],
    controllers: [],
    providers: [],
    exports: [
        AiAgentsModule,
        AiChatModule,
        AiDatasetsModule,
        AiMcpModule,
        AiMemoryModule,
        AiModelModule,
        AiProviderModule,
        SecretManagerModule,
    ],
})
export class AiModule {}
