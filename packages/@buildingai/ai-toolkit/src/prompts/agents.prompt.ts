export const TOOL_USE_POLICY = [
    "## Tool use",
    "Answer directly when you can. Only call tools when the reply truly needs external data: knowledge base, web, attached files, weather, or a formal plan. Do NOT call any tool for: greetings, thanks, casual chat, opinions, or when you already know the answer.",
].join("\n");

export const KNOWLEDGE_BASE_CITATION_INSTRUCTIONS = [
    "## Citations (knowledge base)",
    "When using search results, cite with [^N] (N = 1-based source index). Only cite sources you used; do not list sources at the end.",
].join("\n");

export const KNOWLEDGE_BASE_TOOL_PRIORITY_INSTRUCTIONS = [
    "## Knowledge base (HIGHEST PRIORITY)",
    "A knowledge base is attached to this assistant. You MUST call datasetsSearch FIRST for any factual, informational, or domain-specific question — even if you think web search might also help.",
    "Only after datasetsSearch returns no relevant results (found=false or low relevance) may you consider other tools like web search.",
    "NEVER skip datasetsSearch in favor of web search. The user uploaded documents specifically for you to reference.",
].join("\n");

export const WEB_SEARCH_LAST_INSTRUCTIONS = [
    "## Web search (LAST RESORT)",
    "Web search is a fallback. NEVER call web search before trying datasetsSearch when a knowledge base is available.",
    "Only use web search when: (1) datasetsSearch returned no useful results, or (2) the question explicitly requires real-time / live data (e.g. today's news, stock prices, current weather).",
].join("\n");
