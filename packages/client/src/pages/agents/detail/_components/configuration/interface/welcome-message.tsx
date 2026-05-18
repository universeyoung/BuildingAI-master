import {
  Editor,
  EditorContainer,
  EditorKit,
  markdownToValue,
  Plate,
  serializeEditorToMarkdown,
  usePlateEditor,
} from "@buildingai/ui/components/editor";
import { Tooltip, TooltipContent, TooltipTrigger } from "@buildingai/ui/components/ui/tooltip";
import { HelpCircle } from "lucide-react";
import { memo, useMemo } from "react";

const DEFAULT_PLACEHOLDER = "你好，我是智能体默认开场白，你可以在界面配置中修改我";

function parseEditorValue(raw: unknown): any[] {
  if (Array.isArray(raw) && raw.length > 0) return raw;
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {
      /* fall through to markdown */
    }
    return markdownToValue(raw).map((n) => n) as any[];
  }
  return markdownToValue("").map((n) => n) as any[];
}

export const WelcomeMessage = memo(
  ({ value, onChange }: { value: string; onChange: (value: string) => void }) => {
    const welcomeInitialValue = useMemo(
      () => parseEditorValue(value || DEFAULT_PLACEHOLDER),
      [value],
    );

    const welcomeEditor = usePlateEditor({
      plugins: EditorKit,
      id: "agent-welcome",
      value: welcomeInitialValue,
    });

    return (
      <div className="bg-secondary rounded-lg px-3 py-2.5">
        <div className="mb-2 flex items-center gap-1">
          <h3 className="text-sm font-medium">开场白</h3>
          <Tooltip>
            <TooltipTrigger>
              <HelpCircle className="text-muted-foreground h-4 w-4" />
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-background text-xs">
                工具栏显示不全的时候可以按住 Shift + 鼠标滚轮滚动
              </div>
            </TooltipContent>
          </Tooltip>
        </div>

        <Plate
          editor={welcomeEditor}
          onValueChange={() => {
            onChange(serializeEditorToMarkdown(welcomeEditor));
          }}
        >
          <EditorContainer className="bg-background rounded-lg">
            <Editor variant="default" className="pb-30!" />
          </EditorContainer>
        </Plate>
      </div>
    );
  },
);

WelcomeMessage.displayName = "WelcomeMessage";
