import { NextResponse } from "next/server";
import { requireUserId, route } from "@/lib/api";
import { listProjectsWithMaterialIds } from "@/lib/repositories/materials";

export const dynamic = "force-dynamic";

export const GET = route("Loading projects", async () => {
  const userId = await requireUserId();
  return NextResponse.json(await listProjectsWithMaterialIds(userId));
});
