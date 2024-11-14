import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Material } from "@/models";
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";

const testMaterials = [
  {
    name: "Concrete",
    category: "Structure",
    volume: 150,
    gwp: 45000,
    ubp: 85000,
    penre: 120000,
  },
  {
    name: "Steel",
    category: "Structure",
    volume: 50,
    gwp: 75000,
    ubp: 95000,
    penre: 180000,
  },
  {
    name: "Wood",
    category: "Structure",
    volume: 80,
    gwp: 15000,
    ubp: 25000,
    penre: 35000,
  },
  {
    name: "Glass",
    category: "Facade",
    volume: 30,
    gwp: 25000,
    ubp: 45000,
    penre: 65000,
  },
  {
    name: "Aluminum",
    category: "Facade",
    volume: 20,
    gwp: 55000,
    ubp: 75000,
    penre: 95000,
  },
];

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    await connectToDatabase();

    // Clear existing materials for this project
    await Material.deleteMany({ projectId: params.id });

    // Add test materials
    const materials = await Promise.all(
      testMaterials.map((material) =>
        Material.create({
          ...material,
          projectId: params.id,
        })
      )
    );

    return NextResponse.json({ 
      message: "Test materials added successfully",
      count: materials.length 
    });
  } catch (error) {
    console.error("Failed to add test materials:", error);
    return NextResponse.json(
      { error: "Failed to add test materials" },
      { status: 500 }
    );
  }
}
