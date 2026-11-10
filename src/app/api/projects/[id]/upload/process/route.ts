import { NextResponse } from "next/server";
import { parseBody, requireUserId, route } from "@/lib/api";
import { ingestInput, ingestUpload, markUploadFailed } from "@/lib/repositories/uploads";

export const runtime = "nodejs";
export const maxDuration = 300;

export const POST = route(
  "Saving the uploaded elements",
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const userId = await requireUserId();
    const { id } = await params;
    const raw = request.clone();
    let input;
    try {
      input = await parseBody(request, ingestInput);
    } catch (error) {
      // A rejected payload never reaches ingestUpload; don't leave the upload Processing.
      const body: unknown = await raw.json().catch(() => null);
      const uploadId = (body as { uploadId?: unknown } | null)?.uploadId;
      await markUploadFailed(userId, id, uploadId, error);
      throw error;
    }
    return NextResponse.json(await ingestUpload(userId, id, input));
  }
);
