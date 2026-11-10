import { NextResponse } from "next/server";
import { requireUserId, route } from "@/lib/api";
import { getUploadImpact } from "@/lib/repositories/uploads";

export const dynamic = "force-dynamic";

export const GET = route(
  "Checking what the deletion affects",
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const userId = await requireUserId();
    const { id } = await params;
    return NextResponse.json(await getUploadImpact(userId, id));
  }
);
