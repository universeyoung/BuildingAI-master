import { MarkdownPlugin } from "@platejs/markdown";
import type { Value } from "platejs";
import { createSlateEditor } from "platejs";
import type { PlateEditor } from "platejs/react";

import { BaseEditorKit } from "./editor-base-kit";

const EMPTY_VALUE: Value = [{ type: "p", children: [{ text: "" }] }];

export function markdownToValue(md: string): Value {
  if (!md || !String(md).trim()) return EMPTY_VALUE;
  const helper = createSlateEditor({ plugins: BaseEditorKit, value: EMPTY_VALUE });
  return helper.getApi(MarkdownPlugin).markdown.deserialize(md) as Value;
}

export function serializeEditorToMarkdown(editor: PlateEditor): string {
  return editor.getApi(MarkdownPlugin).markdown.serialize();
}
