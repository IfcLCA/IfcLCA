import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDashboardData } from "@/lib/services/dashboard-service";

export const runtime = "nodejs";
export const revalidate = 300; // 5 minutes

export async function GET() {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const dashboardData = await getDashboardData(userId);

        return NextResponse.json({
            statistics: {
                totalProjects: dashboardData.stats.totalProjects,
                totalElements: dashboardData.stats.totalElements,
                totalMaterials: dashboardData.stats.totalMaterials,
                recentActivities: dashboardData.recentActivities.length,
                totalEmissions: dashboardData.stats.totalEmissions,
            },
            recentProjects: dashboardData.recentProjects,
            activities: dashboardData.recentActivities,
        });
    } catch (error) {
        console.error("Failed to fetch dashboard stats:", error);
        return NextResponse.json(
            { error: "Failed to fetch dashboard stats" },
            { status: 500 }
        );
    }
}
