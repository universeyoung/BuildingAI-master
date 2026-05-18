export const GOAL_ASSESSMENT_PROMPT = (userMessage: string) =>
    `You are a task complexity assessor. Determine whether the following user request is a COMPLEX task that benefits from step-by-step planning, or a SIMPLE task that can be answered directly.

A task is COMPLEX when it:
- Requires multiple distinct steps or sub-tasks
- Involves research, analysis, and synthesis
- Needs structured output (reports, plans, comparisons)
- Would benefit from intermediate reasoning before answering

A task is SIMPLE when it:
- Can be answered in a single response
- Is a straightforward question or request
- Requires no multi-step reasoning

User request:
${userMessage}`;

export const PLAN_GENERATION_PROMPT = (userMessage: string, context: string) =>
    `You are a planning assistant. Create a concise execution plan for the following task.

Context:
${context}

User request:
${userMessage}

Return a numbered list of steps (max 6 steps). Each step should be one sentence.
Focus on the logical order of operations. Do not add unnecessary steps.`;

export const PLAN_STRUCTURED_GENERATION_PROMPT = (userMessage: string, context: string) =>
    `You are a planning assistant. Create a structured execution plan for the following task.

Important: Use the same language as the user's request. If the user writes in Chinese, output title, description, overview, and keySteps all in Chinese. If the user writes in English, output in English.

Context:
${context}

User request:
${userMessage}

Output a structured plan with:
- title: A short, clear title for the plan (same language as user).
- description: One or two sentences summarizing what the plan covers and its scope.
- overview: A short paragraph (2-4 sentences) explaining the overall approach or strategy.
- keySteps: An ordered list of 3-8 concrete steps, each one clear sentence. Focus on the logical order of operations.`;
