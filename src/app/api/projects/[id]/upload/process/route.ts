import { NextResponse } from "next/server";
import { parseBody, requireUserId, route } from "@/lib/api";
import { ingestInput, ingestUpload } from "@/lib/repositories/uploads";

export const runtime = "nodejs";
export const maxDuration = 300;

export const POST = route(
  "Saving the uploaded elements",
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const userId = await requireUserId();
    const { id } = await params;
    const input = await parseBody(request, ingestInput);
    return NextResponse.json(await ingestUpload(userId, id, input));
  }
);
