import { NextResponse } from "next/server";
import { withDatabase } from "@/lib/mongodb";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

export async function GET() {
  return withDatabase(async () => {
    try {
      const db = mongoose.connection.db;

      // Fetch unique materials from indicatorsKBOB collection
      const kbobMaterials = await db
        .collection("indicatorsKBOB")
        .aggregate([
          // Sort by Name to ensure consistent ordering
          { $sort: { Name: 1 } },
          // Group by Name to get unique materials
          {
            $group: {
              _id: "$Name",
              id: { $first: "$_id" },
              name: { $first: "$Name" },
              kbobId: { $first: "$KBOB_ID" },
              indicators: {
                $first: {
                  gwp: "$GWP",
                  ubp: "$UBP",
                  penre: "$PENRE",
                },
              },
            },
          },
          // Project the fields we want to return
          {
            $project: {
              _id: "$id",
              KBOB_ID: "$kbobId",
              Name: "$name",
              GWP: "$indicators.gwp",
              UBP: "$indicators.ubp",
              PENRE: "$indicators.penre",
              "kg/unit": 1,
              "min density": 1,
              "max density": 1,
            },
          },
        ])
        .toArray();

      console.log("KBOB Materials fetched:", kbobMaterials.length);
      return NextResponse.json(kbobMaterials);
    } catch (error) {
      console.error("Failed to fetch KBOB materials:", error);
      return NextResponse.json(
        { error: "Failed to fetch KBOB materials" },
        { status: 500 }
      );
    }
  });
}
