import { NextResponse } from "next/server";
import { MaterialService } from "@/lib/services/material-service";
import { connectToDatabase } from "@/lib/mongodb";
import { auth } from "@clerk/nextjs/server";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();
    const projects = await MaterialService.getProjectsWithMaterials(userId);
    return NextResponse.json(projects);
  } catch (error) {
    // Log full error details on server with stack trace
    logger.error("Failed to fetch projects", {
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
      } : error,
    });

    // Return generic error to client, only include details in non-production
    const response: { error: string; details?: string } = {
      error: "Failed to fetch projects",
    };

    if (process.env.NODE_ENV !== "production") {
      response.details = error instanceof Error ? error.message : "Unknown error";
    }

    return NextResponse.json(response, { status: 500 });
  }
}