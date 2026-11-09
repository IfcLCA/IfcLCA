import { NextResponse } from "next/server";
import { requireUserId, route } from "@/lib/api";
import { emissionsForUser } from "@/lib/repositories/emissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route("Calculating emissions", async () => {
  const userId = await requireUserId();
  return NextResponse.json(await emissionsForUser(userId));
});
