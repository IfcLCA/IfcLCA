import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Element } from "@/models";
import mongoose from "mongoose";

export const runtime = "nodejs";

interface ElementDoc {
  _id: mongoose.Types.ObjectId;
  name: string;
  type?: string;
  volume?: number;
  buildingStorey?: string;
  materials?: any[];
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    console.log("Fetching elements for project:", params.id);
    await connectToDatabase();

    const elements = await Element.find({ projectId: params.id }).lean().exec();

    console.log("Found elements:", {
      count: elements.length,
      firstElement: elements[0],
    });

    const formattedElements = elements.map((element) => ({
      id: element._id.toString(),
      name: element.name,
      type: element.type || "Unknown",
      volume: element.volume || 0,
      buildingStorey: element.buildingStorey || "-",
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
