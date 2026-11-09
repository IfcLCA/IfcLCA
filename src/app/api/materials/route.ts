import { NextResponse } from "next/server";
import { requireUserId, route } from "@/lib/api";
import { listUserMaterials } from "@/lib/repositories/materials";

export const dynamic = "force-dynamic";

export const GET = route("Loading materials", async () => {
  const userId = await requireUserId();
  return NextResponse.json(await listUserMaterials(userId));
});
