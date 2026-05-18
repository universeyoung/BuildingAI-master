import {
  BaseEditorKit,
  Editor,
  EditorContainer,
  Plate,
  usePlateEditor,
} from "@buildingai/ui/components/editor";
import type {
  DecoratedRange,
  NodeEntry,
  TRange,
  TText,
} from "@buildingai/ui/components/editor/platejs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@buildingai/ui/components/ui/tooltip";
import { cn } from "@buildingai/ui/lib/utils";
import { HelpCircle } from "lucide-react";
import type { ClipboardEvent, KeyboardEvent } from "react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type PromptVariable = {
  name: string;
  label?: string;
};

const VARIABLE_REGEX = /\{\{[a-zA-Z_][a-zA-Z0-9_]{0,29}\}\}/g;
const normalizePromptMarkdown = (content: string) => content.replace(/\\([{}])/g, "$1");
const getNodeText = (node: any): string => {
  if (!node) return "";
  if (typeof node.text === "string") return node.text;
  if (Array.isArray(node.children)) return node.children.map(getNodeText).join("");
  return "";
};
const serializeRolePromptEditor = (editor: { children?: any[] }) =>
  Array.isArray(editor.children) ? editor.children.map(getNodeText).join("\n") : "";
const rolePromptTextToValue = (content: string) => {
  const normalized = normalizePromptMarkdown(content).replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  return (lines.length > 0 ? lines : [""]).map((line) => ({
    type: "p",
    children: [{ text: line }],
  }));
};

