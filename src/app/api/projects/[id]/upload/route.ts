import { NextResponse } from "next/server";
import { z } from "zod";
import { parseBody, requireUserId, route } from "@/lib/api";
import { createUpload } from "@/lib/repositories/uploads";

export const runtime = "nodejs";

const input = z.object({ filename: z.string().max(500).optional() });

export const POST = route(
  "Creating the upload",
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const userId = await requireUserId();
    const { id } = await params;
    const { filename } = await parseBody(request, input);
    return NextResponse.json(await createUpload(userId, id, filename ?? ""));
  }
);
