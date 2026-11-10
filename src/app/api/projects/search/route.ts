import { NextResponse } from "next/server";
import { requireUserId, route } from "@/lib/api";
import { searchProjects } from "@/lib/repositories/projects";

export const dynamic = "force-dynamic";

export const GET = route("Searching projects", async (request: Request) => {
  const userId = await requireUserId();
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  const all = searchParams.get("all") === "true";
  return NextResponse.json(await searchProjects(userId, query, all));
});
