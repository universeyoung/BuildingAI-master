import { cn } from "@buildingai/ui/lib/utils";
import type { Value } from "platejs";
import { createSlateEditor } from "platejs";
import { PlateStatic } from "platejs/static";
import * as React from "react";

import { BaseEditorKit } from "../editor-base-kit";
import { markdownToValue } from "../markdown-utils";

function normalizeValue(value: Value | string): Value {
  if (typeof value !== "string") return value;
  if (!value.trim()) return markdownToValue("");
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed as Value;
  } catch {
    /* fall through to markdown */
  }
  return markdownToValue(value);
}

type EditorContentRendererProps = {
  value: Value | string;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "children">;

export const editorPreviewStyle = cn(
  "relative w-full cursor-text select-text overflow-x-hidden whitespace-pre-wrap break-words",
  "rounded-md ring-offset-background focus-visible:outline-none",
  "placeholder:text-muted-foreground/80 **:data-slate-placeholder:top-[auto_!important] **:data-slate-placeholder:text-muted-foreground/80 **:data-slate-placeholder:opacity-100!",
  "[&_strong]:font-bold",
  "scrollbar-pretty",
);

export function EditorContentRenderer({ className, value, ...props }: EditorContentRendererProps) {
  const editor = React.useMemo(
    () =>
      createSlateEditor({
        plugins: BaseEditorKit,
        value: normalizeValue(value),
      }),
    [value],
  );

  return <PlateStatic className={cn(editorPreviewStyle, className)} editor={editor} {...props} />;
}
