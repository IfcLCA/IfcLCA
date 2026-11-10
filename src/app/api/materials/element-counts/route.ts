import { NextResponse } from "next/server";
import { parseBody, requireUserId, route } from "@/lib/api";
import { countElementsPerMaterial, elementCountsInput } from "@/lib/repositories/materials";

export const POST = route("Counting elements", async (request: Request) => {
  const userId = await requireUserId();
  const { materialIds } = await parseBody(request, elementCountsInput);
  return NextResponse.json(await countElementsPerMaterial(userId, materialIds));
});
