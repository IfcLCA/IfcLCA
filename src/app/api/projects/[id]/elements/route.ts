import { Element, Project } from "@/models";
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { getGWP, getUBP, getPENRE } from "@/lib/utils/kbob-indicators";
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // Disable caching for user-specific data

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase();
    const { id } = await params;

    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
    }

    const projectId = new mongoose.Types.ObjectId(id);

    // Verify project ownership
    const project = await Project.findOne({ _id: projectId, userId }).lean();
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);

    // Sanitize pagination params to prevent limit=0, negative pages, NaN, or huge values
    const rawPage = Number.parseInt(searchParams.get("page") || "1", 10);
    const rawLimit = Number.parseInt(searchParams.get("limit") || "50", 10);

    const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
    const DEFAULT_LIMIT = 50;
    const MAX_LIMIT = 200;
    const limit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(rawLimit, 1), MAX_LIMIT)
      : DEFAULT_LIMIT;

    const skip = (page - 1) * limit;

    // Fetch elements with pagination
    const [elements, total] = await Promise.all([
      Element.find({ projectId })
        .select("name type guid loadBearing isExternal materials")
        .populate({
          path: "materials.material",
          select: "name category density kbobMatchId",
          populate: {
            path: "kbobMatchId",
            select: "Name uuid gwpTotal ubp21Total primaryEnergyNonRenewableTotal"
          }
        })
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .lean(),
      Element.countDocuments({ projectId })
    ]);

    // Calculate totalVolume and emissions for each element
    const enrichedElements = elements.map((el: any) => {
      const mats = Array.isArray(el.materials) ? el.materials : [];
      return {
        ...el,
        totalVolume: mats.reduce((sum: number, mat: any) => sum + (mat.volume || 0), 0),
        emissions: mats.reduce(
          (acc: any, mat: any) => {
            const volume = mat.volume || 0;
            const density = mat.material?.density || 0;
            const kbob = mat.material?.kbobMatchId;
            const mass = volume * density;

            return {
              gwp: acc.gwp + mass * getGWP(kbob),
              ubp: acc.ubp + mass * getUBP(kbob),
              penre: acc.penre + mass * getPENRE(kbob),
            };
          },
          { gwp: 0, ubp: 0, penre: 0 }
        ),
      };
    });

    return NextResponse.json({
      elements: enrichedElements,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / Math.max(limit, 1))
    });
  } catch (error) {
    console.error("Failed to fetch elements:", error);
    return NextResponse.json(
      { error: "Failed to fetch elements" },
      { status: 500 }
    );
  }
}
