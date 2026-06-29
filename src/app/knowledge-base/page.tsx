import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { KnowledgeBaseExplorer } from "@/app/knowledge-base/knowledge-base-explorer";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

type FolderRow = {
  id: string;
  title: string;
  slug: string;
  updatedAt: Date;
  childCount: number;
  fileCount: number;
};

type FileRow = {
  id: string;
  displayName: string;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: Date;
};

export default async function KnowledgeBasePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const role = (session.user as { role?: string }).role;
  const isAdmin = role === "ADMIN";

  const [folders, files] = await Promise.all([
    prisma.$queryRaw<FolderRow[]>`
      SELECT
        p."id",
        p."title",
        p."slug",
        p."updatedAt",
        (SELECT COUNT(*)::int FROM "Page" c WHERE c."parentId" = p."id") as "childCount",
        (SELECT COUNT(*)::int FROM "KnowledgeFile" f WHERE f."folderId" = p."id") as "fileCount"
      FROM "Page" p
      WHERE p."parentId" IS NULL
      ORDER BY p."updatedAt" DESC, p."title" ASC
    `,
    prisma.$queryRaw<FileRow[]>`
      SELECT "id", "displayName", "fileName", "mimeType", "size", "createdAt"
      FROM "KnowledgeFile"
      WHERE "folderId" IS NULL
      ORDER BY "createdAt" DESC, "displayName" ASC
    `,
  ]);

  return (
    <KnowledgeBaseExplorer
      isAdmin={isAdmin}
      folders={folders.map((folder) => ({
        id: folder.id,
        title: folder.title,
        slug: folder.slug,
        childCount: folder.childCount,
        fileCount: folder.fileCount,
        updatedAt: folder.updatedAt.toISOString(),
      }))}
      files={files.map((file) => ({
        ...file,
        createdAt: file.createdAt.toISOString(),
      }))}
    />
  );
}
