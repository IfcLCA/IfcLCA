import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Element, Upload } from "@/models";
import mongoose from "mongoose";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { uploadIds } = await request.json();
    if (!Array.isArray(uploadIds) || uploadIds.length < 2) {
      return NextResponse.json(
        { error: "At least two uploads must be selected" },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const projectId = new mongoose.Types.ObjectId(params.id);
    const ids = uploadIds
      .filter((id: string) => mongoose.Types.ObjectId.isValid(id))
      .map((id: string) => new mongoose.Types.ObjectId(id));

    const uploads = await Upload.find({ _id: { $in: ids }, projectId })
      .lean();

    const results = await Promise.all(
      uploads.map(async (upload) => {
        const elements = await Element.find({
          projectId,
          uploadId: upload._id,
        })
          .populate({
            path: "materials.material",
            populate: { path: "kbobMatchId" },
          })
          .lean();

        const transformedElements = elements.map((el) => {
          const mats = (el.materials || []).map((mat: any) => ({
            material: {
              _id: mat.material?._id,
              name: mat.material?.name,
              density: mat.material?.density,
              kbobMatch: mat.material?.kbobMatchId
                ? {
                    Name: mat.material.kbobMatchId.Name,
                    GWP: mat.material.kbobMatchId.GWP,
                    UBP: mat.material.kbobMatchId.UBP,
                    PENRE: mat.material.kbobMatchId.PENRE,
                  }
                : undefined,
            },
            volume: mat.volume,
            indicators: mat.indicators,
          }));

          const emissions = mats.reduce(
            (acc, m) => ({
              gwp: acc.gwp + (m.indicators?.gwp || 0),
              ubp: acc.ubp + (m.indicators?.ubp || 0),
              penre: acc.penre + (m.indicators?.penre || 0),
            }),
            { gwp: 0, ubp: 0, penre: 0 }
          );

          return {
            _id: el._id.toString(),
            name: el.name,
            type: el.type,
            totalVolume: mats.reduce((s, m) => s + (m.volume || 0), 0),
            materials: mats,
            emissions,
            loadBearing: el.loadBearing,
            isExternal: el.isExternal,
          };
        });

        const materialMap: Record<string, any> = {};
        transformedElements.forEach((element) => {
          element.materials.forEach((mat: any) => {
            const key = String(mat.material._id || mat.material.name);
            if (!materialMap[key]) {
              materialMap[key] = {
                _id: mat.material._id,
                material: mat.material,
                volume: 0,
                emissions: { gwp: 0, ubp: 0, penre: 0 },
              };
            }
            materialMap[key].volume += mat.volume || 0;
            materialMap[key].emissions.gwp += mat.indicators?.gwp || 0;
            materialMap[key].emissions.ubp += mat.indicators?.ubp || 0;
            materialMap[key].emissions.penre += mat.indicators?.penre || 0;
          });
        });

        const materials = Object.values(materialMap);

        const totals = materials.reduce(
          (acc, m: any) => ({
            gwp: acc.gwp + m.emissions.gwp,
            ubp: acc.ubp + m.emissions.ubp,
            penre: acc.penre + m.emissions.penre,
          }),
          { gwp: 0, ubp: 0, penre: 0 }
        );

        return {
          uploadId: upload._id.toString(),
          filename: upload.filename,
          elements: transformedElements,
          materials,
          totals,
        };
      })
    );

    return NextResponse.json({ uploads: results });
  } catch (error) {
    console.error("Comparison API error", error);
    return NextResponse.json(
      { error: "Failed to load comparison data" },
      { status: 500 }
    );
  }
}
