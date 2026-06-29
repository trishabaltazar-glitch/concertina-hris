import { NextRequest, NextResponse } from "next/server";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";

type KnowledgeFileRouteProps = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, { params }: KnowledgeFileRouteProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const files = await prisma.$queryRaw<{
    data: Buffer;
    fileName: string;
    mimeType: string;
    size: number;
  }[]>`
    SELECT "data", "fileName", "mimeType", "size"
    FROM "KnowledgeFile"
    WHERE "id" = ${id}
    LIMIT 1
  `;
  const file = files[0];

  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const disposition = request.nextUrl.searchParams.get("download") === "1" ? "attachment" : "inline";

  return new NextResponse(new Blob([new Uint8Array(file.data)], { type: file.mimeType }), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(file.size),
      "Content-Disposition": `${disposition}; filename="${encodeURIComponent(file.fileName)}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
