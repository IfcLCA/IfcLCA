import { connectToDatabase } from "@/lib/mongodb";
import { Project } from "@/models";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 300; // 5 minutes

export async function GET(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const summary = searchParams.get("summary") === "true";

    await connectToDatabase();

    if (summary) {
      // Summary mode - only return counts, not full data
      const projects = await Project.aggregate([
        { $match: { userId } },
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
          },
        },
        {
          $lookup: {
            from: "materials",
            localField: "_id",
            foreignField: "projectId",
            as: "materials",
          },
        },
        {
          $addFields: {
            lastActivityAt: {
              $max: [
                "$updatedAt",
                { $max: "$uploads.createdAt" },
                { $max: "$elements.createdAt" },
                { $max: "$materials.createdAt" },
              ],
            },
            _count: {
              elements: { $size: "$elements" },
              uploads: { $size: "$uploads" },
              materials: { $size: "$materials" },
            },
          },
        },
        { $sort: { lastActivityAt: -1 } },
      ]);

      const transformedProjects = projects.map((project) => ({
        id: project._id.toString(),
        name: project.name,
        description: project.description,
        imageUrl: project.imageUrl,
        updatedAt: project.lastActivityAt || project.updatedAt,
        _count: project._count,
      }));

      return NextResponse.json(transformedProjects);
    }

    // Full mode - return complete data (for project detail pages)
    const projects = await Project.aggregate([
      { $match: { userId } },
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
        },
      },
      {
        $lookup: {
          from: "materials",
          localField: "_id",
          foreignField: "projectId",
          as: "materials",
        },
      },
      {
        $addFields: {
          lastActivityAt: {
            $max: [
              "$updatedAt",
              { $max: "$uploads.createdAt" },
              { $max: "$elements.createdAt" },
              { $max: "$materials.createdAt" },
            ],
          },
          _count: {
            elements: { $size: "$elements" },
            uploads: { $size: "$uploads" },
            materials: { $size: "$materials" },
          },
          emissions: {
            $ifNull: [
              "$emissions",
              {
                gwp: 0,
                ubp: 0,
                penre: 0,
                lastCalculated: new Date(),
              },
            ],
          },
          elements: {
            $map: {
              input: "$elements",
              as: "element",
              in: {
                _id: "$$element._id",
                name: "$$element.name",
                type: "$$element.type",
                volume: "$$element.volume",
                materials: {
                  $map: {
                    input: "$$element.materials",
                    as: "material",
                    in: {
                      volume: "$$material.volume",
                      indicators: {
                        gwp: "$$material.indicators.gwp",
                        ubp: "$$material.indicators.ubp",
                        penre: "$$material.indicators.penre",
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      { $sort: { lastActivityAt: -1 } },
    ]);

    const transformedProjects = projects.map((project) => ({
      id: project._id.toString(),
      name: project.name,
      description: project.description,
      imageUrl: project.imageUrl,
      updatedAt: project.lastActivityAt || project.updatedAt,
      _count: project._count,
      elements: project.elements.map((element) => ({
        ...element,
        _id: element._id.toString(),
        materials: element.materials || [],
      })),
    }));

    return NextResponse.json(transformedProjects);
  } catch (error) {
    console.error("API - Error fetching projects:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    await connectToDatabase();

    const project = await Project.create({
      ...body,
      userId,
      emissions: {
        gwp: 0,
        ubp: 0,
        penre: 0,
        lastCalculated: new Date(),
      },
    });

    // Invalidate dashboard cache so new project appears immediately
    const { invalidateDashboardCache } = await import("@/lib/services/dashboard-service");
    await invalidateDashboardCache();

    return NextResponse.json(project);
  } catch (error) {
    console.error("Failed to create project:", error);

    // Track the error with PostHog
    const { captureServerError } = await import("@/lib/posthog-client");
    captureServerError(error as Error, userId, {
      action: "create_project",
      body: body,
    });

    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}
