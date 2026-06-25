import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { KnowledgeBaseExplorer } from "@/app/knowledge-base/knowledge-base-explorer";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

type KnowledgeFolderPageProps = {
  params: Promise<{ slug: string }>;
};

type FolderRow = {
  id: string;
  title: string;
  slug: string;
  parentTitle: string | null;
  parentSlug: string | null;
};

type ChildFolderRow = {
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

async function knowledgeFileTableExists() {
  const rows = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT to_regclass('"KnowledgeFile"') IS NOT NULL as "exists"
  `;

  return rows[0]?.exists === true;
}

export default async function KnowledgeFolderPage({ params }: KnowledgeFolderPageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { slug } = await params;
  const role = (session.user as { role?: string }).role;
  const isAdmin = role === "ADMIN";
  const hasKnowledgeFiles = await knowledgeFileTableExists();

  const folders = await prisma.$queryRaw<FolderRow[]>`
    SELECT p."id", p."title", p."slug", parent."title" as "parentTitle", parent."slug" as "parentSlug"
    FROM "Page" p
    LEFT JOIN "Page" parent ON parent."id" = p."parentId"
    WHERE p."slug" = ${slug}
    LIMIT 1
  `;
  const folder = folders[0];

  if (!folder) notFound();

  const [children, files] = await Promise.all([
    hasKnowledgeFiles ? prisma.$queryRaw<ChildFolderRow[]>`
      SELECT
        p."id",
        p."title",
        p."slug",
        p."updatedAt",
        (SELECT COUNT(*)::int FROM "Page" c WHERE c."parentId" = p."id") as "childCount",
        (SELECT COUNT(*)::int FROM "KnowledgeFile" f WHERE f."folderId" = p."id") as "fileCount"
      FROM "Page" p
      WHERE p."parentId" = ${folder.id}
      ORDER BY p."updatedAt" DESC, p."title" ASC
    ` : prisma.$queryRaw<ChildFolderRow[]>`
      SELECT
        p."id",
        p."title",
        p."slug",
        p."updatedAt",
        (SELECT COUNT(*)::int FROM "Page" c WHERE c."parentId" = p."id") as "childCount",
        0::int as "fileCount"
      FROM "Page" p
      WHERE p."parentId" = ${folder.id}
      ORDER BY p."updatedAt" DESC, p."title" ASC
    `,
    hasKnowledgeFiles ? prisma.$queryRaw<FileRow[]>`
      SELECT "id", "displayName", "fileName", "mimeType", "size", "createdAt"
      FROM "KnowledgeFile"
      WHERE "folderId" = ${folder.id}
      ORDER BY "createdAt" DESC, "displayName" ASC
    ` : Promise.resolve([] as FileRow[]),
  ]);

  return (
    <KnowledgeBaseExplorer
      isAdmin={isAdmin}
      currentFolder={{
        id: folder.id,
        title: folder.title,
        slug: folder.slug,
        parent: folder.parentSlug && folder.parentTitle ? { title: folder.parentTitle, slug: folder.parentSlug } : null,
      }}
      folders={children.map((child) => ({
        id: child.id,
        title: child.title,
        slug: child.slug,
        childCount: child.childCount,
        fileCount: child.fileCount,
        updatedAt: child.updatedAt.toISOString(),
      }))}
      files={files.map((file) => ({
        ...file,
        createdAt: file.createdAt.toISOString(),
      }))}
    />
  );
}
