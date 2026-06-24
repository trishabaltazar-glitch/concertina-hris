"use client";

import ImageExtension from "@tiptap/extension-image";
import LinkExtension from "@tiptap/extension-link";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Braces,
  ImageIcon,
  Italic,
  LinkIcon,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  UnderlineIcon,
  Undo2,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  editable?: boolean;
  placeholder?: string;
  editorClassName?: string;
}

const headingLevels = [1, 2, 3, 4] as const;

type HeadingLevel = (typeof headingLevels)[number];

type ToolbarButtonProps = {
  active?: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
};

function ToolbarButton({ active = false, disabled = false, label, onClick, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40",
        active && "bg-muted text-primary"
      )}
      title={label}
      aria-label={label}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="mx-1 h-5 w-px bg-border" />;
}

function getHeadingValue(editor: Editor) {
  const activeHeading = headingLevels.find((level) => editor.isActive("heading", { level }));
  return activeHeading ? String(activeHeading) : "paragraph";
}

function setHeading(editor: Editor, value: string) {
  const chain = editor.chain().focus();

  if (value === "paragraph") {
    chain.setParagraph().run();
    return;
  }

  chain.toggleHeading({ level: Number(value) as HeadingLevel }).run();
}

function setLink(editor: Editor) {
  const currentHref = editor.getAttributes("link").href as string | undefined;
  const href = window.prompt("Paste link URL", currentHref ?? "https://");

  if (href === null) {
    return;
  }

  const normalizedHref = href.trim();

  if (!normalizedHref) {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    return;
  }

  editor.chain().focus().extendMarkRange("link").setLink({ href: normalizedHref }).run();
}

function addImage(editor: Editor) {
  const src = window.prompt("Paste image URL", "https://");

  if (!src?.trim()) {
    return;
  }

  editor.chain().focus().setImage({ src: src.trim(), alt: "Announcement image" }).run();
}

