import { connectToDatabase } from "@/lib/mongodb";
import { Element, Material, Project, Upload } from "@/models";
import { auth } from "@clerk/nextjs/server";
import mongoose from "mongoose";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();

    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      return NextResponse.json(
        { error: "Invalid project ID" },
        { status: 400 }
      );
    }

    const projectId = new mongoose.Types.ObjectId(params.id);

    // Use aggregation pipeline to get all data in one query
    const [project] = await Project.aggregate([
      {
        $match: { _id: projectId },
      },
      {
        $lookup: {
          from: "uploads",
          localField: "_id",
          foreignField: "projectId",
          as: "uploads",
        },
      },
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
                emissions: {
                  $reduce: {
                    input: "$materials",
                    initialValue: { gwp: 0, ubp: 0, penre: 0 },
                    in: {
                      gwp: {
                        $add: [
                          "$$value.gwp",
                          {
                            $multiply: [
                              "$$this.volume",
                              { $ifNull: ["$$this.material.density", 0] },
                              { $ifNull: ["$$this.material.kbobMatch.GWP", 0] },
                            ],
                          },
                        ],
                      },
                      ubp: {
                        $add: [
                          "$$value.ubp",
                          {
                            $multiply: [
                              "$$this.volume",
                              { $ifNull: ["$$this.material.density", 0] },
                              { $ifNull: ["$$this.material.kbobMatch.UBP", 0] },
                            ],
                          },
                        ],
                      },
                      penre: {
                        $add: [
                          "$$value.penre",
                          {
                            $multiply: [
                              "$$this.volume",
                              { $ifNull: ["$$this.material.density", 0] },
                              {
                                $ifNull: ["$$this.material.kbobMatch.PENRE", 0],
                              },
                            ],
                          },
                        ],
                      },
                    },
                  },
                },
              },
            },
          ],
        },
      },
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
                gwp: {
                  $multiply: [
                    {
                      $ifNull: [
                        { $arrayElemAt: ["$volumeData.totalVolume", 0] },
                        0,
                      ],
                    },
                    { $ifNull: ["$density", 0] },
                    { $ifNull: ["$kbobMatch.GWP", 0] },
                  ],
                },
                ubp: {
                  $multiply: [
                    {
                      $ifNull: [
                        { $arrayElemAt: ["$volumeData.totalVolume", 0] },
                        0,
                      ],
                    },
                    { $ifNull: ["$density", 0] },
                    { $ifNull: ["$kbobMatch.UBP", 0] },
                  ],
                },
                penre: {
                  $multiply: [
                    {
                      $ifNull: [
                        { $arrayElemAt: ["$volumeData.totalVolume", 0] },
                        0,
                      ],
                    },
                    { $ifNull: ["$density", 0] },
                    { $ifNull: ["$kbobMatch.PENRE", 0] },
                  ],
                },
              },
            },
            {
              $project: {
                volumeData: 0,
              },
            },
          ],
        },
      },
      {
        $addFields: {
          elementCount: { $size: "$elements" },
          uploadCount: { $size: "$uploads" },
          totalEmissions: {
            $reduce: {
              input: "$elements",
              initialValue: { gwp: 0, ubp: 0, penre: 0 },
              in: {
                gwp: { $add: ["$$value.gwp", "$$this.emissions.gwp"] },
                ubp: { $add: ["$$value.ubp", "$$this.emissions.ubp"] },
                penre: { $add: ["$$value.penre", "$$this.emissions.penre"] },
              },
            },
          },
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
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await request.json();
    await connectToDatabase();

    // Verify project ownership before update
    const project = await Project.findOneAndUpdate(
      { _id: params.id, userId },
      body,
      { new: true }
    ).lean();

    if (!project) {
      return new Response("Project not found", { status: 404 });
    }

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
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    await connectToDatabase();

    // Start a session for atomic operations
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Verify project exists and belongs to user
      const project = await Project.findOne({
        _id: params.id,
        userId,
      }).session(session);

      if (!project) {
        await session.abortTransaction();
        return new Response("Project not found", { status: 404 });
      }

      // Delete all associated data in order
      await Upload.deleteMany({ projectId: params.id }).session(session);
      await Element.deleteMany({ projectId: params.id }).session(session);
      await Material.deleteMany({ projectId: params.id }).session(session);

      // Finally delete the project
      await Project.deleteOne({ _id: params.id }).session(session);

      // Commit the transaction
      await session.commitTransaction();
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
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const body = await request.json();
    const project = await Project.findOneAndUpdate(
      { _id: params.id, userId },
      { $set: body },
      { new: true }
    );

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

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
