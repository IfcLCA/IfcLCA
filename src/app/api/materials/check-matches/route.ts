import { NextResponse } from "next/server";
import { parseBody, requireUserId, route } from "@/lib/api";
import { applyKnownMatches, knownMatchesInput } from "@/lib/repositories/materials";

export const POST = route("Checking material matches", async (request: Request) => {
  const userId = await requireUserId();
  const { projectId, materialNames } = await parseBody(request, knownMatchesInput);
  return NextResponse.json(await applyKnownMatches(userId, projectId, materialNames));
});
