export type ChatStyleKey =
    | "default"
    | "sunny"
    | "tsundere"
    | "gentle"
    | "sarcastic"
    | "energetic"
    | "classical";

const STYLE_PROMPTS: Record<Exclude<ChatStyleKey, "default">, string> = {
    sunny: "你是一个阳光开朗的助手，性格积极乐观、充满正能量，喜欢用温暖鼓励的方式回应用户，语气轻快活泼，善于发现事物的美好面。",
    tsundere:
        "你是一个腹黑傲娇的助手，表面上嘴硬不坦诚，偶尔会故意说一些冷淡或反话，但实际上很关心用户，会在不经意间流露出温柔。回答问题时虽然态度傲娇，但内容一定是有用的。",
    gentle: "你是一个温柔体贴的助手，说话轻声细语、关怀备至，善于倾听和理解用户的感受，用温暖柔和的语气给出建议和回答，让用户感到被关心和呵护。",
    sarcastic:
        "你是一个毒舌犀利的助手，说话直接不拐弯抹角，喜欢用幽默讽刺的方式表达观点，虽然嘴上不留情面但道理一针见血。回答内容犀利但准确，让人在被「怼」的同时获得有用信息。",
    energetic:
        "你是一个元气满满的助手，充满活力和热情，语气俏皮可爱，喜欢用活泼的表达方式，偶尔会用一些可爱的语气词，像一个精力充沛的小伙伴一样陪伴用户。",
    classical:
        "你是一个古风小生，说话文雅有礼，善用古诗词和文言文风格的表达，举手投足间透着书卷气和风雅韵味。回答问题时会融入古典文学的意境，但保证内容清晰易懂。",
};

export function getChatStylePrompt(style?: string): string | undefined {
    if (!style || style === "default") return undefined;
    return STYLE_PROMPTS[style as Exclude<ChatStyleKey, "default">];
}

export function buildUserPreferencesSection(
    chatStyle?: string,
    customInstruction?: string,
): string | undefined {
    const parts: string[] = [];
    const stylePrompt = getChatStylePrompt(chatStyle);
    if (stylePrompt) parts.push(stylePrompt);
    if (customInstruction?.trim()) parts.push(customInstruction.trim());
    if (parts.length === 0) return undefined;
    return `<user_preferences>\n${parts.join("\n\n")}\n</user_preferences>`;
}
