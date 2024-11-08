import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Element } from "@/models";
import mongoose from "mongoose";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();

    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      return NextResponse.json(
        { error: "Invalid project ID format" },
        { status: 400 }
      );
    }

    const elements = await Element.find({ projectId: params.id }).lean();

    const formattedElements = elements.map((element) => ({
      id: element._id.toString(),
      name: element.name,
      type: element.type,
      volume: element.volume,
      buildingStorey: element.buildingStorey,
    }));

    return NextResponse.json(formattedElements);
  } catch (error) {
    console.error("Failed to fetch elements:", error);
    return NextResponse.json(
      { error: "Failed to fetch elements" },
      { status: 500 }
    );
  }
}