export function RichTextEditor({
  content,
  onChange,
  editable = true,
  placeholder = "Start typing your document here...",
  editorClassName,
}: RichTextEditorProps) {
  const [isSourceMode, setIsSourceMode] = useState(false);
  const [sourceContent, setSourceContent] = useState(content);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [...headingLevels],
        },
      }),
      Underline,
      LinkExtension.configure({
        autolink: true,
        defaultProtocol: "https",
        openOnClick: false,
        protocols: ["http", "https", "mailto", "tel"],
        HTMLAttributes: {
          rel: "noopener noreferrer",
          target: "_blank",
        },
      }),
      ImageExtension.configure({
        allowBase64: false,
        inline: false,
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: "is-editor-empty",
      }),
    ],
    content,
    editable,
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm max-w-none text-sm leading-6 text-foreground outline-none dark:prose-invert sm:prose-base",
          "min-h-[220px] [&_.is-editor-empty:first-child::before]:pointer-events-none [&_.is-editor-empty:first-child::before]:float-left [&_.is-editor-empty:first-child::before]:h-0 [&_.is-editor-empty:first-child::before]:text-muted-foreground [&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
          "[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_h3]:font-semibold [&_h4]:font-semibold [&_hr]:my-4 [&_hr]:border-border [&_img]:max-h-72 [&_img]:max-w-full [&_img]:rounded-md [&_img]:border [&_img]:border-border [&_li]:my-1 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6",
          editorClassName
        ),
      },
    },
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Keep content in sync if it changes externally
  useEffect(() => {
    if (isSourceMode) {
      return;
    }

    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [content, editor, isSourceMode]);

  function toggleSourceMode() {
    if (!editor) {
      return;
    }

    if (isSourceMode) {
      editor.commands.setContent(sourceContent, { emitUpdate: false });
      const normalizedHtml = editor.getHTML();
      setSourceContent(normalizedHtml);
      onChange(normalizedHtml);
      setIsSourceMode(false);
      return;
    }

    const html = editor.getHTML();
    setSourceContent(html);
    onChange(html);
    setIsSourceMode(true);
  }

  function updateSourceContent(value: string) {
    setSourceContent(value);
    onChange(value);
  }

  if (!editor) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-md border border-input bg-background">
      {editable && (
        <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/40 p-2">
          <select
            value={getHeadingValue(editor)}
            onChange={(event) => setHeading(editor, event.target.value)}
            disabled={isSourceMode}
            className="h-8 rounded-md border border-border bg-background px-2 text-xs font-medium text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
            aria-label="Text style"
          >
            <option value="paragraph">Paragraph</option>
            {headingLevels.map((level) => (
              <option key={level} value={String(level)}>
                Heading {level}
              </option>
            ))}
          </select>
          <ToolbarDivider />
          <ToolbarButton active={editor.isActive("bold")} disabled={isSourceMode} label="Bold" onClick={() => editor.chain().focus().toggleBold().run()}>
            <Bold className="size-4" />
          </ToolbarButton>
          <ToolbarButton active={editor.isActive("italic")} disabled={isSourceMode} label="Italic" onClick={() => editor.chain().focus().toggleItalic().run()}>
            <Italic className="size-4" />
          </ToolbarButton>
          <ToolbarButton active={editor.isActive("underline")} disabled={isSourceMode} label="Underline" onClick={() => editor.chain().focus().toggleUnderline().run()}>
            <UnderlineIcon className="size-4" />
          </ToolbarButton>
          <ToolbarButton active={editor.isActive("strike")} disabled={isSourceMode} label="Strikethrough" onClick={() => editor.chain().focus().toggleStrike().run()}>
            <Strikethrough className="size-4" />
          </ToolbarButton>
          <ToolbarDivider />
          <ToolbarButton active={editor.isActive("bulletList")} disabled={isSourceMode} label="Bullet list" onClick={() => editor.chain().focus().toggleBulletList().run()}>
            <List className="size-4" />
          </ToolbarButton>
          <ToolbarButton active={editor.isActive("orderedList")} disabled={isSourceMode} label="Numbered list" onClick={() => editor.chain().focus().toggleOrderedList().run()}>
            <ListOrdered className="size-4" />
          </ToolbarButton>
          <ToolbarButton active={editor.isActive("blockquote")} disabled={isSourceMode} label="Quote" onClick={() => editor.chain().focus().toggleBlockquote().run()}>
            <Quote className="size-4" />
          </ToolbarButton>
          <ToolbarDivider />
          <ToolbarButton active={editor.isActive({ textAlign: "left" })} disabled={isSourceMode} label="Align left" onClick={() => editor.chain().focus().setTextAlign("left").run()}>
            <AlignLeft className="size-4" />
          </ToolbarButton>
          <ToolbarButton active={editor.isActive({ textAlign: "center" })} disabled={isSourceMode} label="Align center" onClick={() => editor.chain().focus().setTextAlign("center").run()}>
            <AlignCenter className="size-4" />
          </ToolbarButton>
          <ToolbarButton active={editor.isActive({ textAlign: "right" })} disabled={isSourceMode} label="Align right" onClick={() => editor.chain().focus().setTextAlign("right").run()}>
            <AlignRight className="size-4" />
          </ToolbarButton>
          <ToolbarDivider />
          <ToolbarButton active={editor.isActive("link")} disabled={isSourceMode} label="Link" onClick={() => setLink(editor)}>
            <LinkIcon className="size-4" />
          </ToolbarButton>
          <ToolbarButton disabled={isSourceMode} label="Image" onClick={() => addImage(editor)}>
            <ImageIcon className="size-4" />
          </ToolbarButton>
          <ToolbarButton disabled={isSourceMode} label="Divider" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
            <Minus className="size-4" />
          </ToolbarButton>
          <ToolbarDivider />
          <ToolbarButton disabled={isSourceMode || !editor.can().chain().focus().undo().run()} label="Undo" onClick={() => editor.chain().focus().undo().run()}>
            <Undo2 className="size-4" />
          </ToolbarButton>
          <ToolbarButton disabled={isSourceMode || !editor.can().chain().focus().redo().run()} label="Redo" onClick={() => editor.chain().focus().redo().run()}>
            <Redo2 className="size-4" />
          </ToolbarButton>
          <ToolbarDivider />
          <ToolbarButton active={isSourceMode} label="HTML source" onClick={toggleSourceMode}>
            <Braces className="size-4" />
          </ToolbarButton>
        </div>
      )}
      <div className="p-4">
        {isSourceMode ? (
          <textarea
            value={sourceContent}
            onChange={(event) => updateSourceContent(event.target.value)}
            spellCheck={false}
            className={cn(
              "min-h-[220px] w-full resize-y rounded-md border border-border bg-muted/30 px-3 py-2 font-mono text-xs leading-5 text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40",
              editorClassName
            )}
            aria-label="HTML source"
          />
        ) : (
          <EditorContent editor={editor} />
        )}
      </div>
    </div>
  );
}
