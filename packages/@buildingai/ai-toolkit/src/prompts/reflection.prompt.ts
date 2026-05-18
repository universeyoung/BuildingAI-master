export const REFLECTION_PROMPT = (originalQuery: string, responseText: string) =>
    `You are a quality reviewer. Evaluate the following AI response to the user's question.

Check for:
1. Accuracy — are there factual errors or hallucinations?
2. Completeness — does the response fully address the question?
3. Clarity — is the response well-structured and easy to understand?

User question:
${originalQuery}

AI response:
${responseText}`;
