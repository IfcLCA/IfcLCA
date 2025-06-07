import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // TODO: integrate real Oekobaudat data source
    return NextResponse.json([]);
  } catch (error) {
    console.error("Error fetching Oekobaudat materials:", error);
    return NextResponse.json(
      { error: "Failed to fetch Oekobaudat materials" },
      { status: 500 }
    );
  }
}
