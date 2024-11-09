import { connectToDatabase } from "@/lib/mongodb";
import { Material } from "@/models";
import { DataTable } from "@/components/data-table";
import { materialsColumns } from "@/components/materials-columns";

export const dynamic = "force-dynamic";

async function getMaterials() {
  try {
    await connectToDatabase();

    const materials = (await Material.find()
      .select("name category volume")
      .lean()) as unknown as Array<{
      _id: { toString: () => string };
      name: string;
      category?: string;
      volume?: number;
    }>;

    return materials.map((material) => ({
      id: material._id.toString(),
      name: material.name,
      category: material.category || "",
      volume: material.volume || 0,
    }));
  } catch (error) {
    console.error("Failed to fetch materials:", error);
    return [];
  }
}

export default async function MaterialsLibrary() {
  const materials = await getMaterials();

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-2xl font-bold mb-6">Materials Library</h1>
      <DataTable columns={materialsColumns} data={materials} />
    </div>
  );
}
