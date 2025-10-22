import { connectToDatabase } from "@/lib/mongodb";
import { Element, Material, Project, Upload } from "@/models";
import { auth } from "@clerk/nextjs/server";
import mongoose from "mongoose";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 60; // Cache for 1 minute

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase();

    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "Invalid project ID" },
        { status: 400 }
      );
    }

    const projectId = new mongoose.Types.ObjectId(id);

    // Check for summary mode (lightweight, fast response)
    const { searchParams } = new URL(request.url);
    const summary = searchParams.get("summary") === "true";
    const includeAllElements = searchParams.get("includeAllElements") === "true";

    if (summary) {
      const project = await Project.findById(projectId)
        .select("name description imageUrl emissions createdAt updatedAt")
        .lean();

      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }

      // Get counts separately (fast queries with indexes)
      const [elementCount, uploadCount, materialCount] = await Promise.all([
        Element.countDocuments({ projectId }),
        Upload.countDocuments({ projectId }),
        Material.countDocuments({ projectId }),
      ]);

      return NextResponse.json({
        ...project,
        elementCount,
        uploadCount,
        materialCount,
      });
    }

    // Check element count - if large project, use pagination
    const elementCount = await Element.countDocuments({ projectId });

    // For large projects (>1000 elements), return summary + pagination flag
    // UNLESS includeAllElements is requested (for export)
    if (elementCount > 1000 && !includeAllElements) {
      const project = await Project.findById(projectId)
        .select("name description imageUrl emissions createdAt updatedAt")
        .lean();

      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }

      const [uploads, uploadCount, materialCount] = await Promise.all([
        Upload.find({ projectId })
          .select("filename status elementCount createdAt")
          .lean(),
        Upload.countDocuments({ projectId }),
        Material.countDocuments({ projectId }),
      ]);

      // Fetch materials with pre-stored volumes
      const materials = await Material.aggregate([
        { $match: { projectId } },
        {
          $lookup: {
            from: "indicatorsKBOB",
            localField: "kbobMatchId",
            foreignField: "_id",
            as: "kbobMatch",
          },
        },
        {
          $unwind: {
            path: "$kbobMatch",
            preserveNullAndEmptyArrays: true,
          },
        },
      ]);

      return NextResponse.json({
        ...project,
        uploads,
        materials,
        elements: [], // Don't load elements - use pagination endpoint
        usePagination: true,
        elementCount,
        uploadCount,
        materialCount,
        totalEmissions: (project as any).emissions || { gwp: 0, ubp: 0, penre: 0 }, // Add totalEmissions for compatibility
        _count: {
          elements: elementCount,
          uploads: uploadCount,
          materials: materialCount,
        },
      });
    }

    // Optimized aggregation pipeline - use pre-calculated data
    const [project] = await Project.aggregate([
      {
        $match: { _id: projectId },
      },
      // 1. Lookup uploads (lightweight)
      {
        $lookup: {
          from: "uploads",
          localField: "_id",
          foreignField: "projectId",
          as: "uploads",
          pipeline: [
            {
              $project: {
                filename: 1,
                status: 1,
                elementCount: 1,
                createdAt: 1,
              },
            },
          ],
        },
      },
      // 2. Lookup elements with material references (no KBOB - faster!)
      {
        $lookup: {
          from: "elements",
          localField: "_id",
          foreignField: "projectId",
          as: "elements",
          pipeline: [
            {
              $lookup: {
                from: "materials",
                localField: "materials.material",
                foreignField: "_id",
                as: "materialRefs",
                pipeline: [
                  {
                    $lookup: {
                      from: "indicatorsKBOB",
                      localField: "kbobMatchId",
                      foreignField: "_id",
                      as: "kbobMatch",
                    },
                  },
                  {
                    $unwind: {
                      path: "$kbobMatch",
                      preserveNullAndEmptyArrays: true,
                    },
                  },
                  {
                    $project: {
                      name: 1,
                      category: 1,
                      density: 1,
                      kbobMatchId: 1,
                      kbobMatch: 1,
                    },
                  },
                ],
              },
            },
            {
              $addFields: {
                materials: {
                  $map: {
                    input: "$materials",
                    as: "mat",
                    in: {
                      $mergeObjects: [
                        "$$mat",
                        {
                          material: {
                            $arrayElemAt: [
                              {
                                $filter: {
                                  input: "$materialRefs",
                                  cond: {
                                    $eq: ["$$this._id", "$$mat.material"],
                                  },
                                },
                              },
                              0,
                            ],
                          },
                        },
                      ],
                    },
                  },
                },
                totalVolume: { $sum: "$materials.volume" },
              },
            },
            {
              $unset: "materialRefs", // Remove temp field using $unset instead of $project
            },
          ],
        },
      },
      // 3. Lookup materials (for materials tab)
      {
        $lookup: {
          from: "materials",
          localField: "_id",
          foreignField: "projectId",
          as: "materials",
          pipeline: [
            {
              $lookup: {
                from: "indicatorsKBOB",
                localField: "kbobMatchId",
                foreignField: "_id",
                as: "kbobMatch",
              },
            },
            {
              $unwind: {
                path: "$kbobMatch",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $lookup: {
                from: "elements",
                let: { materialId: "$_id" },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $in: ["$$materialId", "$materials.material"],
                      },
                    },
                  },
                  {
                    $unwind: "$materials",
                  },
                  {
                    $match: {
                      $expr: {
                        $eq: ["$materials.material", "$$materialId"],
                      },
                    },
                  },
                  {
                    $group: {
                      _id: null,
                      totalVolume: { $sum: "$materials.volume" },
                    },
                  },
                ],
                as: "volumeData",
              },
            },
            {
              $addFields: {
                volume: {
                  $ifNull: [
                    { $arrayElemAt: ["$volumeData.totalVolume", 0] },
                    0,
                  ],
                },
              },
            },
            {
              $unset: "volumeData", // Remove temp field using $unset
            },
          ],
        },
      },
      // 4. Add counts and use pre-calculated emissions
      {
        $addFields: {
          elementCount: { $size: "$elements" },
          uploadCount: { $size: "$uploads" },
          // Use pre-calculated emissions from project field (already computed!)
          totalEmissions: "$emissions",
        },
      },
    ]);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error("Failed to fetch project:", error);
    return NextResponse.json(
      { error: "Failed to fetch project" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await request.json();
    await connectToDatabase();

    const { id } = await params;

    // Verify project ownership before update
    const project = await Project.findOneAndUpdate(
      { _id: id, userId },
      body,
      { new: true }
    ).lean();

    if (!project) {
      return new Response("Project not found", { status: 404 });
    }

    // Invalidate dashboard cache so changes appear immediately
    const { invalidateDashboardCache } = await import("@/lib/services/dashboard-service");
    await invalidateDashboardCache();

    return NextResponse.json(project);
  } catch (error) {
    console.error("Failed to update project:", error);
    if (error instanceof Error) {
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
    }
    return new Response("Internal Server Error", { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    await connectToDatabase();

    const { id } = await params;

    // Start a session for atomic operations
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Verify project exists and belongs to user
      const project = await Project.findOne({
        _id: id,
        userId,
      }).session(session);

      if (!project) {
        await session.abortTransaction();
        return new Response("Project not found", { status: 404 });
      }

      // Delete all associated data in order
      await Upload.deleteMany({ projectId: id }).session(session);
      await Element.deleteMany({ projectId: id }).session(session);
      await Material.deleteMany({ projectId: id }).session(session);

      // Finally delete the project
      await Project.deleteOne({ _id: id }).session(session);

      // Commit the transaction
      await session.commitTransaction();

      // Invalidate dashboard cache so deletion is reflected immediately
      const { invalidateDashboardCache } = await import("@/lib/services/dashboard-service");
      await invalidateDashboardCache();

      return new Response(null, { status: 204 });
    } catch (error) {
      // If any error occurs, abort the transaction
      await session.abortTransaction();
      console.error("Failed to delete project:", error);
      if (error instanceof Error) {
        console.error("Error details:", {
          message: error.message,
          stack: error.stack,
          name: error.name,
        });
      }
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error("Failed to delete project:", error);
    if (error instanceof Error) {
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
    }
    return new Response("Internal Server Error", { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const { id } = await params;
    const body = await request.json();

    // Handle calculationArea null by unsetting it instead of setting to null
    const updateOp: any = { $set: {} };
    if (body.calculationArea === null) {
      updateOp.$unset = { calculationArea: "" };
      delete body.calculationArea;
    }

    // Copy other fields to $set
    Object.keys(body).forEach(key => {
      if (body[key] !== undefined) {
        updateOp.$set[key] = body[key];
      }
    });

    const project = await Project.findOneAndUpdate(
      { _id: id, userId },
      updateOp,
      { new: true }
    );

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Invalidate dashboard cache so changes appear immediately
    const { invalidateDashboardCache } = await import("@/lib/services/dashboard-service");
    await invalidateDashboardCache();

    return NextResponse.json(project);
  } catch (error) {
    console.error("Failed to update project:", error);
    if (error instanceof Error) {
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
    }
    return NextResponse.json(
      {
        error: "Failed to update project",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
