import { NextResponse } from "next/server";
import { MaterialService } from "@/lib/services/material-service";
import dbConnect from "@/lib/db";

export async function GET() {
  try {
    await dbConnect();
    const projects = await MaterialService.getProjectsWithMaterials();
    return NextResponse.json(projects);
  } catch (error) {
    console.error("Failed to fetch projects:", error);
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    );
  }
}
