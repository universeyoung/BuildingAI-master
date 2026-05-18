/**
 * Recursively collects plain text from Plate/Slate-like JSON nodes.
 */
function collectTextFromPlateNode(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (typeof node !== "object") return "";
  if (Array.isArray(node)) return node.map(collectTextFromPlateNode).join("");
  const o = node as { text?: unknown; children?: unknown };
  const text = typeof o.text === "string" ? o.text : "";
  return text + collectTextFromPlateNode(o.children);
}

/**
 * True when the opening statement should render (not only newlines, "/n", "\\n", or empty Plate JSON).
 */
export function hasRenderableOpeningStatement(raw?: string | null): boolean {
  if (raw == null) return false;
  const trimmed = raw.trim();
  if (!trimmed) return false;
  // Bad placeholders that are not real content
  if (trimmed === "/n" || trimmed === "\\n") return false;

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) return false;
      const text = collectTextFromPlateNode(parsed);
      return text.replace(/[\s\u200b\uFEFF]/g, "").length > 0;
    }
    if (typeof parsed === "object" && parsed !== null) {
      const text = collectTextFromPlateNode(parsed);
      return text.replace(/[\s\u200b\uFEFF]/g, "").length > 0;
    }
  } catch {
    // Not JSON — treat as plain markdown/text
  }

  const collapsed = trimmed.replace(/\\[nrt]/g, "").replace(/[\s\u200b\uFEFF]+/g, "");
  return collapsed.length > 0;
}
