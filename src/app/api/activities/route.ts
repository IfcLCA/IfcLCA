import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Project, Upload } from "@/models";
import { auth } from "@clerk/nextjs/server";

export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = 5; // Fixed limit of 5 items
    const skip = (page - 1) * limit;

    await connectToDatabase();

    // Get total counts for pagination
    const [projectsCount, uploadsCount] = await Promise.all([
      Project.countDocuments({ userId }),
      Upload.countDocuments({ userId }),
    ]);

    // Fetch paginated projects and uploads
    const [projects, uploads] = await Promise.all([
      Project.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Upload.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("projectId", "name")
        .lean(),
    ]);

    // Format activities
    const activities = [
      ...projects.map((project) => ({
        id: project._id.toString(),
        type: "project_created",
        user: {
          name: "You",
          avatar: "/placeholder-avatar.jpg",
        },
        action: "created a new project",
        project: project.name,
        projectId: project._id.toString(),
        timestamp: project.createdAt,
        details: {
          description: project.description || "No description provided",
        },
      })),
      ...uploads.map((upload) => ({
        id: upload._id.toString(),
        type: "file_uploaded",
        user: {
          name: "You",
          avatar: "/placeholder-avatar.jpg",
        },
        action: "uploaded a file to",
        project: upload.projectId?.name || "Unknown Project",
        projectId: upload.projectId?._id?.toString() || "",
        timestamp: upload.createdAt,
        details: {
          fileName: upload.filename,
          elementCount: upload.elementCount || 0,
        },
      })),
    ];

    // Sort by timestamp descending
    const sortedActivities = activities.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    const totalCount = projectsCount + uploadsCount;
    const hasMore = skip + sortedActivities.length < totalCount;

    return NextResponse.json({
      activities: sortedActivities,
      hasMore,
      total: totalCount,
    });
  } catch (error) {
    console.error("Failed to fetch activities:", error);
    return NextResponse.json(
      { error: "Failed to fetch activities" },
      { status: 500 }
    );
  }
}
