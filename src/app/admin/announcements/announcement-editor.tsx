"use client";

import { useState } from "react";

import { RichTextEditor } from "@/components/ui/rich-text-editor";

export function AnnouncementEditor() {
  const [content, setContent] = useState("");

  return (
    <div className="space-y-1.5">
      <RichTextEditor
        content={content}
        onChange={setContent}
        placeholder="Write the announcement employees should see."
        editorClassName="min-h-[180px] sm:text-sm"
      />
      <input type="hidden" name="content" value={content} />
    </div>
  );
}
