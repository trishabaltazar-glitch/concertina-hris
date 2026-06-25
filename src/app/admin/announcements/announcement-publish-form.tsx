"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";

import { createAnnouncement } from "@/app/actions/announcements";
import { SubmitButton } from "@/components/ui/submit-button";

const AnnouncementEditor = dynamic(
  () => import("./announcement-editor").then((module) => module.AnnouncementEditor),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[232px] rounded-lg border border-input bg-muted/30 p-3">
        <div className="h-8 w-48 rounded-md bg-muted" />
        <div className="mt-3 h-28 rounded-md bg-background/70" />
      </div>
    ),
  }
);

export function AnnouncementPublishForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [editorKey, setEditorKey] = useState(0);
  const [error, setError] = useState("");

  async function publishAnnouncement(formData: FormData) {
    setError("");
    const result = await createAnnouncement(formData);

    if (!result.success) {
      setError(result.error ?? "Announcement could not be published.");
      return;
    }

    formRef.current?.reset();
    setEditorKey((current) => current + 1);
  }

  return (
    <form ref={formRef} action={publishAnnouncement} className="space-y-4 px-4 py-4">
      <label className="block space-y-1.5 text-sm font-medium text-foreground">
        Title
        <input
          type="text"
          name="title"
          required
          maxLength={140}
          placeholder="Example: Payroll cutoff reminder"
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </label>

      <div className="space-y-1.5">
        <p className="text-sm font-medium text-foreground">Message</p>
        <AnnouncementEditor key={editorKey} />
      </div>

      {error ? <p className="rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">{error}</p> : null}

      <SubmitButton size="sm" className="w-full">
        Publish announcement
      </SubmitButton>
    </form>
  );
}
