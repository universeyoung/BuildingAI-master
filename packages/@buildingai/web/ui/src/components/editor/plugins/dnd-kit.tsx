"use client";

import { DndPlugin } from "@platejs/dnd";
import { PlaceholderPlugin } from "@platejs/media/react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

import { useEditorDndScope } from "../dnd-scope";
import { BlockDraggable } from "../ui/block-draggable";

function DndSlateWrapper({ children }: { children: React.ReactNode }) {
  const inScope = useEditorDndScope();
  if (inScope) return <>{children}</>;
  return <DndProvider backend={HTML5Backend}>{children}</DndProvider>;
}

export const DndKit = [
  DndPlugin.configure({
    options: {
      enableScroller: true,
      onDropFiles: ({ dragItem, editor, target }) => {
        editor
          .getTransforms(PlaceholderPlugin)
          .insert.media(dragItem.files, { at: target, nextBlock: false });
      },
    },
    render: {
      aboveNodes: BlockDraggable,
      aboveSlate: ({ children }) => <DndSlateWrapper>{children}</DndSlateWrapper>,
    },
  }),
];
