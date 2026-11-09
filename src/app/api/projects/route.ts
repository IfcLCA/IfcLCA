import { NextResponse } from "next/server";
import { parseBody, requireUserId, route } from "@/lib/api";
import { createProject, createProjectInput, listProjectSummaries } from "@/lib/repositories/projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route("Loading projects", async () => {
  const userId = await requireUserId();
  return NextResponse.json(await listProjectSummaries(userId));
});

export const POST = route("Creating the project", async (request: Request) => {
  const userId = await requireUserId();
  const input = await parseBody(request, createProjectInput);
  return NextResponse.json(await createProject(userId, input), { status: 201 });
});
