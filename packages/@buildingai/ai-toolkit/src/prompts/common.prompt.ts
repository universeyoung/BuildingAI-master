export const GENERATE_TITLE_PROMPT = (content: string) =>
    `Generate a concise title (max 10 words) for this conversation. Rules: use the SAME language as the content, output ONLY the title, no quotes or punctuation wrapping.\n\nContent: ${content}`;

/** Short prompt for 3 follow-up questions; one question per line, same language as content, minimal tokens. */
export const GENERATE_FOLLOW_UP_SUGGESTIONS_PROMPT = (userText: string, assistantSummary: string) =>
    `Based on this Q&A, output exactly 3 short follow-up questions the user might ask. One per line. Same language as the content. No numbering, no quotes. Max 15 words each.\n\nQ: ${userText}\n\nA: ${assistantSummary}`;