export const RolePrompt = memo(
  ({
    value,
    formFields,
    onChange,
  }: {
    value: string;
    formFields: any[];
    onChange: (value: string) => void;
  }) => {
    const variables = useMemo<PromptVariable[]>(() => {
      if (!Array.isArray(formFields)) return [];
      const res: PromptVariable[] = [];
      const seen = new Set<string>();
      for (const item of formFields) {
        const name = typeof item?.name === "string" ? item.name.trim() : "";
        if (!name || seen.has(name)) continue;
        seen.add(name);
        const label = typeof item?.label === "string" ? item.label.trim() : "";
        res.push({ name, label: label || undefined });
      }
      return res;
    }, [formFields]);
    const tooltipText = `定义智能体的身份、性格、专业领域和行为准则
  支持表单变量替换，例如: {{userName}}, {{userType}}, {{company}}
  示例：
  你是一位{{domain}}领域的专家，拥有丰富的经验和专业知识，请为用户提供准确、详细的解答。`;

    const normalizedValue = useMemo(() => normalizePromptMarkdown(value || ""), [value]);
    const editorInitialValue = useMemo(
      () => rolePromptTextToValue(normalizedValue),
      [normalizedValue],
    );

    const editor = usePlateEditor({
      plugins: BaseEditorKit,
      id: "agent-role-prompt",
      value: editorInitialValue,
    });

    useEffect(() => {
      const current = normalizePromptMarkdown(serializeRolePromptEditor(editor));
      if (current !== normalizedValue) {
        editor.tf.setValue(rolePromptTextToValue(normalizedValue));
      }
    }, [editor, normalizedValue]);

    const decorate = useCallback(({ entry }: { entry: NodeEntry }) => {
      const [node, path] = entry as [TText, any];
      const text = (node as any)?.text;
      if (typeof text !== "string" || text.length === 0) return;

      const ranges: DecoratedRange[] = [];
      VARIABLE_REGEX.lastIndex = 0;
      for (let match = VARIABLE_REGEX.exec(text); match; match = VARIABLE_REGEX.exec(text)) {
        const start = match.index;
        const end = start + match[0].length;
        ranges.push({
          anchor: { path, offset: start },
          focus: { path, offset: end },
          variable: true,
        } as any);
      }
      return ranges;
    }, []);

    const renderLeaf = useCallback((props: any) => {
      const { attributes, children, leaf } = props;
      return (
        <span
          {...attributes}
          className={cn(
            attributes?.className,
            leaf?.variable &&
              "bg-primary/10 text-primary mx-1 mb-1 inline-flex items-center rounded-[5px] px-1 py-0.5 align-middle text-sm",
          )}
        >
          {children}
        </span>
      );
    }, []);

    const [pickerOpen, setPickerOpen] = useState(false);
    const [pickerRange, setPickerRange] = useState<TRange | null>(null);
    const [pickerRect, setPickerRect] = useState<{ left: number; top: number } | null>(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const pickerRef = useRef<HTMLDivElement | null>(null);

    const closePicker = useCallback(() => {
      setPickerOpen(false);
      setPickerRange(null);
      setPickerRect(null);
      setActiveIndex(0);
    }, []);

    const deleteTriggerChar = useCallback(() => {
      if (!pickerRange) return;
      editor.tf.delete({ at: pickerRange });
    }, [editor, pickerRange]);

    const insertNewVariablePlaceholder = useCallback(() => {
      if (!pickerRange) return;
      editor.tf.withoutNormalizing(() => {
        editor.tf.delete({ at: pickerRange });
        editor.tf.insertText("{{}}");
        editor.tf.move({ distance: 2, reverse: true });
        editor.tf.focus();
      });
      closePicker();
    }, [closePicker, editor, pickerRange]);

    const selectVariable = useCallback(
      (v: PromptVariable) => {
        if (!pickerRange) return;
        editor.tf.withoutNormalizing(() => {
          editor.tf.delete({ at: pickerRange });
          editor.tf.insertText(`{{${v.name}}}`);
          editor.tf.focus();
        });
        closePicker();
      },
      [closePicker, editor, pickerRange],
    );

    const openPickerAfterInsert = useCallback(() => {
      const end = editor.selection?.anchor;
      if (!end) return;
      const start = editor.api.before(end, { unit: "character" });
      if (!start) return;
      const range = { anchor: start, focus: end } as TRange;

      let rect: DOMRect | null = null;
      try {
        const domRange = editor.api.toDOMRange(range);
        rect = domRange?.getBoundingClientRect?.() ?? null;
      } catch {
        rect = null;
      }

      setPickerRange(range);
      setPickerOpen(true);
      setActiveIndex(0);
      setPickerRect(
        rect
          ? { left: Math.max(8, rect.left), top: Math.max(8, rect.bottom + 8) }
          : { left: 120, top: 120 },
      );
    }, [editor]);

    const onKeyDown = useCallback(
      (e: KeyboardEvent) => {
        if ((e.key === "{" || e.key === "/") && !e.altKey && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          editor.tf.insertText(e.key);
          requestAnimationFrame(openPickerAfterInsert);
          return;
        }

        if (!pickerOpen) return;

        if (e.key === "Escape") {
          e.preventDefault();
          deleteTriggerChar();
          closePicker();
          return;
        }

        if (e.key === "ArrowDown") {
          e.preventDefault();
          setActiveIndex((i) => {
            const max = variables.length === 0 ? 0 : variables.length;
            if (max === 0) return 0;
            return i >= max ? 0 : i + 1;
          });
          return;
        }

        if (e.key === "ArrowUp") {
          e.preventDefault();
          setActiveIndex((i) => {
            const max = variables.length === 0 ? 0 : variables.length;
            if (max === 0) return 0;
            return i <= 0 ? max : i - 1;
          });
          return;
        }

        if (e.key === "Enter") {
          e.preventDefault();
          if (activeIndex === 0) {
            insertNewVariablePlaceholder();
            return;
          }
          const v = variables[activeIndex - 1];
          if (v) selectVariable(v);
          return;
        }

        if (e.key.length === 1 || e.key === "Backspace" || e.key === "Delete") {
          closePicker();
        }
      },
      [
        activeIndex,
        closePicker,
        deleteTriggerChar,
        editor,
        insertNewVariablePlaceholder,
        openPickerAfterInsert,
        pickerOpen,
        selectVariable,
        variables,
      ],
    );

    const handlePaste = useCallback(
      (event: ClipboardEvent<HTMLDivElement>) => {
        const text = event.clipboardData?.getData("text/plain");
        if (!text) return;

        event.preventDefault();
        event.stopPropagation();
        event.nativeEvent.stopImmediatePropagation?.();
        editor.tf.insertText(text.replace(/\r\n?/g, "\n"));
      },
      [editor],
    );

    useEffect(() => {
      if (!pickerOpen) return;

      const onMouseDown = (event: MouseEvent) => {
        const target = event.target as Node | null;
        if (!target) return;
        if (pickerRef.current?.contains(target)) return;
        closePicker();
      };

      const onResizeOrScroll = () => closePicker();

      document.addEventListener("mousedown", onMouseDown, true);
      window.addEventListener("resize", onResizeOrScroll);
      window.addEventListener("scroll", onResizeOrScroll, true);
      return () => {
        document.removeEventListener("mousedown", onMouseDown, true);
        window.removeEventListener("resize", onResizeOrScroll);
        window.removeEventListener("scroll", onResizeOrScroll, true);
      };
    }, [closePicker, pickerOpen]);

    return (
      <div className="bg-secondary rounded-lg px-3 py-2.5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <h3 className="text-sm font-medium">角色设定</h3>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="text-muted-foreground h-4 w-4" />
              </TooltipTrigger>
              <TooltipContent>
                <div style={{ whiteSpace: "pre-wrap" }}>{tooltipText}</div>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="text-muted-foreground bg-background shrink-0 rounded-md px-1.5 py-0.5 text-xs">
            {value.length}
          </div>
        </div>
        <div className="relative">
          <Plate
            editor={editor}
            onValueChange={() => {
              onChange(normalizePromptMarkdown(serializeRolePromptEditor(editor)));
            }}
          >
            <EditorContainer className="bg-background rounded-lg">
              <Editor
                variant="select"
                className="max-h-100 min-h-25 px-3 py-1!"
                placeholder="请输入角色设定..."
                decorate={decorate as any}
                renderLeaf={renderLeaf as any}
                onKeyDown={onKeyDown}
                onPaste={handlePaste}
              />
            </EditorContainer>
          </Plate>

          {pickerOpen &&
            pickerRect &&
            createPortal(
              <div
                ref={(el) => {
                  pickerRef.current = el;
                }}
                style={{ position: "fixed", left: pickerRect.left, top: pickerRect.top }}
                className="bg-popover z-500 w-[260px] overflow-hidden rounded-md border shadow-md"
              >
                <div className="max-h-[220px] overflow-y-auto py-1">
                  <button
                    type="button"
                    className={cn(
                      "mx-1 flex w-[calc(100%-8px)] items-center justify-between rounded-sm px-2 py-1 text-left text-xs",
                      activeIndex === 0
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-primary/10 hover:text-primary",
                    )}
                    onMouseEnter={() => setActiveIndex(0)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      insertNewVariablePlaceholder();
                    }}
                  >
                    <div className="min-w-0 truncate">添加新变量</div>
                    <div className="text-muted-foreground shrink-0 text-[11px]">{"{{}}"}</div>
                  </button>

                  {variables.length === 0 ? (
                    <div className="text-muted-foreground px-3 py-2 text-xs">
                      暂无变量，请先添加表单变量
                    </div>
                  ) : (
                    variables.map((v, idx) => {
                      const menuIndex = idx + 1;
                      return (
                        <button
                          key={v.name}
                          type="button"
                          className={cn(
                            "mx-1 flex w-[calc(100%-8px)] items-center justify-between rounded-sm px-2 py-1 text-left text-xs",
                            menuIndex === activeIndex
                              ? "bg-primary/10 text-primary"
                              : "hover:bg-primary/10 hover:text-primary",
                          )}
                          onMouseEnter={() => setActiveIndex(menuIndex)}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            selectVariable(v);
                          }}
                        >
                          <div className="min-w-0">
                            <div className="truncate">{v.label ?? v.name}</div>
                          </div>
                          <div className="text-muted-foreground shrink-0 text-[11px]">{`{{${v.name}}}`}</div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>,
              document.body,
            )}
        </div>
      </div>
    );
  },
);

RolePrompt.displayName = "RolePrompt";
