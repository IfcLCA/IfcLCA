import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Project, Upload, MaterialDeletion } from "@/models";
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";
export const revalidate = 120; // 2 minutes

export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "6");
    const page = parseInt(searchParams.get("page") || "1");
    const skip = (page - 1) * limit;

    await connectToDatabase();

    // Single optimized aggregation query using $unionWith
    const activities = await Project.aggregate([
      { $match: { userId } },
      {
        $facet: {
          projects: [
            {
              $addFields: {
                type: "project_created",
                user: { name: "You" },
                action: "created a new project",
                project: "$name",
                projectId: { $toString: "$_id" },
                timestamp: "$createdAt",
                details: {
                  description: { $ifNull: ["$description", "No description provided"] },
                },
              },
            },
            { $sort: { createdAt: -1 } },
            { $limit: skip + limit },
          ],
          uploads: [
            {
              $lookup: {
                from: "uploads",
                localField: "_id",
                foreignField: "projectId",
                as: "uploads",
              },
            },
            { $unwind: "$uploads" },
            {
              $addFields: {
                type: "file_uploaded",
                user: { name: "You" },
                action: "uploaded a file to",
                project: "$name",
                projectId: { $toString: "$_id" },
                timestamp: "$uploads.createdAt",
                details: {
                  fileName: "$uploads.filename",
                  elementCount: "$uploads.elementCount",
                },
              },
            },
            { $sort: { timestamp: -1 } },
            { $limit: skip + limit },
          ],
          deletions: [
            {
              $lookup: {
                from: "material_deletions",
                localField: "_id",
                foreignField: "projectId",
                as: "deletions",
              },
            },
            { $unwind: "$deletions" },
            {
              $addFields: {
                type: "material_deleted",
                user: { name: "You" },
                action: "deleted a material from",
                project: "$name",
                projectId: { $toString: "$_id" },
                timestamp: "$deletions.createdAt",
                details: {
                  materialName: "$deletions.materialName",
                  reason: { $ifNull: ["$deletions.reason", "No reason provided"] },
                },
              },
            },
            { $sort: { timestamp: -1 } },
            { $limit: skip + limit },
          ],
        },
      },
      {
        $project: {
          allActivities: {
            $concatArrays: ["$projects", "$uploads", "$deletions"],
          },
        },
      },
      { $unwind: "$allActivities" },
      { $replaceRoot: { newRoot: "$allActivities" } },
      { $sort: { timestamp: -1 } },
      { $skip: skip },
      { $limit: limit },
    ]);

    // Get total count for pagination
    const [projectsCount, uploadsCount, materialDeletionsCount] = await Promise.all([
      Project.countDocuments({ userId }),
      Upload.countDocuments({ userId }),
      MaterialDeletion.countDocuments({ userId }),
    ]);

    const totalCount = projectsCount + uploadsCount + materialDeletionsCount;
    const hasMore = skip + activities.length < totalCount;

    // Format activities with proper IDs
    const formattedActivities = activities.map((activity) => ({
      id: `${activity.type}_${activity.projectId}_${activity.timestamp}`,
      type: activity.type,
      user: activity.user,
      action: activity.action,
      project: activity.project,
      projectId: activity.projectId,
      timestamp: activity.timestamp,
      details: activity.details,
    }));

    return NextResponse.json({
      activities: formattedActivities,
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
