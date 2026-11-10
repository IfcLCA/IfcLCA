import { NextResponse } from "next/server";
import { requireUserId, route } from "@/lib/api";
import { deleteMaterial } from "@/lib/repositories/materials";

export const DELETE = route(
  "Deleting the material",
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const userId = await requireUserId();
    const { id } = await params;
    await deleteMaterial(userId, id);
    return NextResponse.json({ message: "Material deleted successfully" });
  }
);
