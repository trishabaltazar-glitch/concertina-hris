"use client";

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold, Italic, List, ListOrdered, Heading2, Heading3 } from 'lucide-react';
import { useEffect } from 'react';

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  editable?: boolean;
}

export function RichTextEditor({ content, onChange, editable = true }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
      }),
      Placeholder.configure({
        placeholder: 'Start typing your document here...',
        emptyEditorClass: 'is-editor-empty',
      }),
    ],
    content,
    editable,
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert sm:prose-base focus:outline-none max-w-none min-h-[300px]',
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Keep content in sync if it changes externally
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, { emitUpdate: false })
    }
  }, [content, editor])

  if (!editor) {
    return null;
  }

  return (
    <div className="border rounded-md overflow-hidden bg-background">
      {editable && (
        <div className="flex flex-wrap items-center gap-1 p-2 border-b bg-muted/40">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`p-1.5 rounded hover:bg-muted transition-colors ${editor.isActive('heading', { level: 2 }) ? 'bg-muted text-primary' : 'text-muted-foreground'}`}
            title="Heading 2"
          >
            <Heading2 className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={`p-1.5 rounded hover:bg-muted transition-colors ${editor.isActive('heading', { level: 3 }) ? 'bg-muted text-primary' : 'text-muted-foreground'}`}
            title="Heading 3"
          >
            <Heading3 className="size-4" />
          </button>
          <div className="w-px h-4 bg-border mx-1" />
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-1.5 rounded hover:bg-muted transition-colors ${editor.isActive('bold') ? 'bg-muted text-primary' : 'text-muted-foreground'}`}
            title="Bold"
          >
            <Bold className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-1.5 rounded hover:bg-muted transition-colors ${editor.isActive('italic') ? 'bg-muted text-primary' : 'text-muted-foreground'}`}
            title="Italic"
          >
            <Italic className="size-4" />
          </button>
          <div className="w-px h-4 bg-border mx-1" />
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-1.5 rounded hover:bg-muted transition-colors ${editor.isActive('bulletList') ? 'bg-muted text-primary' : 'text-muted-foreground'}`}
            title="Bullet List"
          >
            <List className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`p-1.5 rounded hover:bg-muted transition-colors ${editor.isActive('orderedList') ? 'bg-muted text-primary' : 'text-muted-foreground'}`}
            title="Numbered List"
          >
            <ListOrdered className="size-4" />
          </button>
        </div>
      )}
      <div className="p-4">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
