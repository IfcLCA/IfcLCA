import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ 
    status: "ok", 
    message: "Simple endpoint works",
    timestamp: new Date().toISOString()
  });
}

