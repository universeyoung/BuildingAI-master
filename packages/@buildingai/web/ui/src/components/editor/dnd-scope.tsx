"use client";

import { createContext, useContext } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

const EditorDndScopeContext = createContext(false);

export const useEditorDndScope = () => useContext(EditorDndScopeContext);

export function EditorDndScope({ children }: { children: React.ReactNode }) {
  return (
    <DndProvider backend={HTML5Backend}>
      <EditorDndScopeContext.Provider value={true}>{children}</EditorDndScopeContext.Provider>
    </DndProvider>
  );
}
