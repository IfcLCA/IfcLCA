import { NextResponse } from "next/server";
import { parseBody, requireUserId, route } from "@/lib/api";
import {
  deleteProject,
  getProjectDetail,
  getProjectSummary,
  updateProject,
  updateProjectInput,
} from "@/lib/repositories/projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route("Loading the project", async (request: Request, { params }: Ctx) => {
  const userId = await requireUserId();
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  if (searchParams.get("summary") === "true") {
    return NextResponse.json(await getProjectSummary(userId, id));
  }
  const includeAllElements = searchParams.get("includeAllElements") === "true";
  return NextResponse.json(await getProjectDetail(userId, id, { includeAllElements }));
});

const update = route("Updating the project", async (request: Request, { params }: Ctx) => {
  const userId = await requireUserId();
  const { id } = await params;
  const input = await parseBody(request, updateProjectInput);
  return NextResponse.json(await updateProject(userId, id, input));
});

export const PUT = update;
export const PATCH = update;

export const DELETE = route("Deleting the project", async (_request: Request, { params }: Ctx) => {
  const userId = await requireUserId();
  const { id } = await params;
  await deleteProject(userId, id);
  return new Response(null, { status: 204 });
});
