import { NextResponse } from "next/server";
import { requireUserId, route } from "@/lib/api";
import { getDashboardData } from "@/lib/repositories/dashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route("Loading the dashboard", async () => {
  const userId = await requireUserId();
  const data = await getDashboardData(userId);
  return NextResponse.json(
    {
      statistics: {
        ...data.stats,
        recentActivities: data.recentActivities.length,
      },
      recentProjects: data.recentProjects,
      activities: data.recentActivities,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
});
