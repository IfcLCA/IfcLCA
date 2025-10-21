import { Element } from "@/models";
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";

export const runtime = "nodejs";
export const revalidate = 60;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase();
    const { id } = await params;
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    const projectId = new mongoose.Types.ObjectId(id);

    // Fetch elements with pagination
    const [elements, total] = await Promise.all([
      Element.find({ projectId })
        .select("name type guid loadBearing isExternal materials")
        .populate({
          path: "materials.material",
          select: "name category density kbobMatchId",
          populate: {
            path: "kbobMatchId",
            select: "Name GWP UBP PENRE"
          }
        })
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .lean(),
      Element.countDocuments({ projectId })
    ]);

    // Calculate totalVolume and emissions for each element
    const enrichedElements = elements.map((el: any) => ({
      ...el,
      totalVolume: el.materials.reduce((sum: number, mat: any) => sum + (mat.volume || 0), 0),
      emissions: el.materials.reduce(
        (acc: any, mat: any) => {
          const volume = mat.volume || 0;
          const density = mat.material?.density || 0;
          const kbob = mat.material?.kbobMatch;
          const mass = volume * density;

          return {
            gwp: acc.gwp + mass * (kbob?.GWP || 0),
            ubp: acc.ubp + mass * (kbob?.UBP || 0),
            penre: acc.penre + mass * (kbob?.PENRE || 0),
          };
        },
        { gwp: 0, ubp: 0, penre: 0 }
      ),
    }));

    return NextResponse.json({
      elements: enrichedElements,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error("Failed to fetch elements:", error);
    return NextResponse.json(
      { error: "Failed to fetch elements" },
      { status: 500 }
    );
  }
}
