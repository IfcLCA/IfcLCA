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
    if (!params?.id || !mongoose.Types.ObjectId.isValid(params.id)) {
      return NextResponse.json(
        { error: "Invalid project ID" },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const projectId = new mongoose.Types.ObjectId(params.id);

    const elements = await Element.find({ projectId }).lean();

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
