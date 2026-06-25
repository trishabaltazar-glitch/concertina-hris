"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  CheckCircle2,
  Download,
  File,
  FileText,
  Film,
  Folder,
  FolderPlus,
  ImageIcon,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";

import {
  createKnowledgeBaseFolder,
  deleteKnowledgeBaseFile,
  uploadKnowledgeBaseFile,
} from "@/app/actions/knowledge-base";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type KnowledgeFolder = {
  id: string;
  title: string;
  slug: string;
  childCount: number;
  fileCount: number;
  updatedAt: string;
};

type KnowledgeFile = {
  id: string;
  displayName: string;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: string;
};

type KnowledgeBaseExplorerProps = {
  isAdmin: boolean;
  currentFolder?: {
    id: string;
    title: string;
    slug: string;
    parent?: { title: string; slug: string } | null;
  };
  folders: KnowledgeFolder[];
  files: KnowledgeFile[];
};

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb >= 10 ? 0 : 1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
}

function FileTypeIcon({ mimeType, className }: { mimeType: string; className?: string }) {
  if (mimeType.startsWith("image/")) return <ImageIcon className={className} />;
  if (mimeType.startsWith("video/")) return <Film className={className} />;
  if (mimeType.includes("pdf") || mimeType.includes("word") || mimeType.includes("document")) {
    return <FileText className={className} />;
  }

  return <File className={className} />;
}

function FolderGlyph({ className }: { className?: string }) {
  return (
    <span className={cn("relative block h-14 w-20", className)} aria-hidden="true">
      <span className="absolute left-1 top-0 h-4 w-9 rounded-t-md bg-brand-steel/75" />
      <span className="absolute inset-x-0 bottom-0 h-12 rounded-md bg-brand-steel shadow-sm shadow-brand-steel/10" />
      <span className="absolute inset-x-1 top-4 h-1 rounded-full bg-white/35" />
    </span>
  );
}

function FolderCard({ folder }: { folder: KnowledgeFolder }) {
  const itemCount = folder.childCount + folder.fileCount;

  return (
    <Link
      href={`/knowledge-base/${folder.slug}`}
      className="group flex h-32 flex-col items-center justify-center rounded-lg border border-transparent bg-transparent p-3 text-center transition-colors hover:border-border hover:bg-muted/25"
    >
      <FolderGlyph className="transition-transform group-hover:-translate-y-0.5" />
      <h2 className="mt-3 max-w-36 truncate text-sm font-semibold text-foreground group-hover:text-primary">{folder.title}</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {itemCount} item{itemCount === 1 ? "" : "s"}
      </p>
    </Link>
  );
}

function FileCard({
  file,
  isAdmin,
  onDelete,
  isDeleting,
}: {
  file: KnowledgeFile;
  isAdmin: boolean;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}) {
  const isImage = file.mimeType.startsWith("image/");
  const fileUrl = `/knowledge-base/files/${file.id}`;

  return (
    <article className="overflow-hidden rounded-lg border border-border bg-background shadow-sm">
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={fileUrl} alt="" className="h-32 w-full object-cover" />
      ) : (
        <div className="grid h-32 place-items-center bg-muted/35 text-muted-foreground">
          <FileTypeIcon mimeType={file.mimeType} className="size-10" />
        </div>
      )}
      <div className="space-y-3 p-4">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-foreground" title={file.displayName}>
            {file.displayName}
          </h2>
          <p className="mt-1 truncate text-xs text-muted-foreground" title={file.fileName}>
            {formatFileSize(file.size)} · {formatDate(file.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="outline" className="h-8 flex-1">
            <a href={fileUrl} target="_blank" rel="noreferrer">
              Open
            </a>
          </Button>
          <Button asChild size="icon-sm" variant="ghost" title="Download">
            <a href={`${fileUrl}?download=1`}>
              <Download className="size-4" />
            </a>
          </Button>
          {isAdmin && (
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              title="Delete"
              disabled={isDeleting}
              onClick={() => onDelete(file.id)}
            >
              {isDeleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

function AdminTools({ folderId }: { folderId?: string }) {
  const router = useRouter();
  const folderFormRef = React.useRef<HTMLFormElement>(null);
  const uploadFormRef = React.useRef<HTMLFormElement>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = React.useState<string | null>(null);
  const [isCreating, startCreating] = React.useTransition();
  const [isUploading, startUploading] = React.useTransition();

  return (
    <div className="space-y-4">
      <form
        ref={folderFormRef}
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          setMessage(null);
          startCreating(async () => {
            const result = await createKnowledgeBaseFolder(formData);
            if (!result.success) {
              setMessage(result.error || "Folder could not be created.");
              return;
            }

            folderFormRef.current?.reset();
            router.refresh();
          });
        }}
        className="space-y-3"
      >
        <input type="hidden" name="parentId" value={folderId || ""} />
        <label className="block space-y-1.5 text-xs font-medium text-muted-foreground">
          Folder name
          <input
            name="title"
            required
            maxLength={80}
            placeholder="Company policies"
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <Button type="submit" size="sm" variant="outline" className="w-full border-dashed" disabled={isCreating}>
          {isCreating ? <Loader2 className="size-4 animate-spin" /> : <FolderPlus className="size-4" />}
          New folder
        </Button>
      </form>

      <form
        ref={uploadFormRef}
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          setMessage(null);
          startUploading(async () => {
            const result = await uploadKnowledgeBaseFile(formData);
            if (!result.success) {
              setMessage(result.error || "File could not be uploaded.");
              return;
            }

            uploadFormRef.current?.reset();
            setSelectedFileName(null);
            router.refresh();
          });
        }}
        className="space-y-3"
      >
        <input type="hidden" name="folderId" value={folderId || ""} />
        <label className="block space-y-1.5 text-xs font-medium text-muted-foreground">
          Display name
          <input
            name="displayName"
            maxLength={120}
            placeholder="Optional label"
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <label className="mt-3 block space-y-1.5 text-xs font-medium text-muted-foreground">
          File
          <span className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 px-4 py-5 text-center transition-colors hover:bg-muted/35">
            <Upload className="size-5 text-muted-foreground" />
            <span className="mt-2 text-sm font-semibold text-foreground">Upload or drag file here</span>
            <span className="mt-1 text-xs font-normal text-muted-foreground">DOC, DOCM, PDF, images, videos up to 25MB</span>
            <input
              name="file"
              type="file"
              required
              accept=".pdf,.doc,.docx,.docm,.xls,.xlsx,.ppt,.pptx,image/*,video/mp4,video/webm,video/quicktime"
              onChange={(event) => {
                setSelectedFileName(event.target.files?.[0]?.name || null);
              }}
              className="sr-only"
            />
          </span>
        </label>
        {selectedFileName && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <File className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-foreground" title={selectedFileName}>
              {selectedFileName}
            </span>
          </div>
        )}
        <Button type="submit" size="sm" className="mt-3 w-full" disabled={isUploading}>
          {isUploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          Upload
        </Button>
      </form>

      {message && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {message}
        </div>
      )}
    </div>
  );
}

