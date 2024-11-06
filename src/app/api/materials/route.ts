import { NextResponse } from "next/server";
import { getMaterialsByProject } from "@/components/materials-table-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    const materials = await getMaterialsByProject(projectId || undefined);
    return NextResponse.json(materials);
  } catch (error) {
    console.error("Failed to fetch materials:", error);
    return NextResponse.json(
      { error: "Failed to fetch materials" },
      { status: 500 }
    );
  }
}
