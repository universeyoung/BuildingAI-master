import { Button } from "@buildingai/ui/components/ui/button";
import { cn } from "@buildingai/ui/lib/utils";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

export function RightFloatingPanel({
  open,
  onOpenChange,
  title,
  children,
  footer,
  container,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Optional container element for portal rendering. Defaults to document.body. */
  container?: HTMLElement | null;
}) {
  if (!open) return null;

  const isInContainer = !!container;

  const content = (
    <>
      <div
        className={cn("z-40 bg-black/20", isInContainer ? "absolute inset-0" : "fixed inset-0")}
        aria-hidden
        onClick={() => onOpenChange(false)}
      />
      <div
        className={cn(
          "bg-background border-border z-50 flex h-full max-h-[85vh] w-[420px] flex-col rounded-xl border shadow-xl",
          isInContainer
            ? "absolute top-1/2 right-4 -translate-y-1/2"
            : "fixed top-1/2 right-10 -translate-y-1/2",
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="right-floating-panel-title"
      >
        <div className="flex shrink-0 items-center justify-between px-4 py-3">
          <h2 id="right-floating-panel-title" className="text-base font-semibold">
            {title}
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => onOpenChange(false)}
            aria-label="关闭"
          >
            <X className="size-4" />
          </Button>
        </div>
        <div className="chat-scroll flex h-full min-h-0 flex-col">
          <div className="h-full min-h-0">{children}</div>
        </div>
        {footer ? <div className="bg-muted shrink-0 rounded-b-xl px-4 py-3">{footer}</div> : null}
      </div>
    </>
  );

  return createPortal(content, container ?? document.body);
}
