import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Element } from "@/models";
import mongoose from "mongoose";

export async function POST(request: Request) {
  try {
    const { materialIds } = await request.json();
    await connectToDatabase();

    // Convert material IDs to ObjectIds
    const objectIds = materialIds.map(
      (id: string) => new mongoose.Types.ObjectId(id)
    );

    // First, get all elements that have any of these materials
    const elements = await Element.find({
      "materials.material": { $in: objectIds }
    }).lean();

    // Count elements per material
    const countMap: Record<string, number> = {};
    elements.forEach(element => {
      element.materials.forEach(mat => {
        const materialId = mat.material.toString();
        if (materialIds.includes(materialId)) {
          countMap[materialId] = (countMap[materialId] || 0) + 1;
        }
      });
    });

    // Ensure all requested materials have a count (even if 0)
    const result = materialIds.reduce((acc, id) => {
      acc[id] = countMap[id] || 0;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching element counts:", error);
    return NextResponse.json(
      { error: "Failed to fetch element counts" },
      { status: 500 }
    );
  }
}
