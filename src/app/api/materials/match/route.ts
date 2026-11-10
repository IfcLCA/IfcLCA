import { NextResponse } from "next/server";
import { parseBody, requireUserId, route } from "@/lib/api";
import { matchInput, matchMaterials } from "@/lib/repositories/materials";

export const POST = route("Matching materials", async (request: Request) => {
  const userId = await requireUserId();
  const input = await parseBody(request, matchInput);
  return NextResponse.json(await matchMaterials(userId, input));
});
