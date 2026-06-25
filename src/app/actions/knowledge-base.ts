"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import slugify from "slugify";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";

const MAX_KNOWLEDGE_FILE_SIZE = 25 * 1024 * 1024;
const ALLOWED_FILE_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-word.document.macroEnabled.12",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

const ALLOWED_FILE_EXTENSIONS = new Set([
  "pdf",
  "doc",
  "docx",
  "docm",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "mp4",
  "webm",
  "mov",
]);

function normalizeFolderName(value: FormDataEntryValue | null) {
  const title = typeof value === "string" ? value.trim() : "";
  return title ? title.slice(0, 80) : "";
}

function normalizeFileDisplayName(value: FormDataEntryValue | null, fallback: string) {
  const title = typeof value === "string" ? value.trim() : "";
  return (title || fallback).slice(0, 120);
}

function getFileExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() || "";
}

function getRevalidationPath(parentSlug?: string | null) {
  return parentSlug ? `/knowledge-base/${parentSlug}` : "/knowledge-base";
}

async function knowledgeFileTableExists() {
  const rows = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT to_regclass('"KnowledgeFile"') IS NOT NULL as "exists"
  `;

  return rows[0]?.exists === true;
}

async function getUniqueSlug(title: string, parentSlug?: string | null) {
  const base = slugify(title, { lower: true, strict: true }) || "folder";
  const prefix = parentSlug ? `${parentSlug}-${base}` : base;
  let candidate = prefix;
  let suffix = 2;

  while (await prisma.page.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    candidate = `${prefix}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

export async function createKnowledgeBaseFolder(formData: FormData) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session?.user?.id || role !== "ADMIN") {
    return { success: false, error: "Only admins can create knowledge base folders." };
  }

  const title = normalizeFolderName(formData.get("title"));
  const parentId = typeof formData.get("parentId") === "string" ? String(formData.get("parentId")) : "";

  if (!title) {
    return { success: false, error: "Folder name is required." };
  }

  const parent = parentId
    ? await prisma.page.findUnique({
      where: { id: parentId },
      select: { id: true, slug: true },
    })
    : null;

  if (parentId && !parent) {
    return { success: false, error: "Parent folder was not found." };
  }

  await prisma.page.create({
    data: {
      title,
      slug: await getUniqueSlug(title, parent?.slug),
      content: null,
      authorId: session.user.id,
      parentId: parent?.id,
    },
  });

  revalidatePath("/knowledge-base");
  if (parent?.slug) {
    revalidatePath(`/knowledge-base/${parent.slug}`);
  }

  return { success: true };
}

export async function uploadKnowledgeBaseFile(formData: FormData) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session?.user?.id || role !== "ADMIN") {
    return { success: false, error: "Only admins can upload knowledge base files." };
  }

  if (!(await knowledgeFileTableExists())) {
    return { success: false, error: "File uploads are not ready yet. Apply the latest database migration first." };
  }

  const folderId = typeof formData.get("folderId") === "string" ? String(formData.get("folderId")) : "";
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "Choose a file to upload." };
  }

  if (file.size > MAX_KNOWLEDGE_FILE_SIZE) {
    return { success: false, error: "Files must be 25MB or smaller." };
  }

  const extension = getFileExtension(file.name);
  if (!ALLOWED_FILE_TYPES.has(file.type) && !ALLOWED_FILE_EXTENSIONS.has(extension)) {
    return { success: false, error: "Upload a PDF, Word document, spreadsheet, presentation, image, or video." };
  }

  const folder = folderId
    ? await prisma.page.findUnique({
      where: { id: folderId },
      select: { id: true, slug: true },
    })
    : null;

  if (folderId && !folder) {
    return { success: false, error: "Folder was not found." };
  }

  await prisma.$executeRaw`
    INSERT INTO "KnowledgeFile" (
      "id", "folderId", "uploadedById", "displayName", "fileName", "mimeType", "size", "data", "createdAt", "updatedAt"
    )
    VALUES (
      ${randomUUID()},
      ${folder?.id || null},
      ${session.user.id},
      ${normalizeFileDisplayName(formData.get("displayName"), file.name)},
      ${file.name},
      ${file.type || "application/octet-stream"},
      ${file.size},
      ${Buffer.from(await file.arrayBuffer())},
      ${new Date()},
      ${new Date()}
    )
  `;

  revalidatePath("/knowledge-base");
  if (folder?.slug) {
    revalidatePath(`/knowledge-base/${folder.slug}`);
  }

  return { success: true };
}

export async function deleteKnowledgeBaseFile(fileId: string) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session?.user?.id || role !== "ADMIN") {
    return { success: false, error: "Only admins can delete knowledge base files." };
  }

  if (!(await knowledgeFileTableExists())) {
    return { success: false, error: "File uploads are not ready yet. Apply the latest database migration first." };
  }

  const files = await prisma.$queryRaw<{ id: string; folderSlug: string | null }[]>`
    SELECT kf."id", p."slug" as "folderSlug"
    FROM "KnowledgeFile" kf
    LEFT JOIN "Page" p ON p."id" = kf."folderId"
    WHERE kf."id" = ${fileId}
    LIMIT 1
  `;
  const file = files[0];

  if (!file) {
    return { success: false, error: "File was not found." };
  }

  await prisma.$executeRaw`
    DELETE FROM "KnowledgeFile"
    WHERE "id" = ${fileId}
  `;

  revalidatePath(getRevalidationPath(file.folderSlug));
  return { success: true };
}
