import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Project, Upload, MaterialDeletion } from "@/models";
import { auth } from "@clerk/nextjs/server";
import mongoose from "mongoose";

// Define types for lean documents
interface LeanProject {
  _id: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  createdAt: Date;
}

interface LeanUpload {
  _id: mongoose.Types.ObjectId;
  filename: string;
  elementCount: number;
  createdAt: Date;
  projectId: {
    _id: mongoose.Types.ObjectId;
    name: string;
  };
}

interface LeanMaterialDeletion {
  _id: mongoose.Types.ObjectId;
  materialName: string;
  reason?: string;
  createdAt: Date;
  projectId: {
    _id: mongoose.Types.ObjectId;
    name: string;
  };
}

export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;

    await connectToDatabase();

    // Fetch all activities in one go, sorted by creation date
    const [projects, uploads, materialDeletions] = await Promise.all([
      Project.find({ userId })
        .sort({ createdAt: -1 })
        .limit(limit * 2) // Get more than needed to have variety
        .select("_id name description createdAt")
        .lean()
        .exec()
        .then(docs => docs as unknown as LeanProject[]),
      Upload.find({ userId })
        .sort({ createdAt: -1 })
        .limit(limit * 2)
        .select("_id filename elementCount createdAt projectId")
        .populate("projectId", "name")
        .lean()
        .exec()
        .then(docs => docs as unknown as LeanUpload[]),
      MaterialDeletion.find({ userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .select("_id materialName reason createdAt projectId")
        .populate("projectId", "name")
        .lean()
        .exec()
        .then(docs => docs as unknown as LeanMaterialDeletion[]),
    ]);

    // Format activities
    const activities = [
      ...projects.map((project) => ({
        id: project._id.toString(),
        type: "project_created",
        user: {
          name: "You",
          imageUrl: "/placeholder-avatar.jpg",
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
          imageUrl: "/placeholder-avatar.jpg",
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
      ...materialDeletions.map((deletion) => ({
        id: deletion._id.toString(),
        type: "material_deleted",
        user: {
          name: "You",
          imageUrl: "/placeholder-avatar.jpg",
        },
        action: "deleted a material from",
        project: deletion.projectId?.name || "Unknown Project",
        projectId: deletion.projectId?._id?.toString() || "",
        timestamp: deletion.createdAt,
        details: {
          materialName: deletion.materialName,
          reason: deletion.reason || "No reason provided",
        },
      })),
    ];

    // Sort by timestamp descending
    const sortedActivities = activities.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Apply pagination to the combined sorted activities
    const paginatedActivities = sortedActivities.slice(skip, skip + limit);

    // Since we're fetching more items than the limit, we can estimate if there are more
    const totalFetched = projects.length + uploads.length + materialDeletions.length;
    const hasMore = totalFetched >= limit * 2; // If we got the max we fetched, there are likely more

    return NextResponse.json({
      activities: paginatedActivities,
      hasMore,
      total: totalFetched,
    });
  } catch (error) {
    console.error("Failed to fetch activities:", error);
    return NextResponse.json(
      { error: "Failed to fetch activities" },
      { status: 500 }
    );
  }
}