export function KnowledgeBaseExplorer({
  isAdmin,
  currentFolder,
  folders,
  files,
}: KnowledgeBaseExplorerProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [isDeleting, startDeleting] = React.useTransition();
  const hasItems = folders.length > 0 || files.length > 0;

  function handleDelete(fileId: string) {
    setDeletingId(fileId);
    startDeleting(async () => {
      await deleteKnowledgeBaseFile(fileId);
      setDeletingId(null);
      router.refresh();
    });
  }

  return (
    <div className="mx-auto w-full max-w-7xl">
      <section className="overflow-hidden rounded-lg border border-border bg-background shadow-sm">
      <div className="border-b border-border bg-muted/15 px-6 py-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
            <Link href="/knowledge-base" className="hover:text-foreground">Knowledge base</Link>
            {currentFolder?.parent && (
              <>
                <span>/</span>
                <Link href={`/knowledge-base/${currentFolder.parent.slug}`} className="hover:text-foreground">{currentFolder.parent.title}</Link>
              </>
            )}
          </div>
          <span className="mt-3 block text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Knowledge base</span>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground">{currentFolder?.title || "Wiki"}</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            Browse company folders, documents, images, videos, and shared HR resources.
          </p>
        </div>
      </div>

      <div className="grid xl:grid-cols-[38%_62%]">
        <aside className="border-b border-border bg-background xl:border-b-0 xl:border-r">
          {isAdmin ? (
            <div className="space-y-5 p-6">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full border border-dashed border-border text-muted-foreground">
                  <Upload className="size-4" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Upload files or create folders</h2>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">Save resources to this folder and keep company references organized.</p>
                </div>
              </div>
              <AdminTools folderId={currentFolder?.id} />
            </div>
          ) : (
            <div className="p-6">
              <div className="flex items-start gap-3">
                <span className="grid size-9 place-items-center rounded-lg bg-muted text-muted-foreground">
                  <BookOpen className="size-4" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Company references</h2>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">Open folders and files shared by the admin team.</p>
                </div>
              </div>
            </div>
          )}

          <div className="border-t border-border p-6">
            <div className="flex items-start gap-3">
              <span className="grid size-9 place-items-center rounded-lg bg-muted text-muted-foreground">
                <CheckCircle2 className="size-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Suggested folders</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Company policies, Announcements, All-hands meeting videos, Benefits, Onboarding, and IT guides.
                </p>
              </div>
            </div>
          </div>
        </aside>

        <div className="bg-background">
          <div className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{currentFolder ? "Current folder" : "Folders"}</p>
            <p className="text-xs text-muted-foreground">{folders.length} folders · {files.length} files</p>
          </div>

          {hasItems ? (
            <div className="space-y-5 px-4 pb-4">
              {folders.length > 0 && (
                <div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
                    {folders.map((folder) => (
                      <FolderCard key={folder.id} folder={folder} />
                    ))}
                  </div>
                </div>
              )}

              {files.length > 0 && (
                <div>
                  <p className={cn("mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground", folders.length && "border-t border-border pt-5")}>Files</p>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {files.map((file) => (
                      <FileCard
                        key={file.id}
                        file={file}
                        isAdmin={isAdmin}
                        onDelete={handleDelete}
                        isDeleting={isDeleting && deletingId === file.id}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center">
              <div className="grid size-12 place-items-center rounded-lg bg-muted text-muted-foreground">
                <Folder className="size-5" />
              </div>
              <h2 className="mt-4 font-semibold text-foreground">Nothing here yet</h2>
              <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
                {isAdmin ? "Create a folder or upload the first file to start organizing this wiki area." : "Folders and files will appear here once admins add them."}
              </p>
            </div>
          )}
        </div>
      </div>
      </section>
    </div>
  );
}
