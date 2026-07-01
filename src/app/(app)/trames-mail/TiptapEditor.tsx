"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import { Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Link2, Link2Off } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Toolbar ──────────────────────────────────────────────────────────────────

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={cn(
        "h-7 w-7 flex items-center justify-center rounded text-sm transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
        disabled && "opacity-40 cursor-default"
      )}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  function addLink() {
    const url = window.prompt("URL du lien :");
    if (!url) return;
    editor.chain().focus().setLink({ href: url }).run();
  }

  return (
    <div className="flex items-center gap-0.5 px-2 py-1.5 border-b bg-muted/30 flex-wrap">
      <ToolbarButton
        title="Gras"
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive("bold")}
      >
        <Bold className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        title="Italique"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive("italic")}
      >
        <Italic className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        title="Souligné"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        active={editor.isActive("underline")}
      >
        <UnderlineIcon className="h-3.5 w-3.5" />
      </ToolbarButton>
      <div className="w-px h-4 bg-border mx-1" />
      <ToolbarButton
        title="Liste à puces"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive("bulletList")}
      >
        <List className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        title="Liste numérotée"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive("orderedList")}
      >
        <ListOrdered className="h-3.5 w-3.5" />
      </ToolbarButton>
      <div className="w-px h-4 bg-border mx-1" />
      <ToolbarButton
        title="Ajouter un lien"
        onClick={addLink}
        active={editor.isActive("link")}
      >
        <Link2 className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        title="Supprimer le lien"
        onClick={() => editor.chain().focus().unsetLink().run()}
        disabled={!editor.isActive("link")}
      >
        <Link2Off className="h-3.5 w-3.5" />
      </ToolbarButton>
    </div>
  );
}

// ─── Editor ───────────────────────────────────────────────────────────────────

export function useTiptapEditor(initialContent: string) {
  return useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
    ],
    content: initialContent || "<p></p>",
    immediatelyRender: false,
  });
}

export function TiptapEditor({
  editor,
  placeholder,
}: {
  editor: Editor | null;
  placeholder?: string;
}) {
  return (
    <div className="tiptap-editor rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring overflow-hidden">
      {editor && <Toolbar editor={editor} />}
      <EditorContent
        editor={editor}
        className="text-sm"
        placeholder={placeholder}
      />
    </div>
  );
}
