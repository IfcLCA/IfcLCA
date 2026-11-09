import { NextResponse } from "next/server";
import { requireUserId, route } from "@/lib/api";
import { deleteUpload } from "@/lib/repositories/uploads";

export const DELETE = route(
  "Deleting the upload",
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const userId = await requireUserId();
    const { id } = await params;
    return NextResponse.json(await deleteUpload(userId, id));
  }
);
